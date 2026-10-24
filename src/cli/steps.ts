import { Clock, DateTime, Effect, FileSystem, Path } from "effect"
import { makeAdapters, readSources as readAdapters } from "../adapters/registry.ts"
import { decodeProfile, type Profile } from "../domain/Profile.ts"
import { snapshotOf } from "../domain/Progress.ts"
import type { PromptRecord } from "../domain/PromptRecord.ts"
import type { TechniqueEvent } from "../domain/Techniques.ts"
import type { SkillOrigin } from "../domain/SourceAdapter.ts"
import { processRecords, type PipelineReport } from "../pipeline/index.ts"
import { withSkillCatalog } from "../pipeline/techniques.ts"
import { readSkillCatalog } from "../adapters/claude-code/skills.ts"
import { resolveClaudeRoot } from "../adapters/claude-code/adapter.ts"
import { Environment } from "../platform/Environment.ts"
import { writePrivateFile } from "../platform/files.ts"
import { resolveCacheDir } from "../platform/paths.ts"
import { writeReport, type RenderOptions } from "../report/index.ts"
import { FileError, NoData } from "./errors.ts"
import { messages as t } from "./messages.ts"
import { parseSince } from "./options.ts"
import { FontSource, Output } from "./services.ts"

/*
 * Steps shared by the commands (commands/*). Wiring and output only: every decision
 * (filtering, redaction, sampling, retries…) lives in the modules they call.
 */

const sum = (counts: Readonly<Record<string, number>>) =>
  Object.values(counts).reduce((a, b) => a + b, 0)

/** Redaction rule → the marker it leaves in the text. */
const REDACTION_LABELS: Record<string, string> = {
  "private-key": "SECRET",
  "connection-string": "SECRET",
  bearer: "SECRET",
  "key-value-secret": "SECRET",
  "api-token": "SECRET",
  jwt: "SECRET",
  "high-entropy": "SECRET",
  email: "EMAIL",
  phone: "PHONE",
  "tw-national-id": "ID",
  "credit-card": "ID",
  "internal-url": "INTERNAL_URL",
  "home-path": "PATH",
  username: "USER",
  uuid: "UUID",
  "hex-hash": "HASH",
}

const describeRedactions = (counts: PipelineReport["redactions"]): string => {
  const grouped: Record<string, number> = {}
  for (const [rule, n] of Object.entries(counts)) {
    const label = REDACTION_LABELS[rule] ?? rule
    grouped[label] = (grouped[label] ?? 0) + n
  }
  return Object.entries(grouped)
    .toSorted((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ")
}

export interface Collected {
  readonly records: ReadonlyArray<PromptRecord>
  readonly locations: ReadonlyArray<string>
  readonly slashCommands: Record<string, number>
  readonly events: ReadonlyArray<TechniqueEvent>
  readonly skillDescriptions: Readonly<Record<string, string>>
  readonly skillOrigins: Readonly<Record<string, SkillOrigin>>
}

/** Read every source and print one line per source. No records at all → `NoData`. */
export const readSources = Effect.gen(function* () {
  const env = yield* Environment
  const out = yield* Output
  const adapters = yield* makeAdapters({ home: env.home, env: env.env })
  yield* out.line(t.reading)
  const records: Array<PromptRecord> = []
  const locations: Array<string> = []
  const slashCommands: Record<string, number> = {}
  const events: Array<TechniqueEvent> = []
  const skillDescriptions: Record<string, string> = {}
  const skillOrigins: Record<string, SkillOrigin> = {}
  for (const source of yield* readAdapters(adapters)) {
    const { adapter, diagnostics: diag } = source
    locations.push(...adapter.locations)
    for (const [k, v] of Object.entries(diag.slashCommands))
      slashCommands[k] = (slashCommands[k] ?? 0) + v
    for (const r of source.records) records.push(r)
    for (const e of source.events) events.push(e)
    Object.assign(skillDescriptions, source.skillDescriptions ?? {})
    Object.assign(skillOrigins, source.skillOrigins ?? {})
    const sessions = new Set(source.records.map((r) => r.sessionId)).size
    yield* out.line(t.sourceLine(adapter.displayName, source.records.length, sessions))
    yield* out.debug(
      `  [${adapter.id}] excluded ${JSON.stringify(diag.excluded)} badLines=${diag.badLines} unreadableFiles=${diag.unreadableFiles}`,
    )
  }
  if (records.length === 0) return yield* new NoData({ reason: "empty", locations })
  return {
    records,
    locations,
    slashCommands,
    events,
    skillDescriptions,
    skillOrigins,
  } satisfies Collected
})

/** filter → clean → redact → truncate, plus stats; prints what was excluded and redacted. */
export const runPipelineStep = (collected: Collected, since: string) =>
  Effect.gen(function* () {
    const env = yield* Environment
    const out = yield* Output
    const now = DateTime.makeUnsafe(yield* Clock.currentTimeMillis)
    const sinceDate = yield* parseSince(since, now)
    const result = processRecords(collected.records, {
      since: sinceDate,
      now,
      timezone: env.timezone,
      username: env.username,
      slashCommands: collected.slashCommands,
      events: collected.events,
    })
    const excluded = { ...result.report.filterExcluded, ...result.report.cleanExcluded }
    yield* out.line(t.cleaning)
    yield* out.line(
      t.excludedLine(
        sum(excluded),
        Object.keys(excluded)
          .map((k) => t.ruleNames[k] ?? k)
          .join(" / ") || "-",
      ),
    )
    yield* out.line(
      t.redactedLine(sum(result.report.redactions), describeRedactions(result.report.redactions)),
    )
    if (result.prompts.length === 0) {
      return yield* new NoData({ reason: "out-of-range", locations: collected.locations })
    }
    // Skill descriptions come from local SKILL.md files (front matter only).
    const techniques = result.stats.techniques
    if (techniques !== null && techniques.details.skills.length > 0) {
      const path = yield* Path.Path
      const catalog = yield* readSkillCatalog({
        claudeRoot: resolveClaudeRoot(env.env, env.home, path),
        agentsRoot: path.join(env.home, ".agents"),
        projectDirs: [
          ...new Set(collected.records.flatMap((r) => (r.project === null ? [] : [r.project]))),
        ],
        names: techniques.details.skills.map((x) => x.name),
        listed: collected.skillDescriptions,
        listedOrigins: collected.skillOrigins,
      })
      return {
        ...result,
        stats: { ...result.stats, techniques: withSkillCatalog(techniques, catalog) },
      }
    }
    return result
  })

/** `--out` relative to the working directory. */
export const resolveOut = (outFlag: string) =>
  Effect.gen(function* () {
    const env = yield* Environment
    const path = yield* Path.Path
    return path.resolve(env.cwd, outFlag)
  })

/** The analysis cache folder. */
export const cacheDirOf = Effect.gen(function* () {
  const env = yield* Environment
  return resolveCacheDir(env.env, env.home, yield* Path.Path)
})

export const writeFileOrFail = (file: string, data: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    yield* writePrivateFile(fs, path, file, data).pipe(
      Effect.mapError((e) => new FileError({ path: file, detail: e.message })),
    )
  })

/** report.html, profile.json and card.png in `outDir` (a card failure is not an error). */
export const writeReportFiles = (
  profile: Profile,
  outDir: string,
  options?: RenderOptions,
  source?: string | null,
) =>
  Effect.gen(function* () {
    const fonts = yield* FontSource
    const cjk = fonts.cjk(yield* cacheDirOf)
    return yield* writeReport(profile, outDir, options, source, cjk).pipe(
      Effect.mapError((e) => new FileError({ path: outDir, detail: e.message })),
    )
  })

/** The key numbers of `<outDir>/profile.json`, if it exists and decodes; otherwise null. */
export const previousSnapshot = (outDir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const text = yield* fs
      .readFileString(path.join(outDir, "profile.json"))
      .pipe(Effect.orElseSucceed(() => null))
    if (text === null) return null
    return yield* Effect.try(() => JSON.parse(text) as unknown).pipe(
      Effect.flatMap(decodeProfile),
      Effect.map(snapshotOf),
      Effect.orElseSucceed(() => null),
    )
  })
