import { Clock, DateTime, Effect, FileSystem, Path } from "effect"
import { Prompt } from "effect/cli"
import { makeAdapters, readSources as readAdapters } from "../adapters/registry.ts"
import { AnalysisCache } from "../analysis/cache.ts"
import { analyze, plan, type AnalyzeOptions } from "../analysis/index.ts"
import { Progress } from "../analysis/progress.ts"
import { decodeProfile, type Language } from "../domain/Profile.ts"
import type { PromptRecord } from "../domain/PromptRecord.ts"
import { encodeStats } from "../domain/Stats.ts"
import { chooseRunner } from "../llm/detect.ts"
import { LlmRunner, type RunnerId } from "../llm/LlmRunner.ts"
import { withRetry } from "../llm/retry.ts"
import { processRecords, type PipelineReport } from "../pipeline/index.ts"
import { Environment } from "../platform/Environment.ts"
import { writePrivateFile } from "../platform/files.ts"
import { resolveCacheDir } from "../platform/paths.ts"
import { writeReport } from "../report/index.ts"
import { VERSION } from "../version.ts"
import { FileError, InvalidArgument, NeedsConfirmation, NoData } from "./errors.ts"
import { cliMessages, type CliMessages } from "./i18n.ts"
import { LlmProvider, Opener, Output } from "./services.ts"

/*
 * Wiring only: every decision (sampling, retries, filtering…) lives in the modules above.
 */

export const DEFAULT_OUT = "prompt-profile-report"

export const resolveLanguage = (flag: Language | undefined, locale: string): Language =>
  flag ?? (/^zh/i.test(locale) ? "zh-TW" : "en")

/** `1m` / `3m` / `6m` / `1y` / `all` (also `<n>d`, `<n>w`, `<n>m`, `<n>y`). */
export const parseSince = (
  value: string,
  now: DateTime.Utc,
): Effect.Effect<DateTime.Utc | null, InvalidArgument> => {
  if (value === "all") return Effect.succeed(null)
  const m = /^(\d+)([dwmy])$/.exec(value.trim())
  if (!m || Number(m[1]) === 0) return Effect.fail(new InvalidArgument({ flag: "--since", value }))
  const n = Number(m[1])
  const parts = { d: { days: n }, w: { weeks: n }, m: { months: n }, y: { years: n } }[
    m[2] as "d" | "w" | "m" | "y"
  ]
  return Effect.succeed(DateTime.subtract(now, parts))
}

const sum = (counts: Readonly<Record<string, number>>) =>
  Object.values(counts).reduce((a, b) => a + b, 0)

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

// ---------------------------------------------------------------------------------------
// Shared: read + pipeline

interface Collected {
  readonly records: ReadonlyArray<PromptRecord>
  readonly locations: ReadonlyArray<string>
  readonly slashCommands: Record<string, number>
}

const readSources = (t: CliMessages) =>
  Effect.gen(function* () {
    const env = yield* Environment
    const out = yield* Output
    const adapters = yield* makeAdapters({ home: env.home, env: env.env })
    yield* out.line(t.reading)
    const records: Array<PromptRecord> = []
    const locations: Array<string> = []
    const slashCommands: Record<string, number> = {}
    for (const source of yield* readAdapters(adapters)) {
      const { adapter, diagnostics: diag } = source
      locations.push(...source.locations)
      for (const [k, v] of Object.entries(diag.slashCommands))
        slashCommands[k] = (slashCommands[k] ?? 0) + v
      for (const r of source.records) records.push(r)
      const sessions = new Set(source.records.map((r) => r.sessionId)).size
      yield* out.line(t.sourceLine(adapter.displayName, source.records.length, sessions))
      yield* out.debug(
        `  [${adapter.id}] excluded ${JSON.stringify(diag.excluded)} badLines=${diag.badLines}`,
      )
    }
    if (records.length === 0) return yield* new NoData({ reason: "empty", locations })
    return { records, locations, slashCommands } satisfies Collected
  })

const runPipelineStep = (collected: Collected, since: string, t: CliMessages) =>
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
    return result
  })

const resolveOut = (outFlag: string) =>
  Effect.gen(function* () {
    const env = yield* Environment
    const path = yield* Path.Path
    return path.resolve(env.cwd, outFlag)
  })

/** Analysis results and downloaded fonts. */
export const cacheDirOf = Effect.gen(function* () {
  const env = yield* Environment
  return resolveCacheDir(env.env, env.home, yield* Path.Path)
})

const writeFileOrFail = (file: string, data: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    yield* writePrivateFile(fs, path, file, data).pipe(
      Effect.mapError((e) => new FileError({ path: file, detail: e.message })),
    )
  })

// ---------------------------------------------------------------------------------------
// Main command

export interface MainOptions {
  readonly since: string
  readonly engine: RunnerId | undefined
  readonly model: string | undefined
  readonly lang: Language | undefined
  readonly out: string
  readonly full: boolean
  readonly cache: boolean
  readonly yes: boolean
  readonly dryRun: boolean
}

export const runMain = (options: MainOptions, language: Language) =>
  Effect.gen(function* () {
    const t = cliMessages[language]
    const env = yield* Environment
    const out = yield* Output
    const outDir = yield* resolveOut(options.out)
    yield* out.line(t.header(VERSION))
    yield* out.line("")

    const collected = yield* readSources(t)
    const { prompts, stats } = yield* runPipelineStep(collected, options.since, t)

    const analyzeOptions: AnalyzeOptions = {
      language,
      timezone: env.timezone,
      full: options.full,
      noCache: !options.cache,
      model: options.model ?? null,
    }

    // --dry-run: write what would be sent, never call an LLM.
    if (options.dryRun) {
      const p = yield* plan({
        prompts,
        options: analyzeOptions,
        runner: options.engine ?? "claude-code",
      })
      const path = yield* Path.Path
      for (const [i, c] of p.chunks.entries()) {
        yield* writeFileOrFail(
          path.join(outDir, "chunks", `${String(i + 1).padStart(3, "0")}-${c.label}.txt`),
          `${c.text}\n`,
        )
      }
      yield* writeFileOrFail(
        path.join(outDir, "plan.json"),
        `${JSON.stringify(
          {
            chunksTotal: p.chunksTotal,
            chunksSelected: p.chunks.length,
            sampled: p.sampled,
            cacheHits: p.cacheHits,
            llmCalls: p.llmCalls,
            charsToSend: p.charsToSend,
            promptsAnalyzed: p.promptsAnalyzed,
            sessionsAnalyzed: p.sessionsAnalyzed,
            chunks: p.chunks.map((c) => ({
              id: c.id,
              label: c.label,
              prompts: c.prompts.length,
              chars: c.text.length,
            })),
          },
          null,
          2,
        )}\n`,
      )
      yield* out.line(t.dryRun(outDir, p.chunks.length, p.charsToSend))
      return
    }

    // Pick the engine (no prompt is sent to check login).
    const provider = yield* LlmProvider
    const status = yield* chooseRunner(yield* provider.detect, options.engine ?? null)
    const runner = withRetry(yield* provider.make(status.id, { model: options.model }))

    const p = yield* plan({ prompts, options: analyzeOptions, runner: runner.id })
    yield* out.line(t.range(t.sinceLabel(options.since), p.promptsAnalyzed, p.chunks.length))
    if (p.sampled) yield* out.line(t.sampledNote(p.chunks.length, p.chunksTotal))
    yield* out.line(t.engineLine(runner.displayName, p.llmCalls, p.cacheHits))
    yield* out.line("")

    if (!options.yes) {
      if (!env.isTTY) return yield* new NeedsConfirmation()
      const ok = yield* Prompt.run(Prompt.Confirm({ message: t.confirm, initial: true })).pipe(
        Effect.orElseSucceed(() => false),
      )
      if (!ok) {
        yield* out.line(t.cancelled)
        return
      }
    }

    // Progress rendering.
    let done = 0
    let cached = 0
    const total = p.chunks.length
    const progress = {
      onChunkStart: () => Effect.void,
      onChunkDone: (info: { index: number; fromCache: boolean; durationMs: number | null }) =>
        Effect.gen(function* () {
          done++
          if (info.fromCache) cached++
          if (info.durationMs !== null) yield* out.debug(t.chunkTiming(info.index, info.durationMs))
          yield* out.status(t.analysing(done, total, cached))
        }),
      onMergeStart: (groups: number) => out.line(t.merging(groups)),
      onReduceStart: out.line(t.reducing),
      onReduceDone: (ms: number) => out.debug(t.chunkTiming(total, ms)),
      onVerified: (kept: number, dropped: number) => out.line(t.verified(kept, kept + dropped)),
    }

    yield* out.status(t.analysing(0, total, 0))
    const profile = yield* analyze({ prompts, stats, options: analyzeOptions }).pipe(
      Effect.provideService(LlmRunner, runner),
      Effect.provideService(Progress, progress),
      Effect.onInterrupt(() => out.error(`\n${t.interrupted}`)),
    )

    const files = yield* writeReport(profile, {
      outDir,
      cacheDir: yield* cacheDirOf,
      ...(env.fetchFont ? { fetcher: env.fetchFont } : {}),
    }).pipe(Effect.mapError((e) => new FileError({ path: outDir, detail: e.message })))

    const opened = env.isTTY ? yield* (yield* Opener).open(files.html) : false
    yield* out.line("")
    yield* out.line(t.done)
    yield* out.line(t.reportLine(files.html, opened))
    yield* out.line(files.card ? t.cardLine(files.card) : t.cardSkipped(files.cardError ?? "?"))
    yield* out.line(t.dataLine(files.profileJson))
    if (profile.coverage.chunksFailed > 0)
      yield* out.line(t.skippedChunks(profile.coverage.chunksFailed))
  })

// ---------------------------------------------------------------------------------------
// Subcommands

export const runStats = (
  options: { readonly since: string; readonly out: string },
  language: Language,
) =>
  Effect.gen(function* () {
    const t = cliMessages[language]
    const out = yield* Output
    const path = yield* Path.Path
    yield* out.line(t.header(VERSION))
    yield* out.line("")
    const collected = yield* readSources(t)
    const { stats } = yield* runPipelineStep(collected, options.since, t)
    const file = path.join(yield* resolveOut(options.out), "stats.json")
    yield* writeFileOrFail(file, `${JSON.stringify(encodeStats(stats), null, 2)}\n`)
    const peak = stats.hourHistogram.indexOf(Math.max(...stats.hourHistogram))
    yield* out.line("")
    yield* out.line(
      [
        `  prompts ${stats.totalPrompts} · sessions ${stats.totalSessions} · active days ${stats.activeDays}`,
        `  peak hour ${String(peak).padStart(2, "0")}:00 · latest ${stats.latestTime ?? "-"} · longest streak ${stats.longestStreakDays}d`,
        `  zh ${Math.round(stats.languageMix.zh * 100)}% · en ${Math.round(stats.languageMix.en * 100)}% · mixed ${Math.round(stats.languageMix.mixed * 100)}%`,
      ].join("\n"),
    )
    yield* out.line(t.statsWritten(file))
  })

export const runRender = (
  options: { readonly file: string; readonly out: string | undefined },
  fallback: Language,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const env = yield* Environment
    const out = yield* Output
    const input = path.resolve(env.cwd, options.file)
    const text = yield* fs
      .readFileString(input)
      .pipe(Effect.mapError((e) => new FileError({ path: input, detail: e.message })))
    const json = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: () => new FileError({ path: input, detail: "not valid JSON" }),
    })
    const profile = yield* decodeProfile(json)
    const outDir = options.out ? yield* resolveOut(options.out) : path.dirname(input)
    const files = yield* writeReport(profile, {
      outDir,
      cacheDir: yield* cacheDirOf,
      ...(env.fetchFont ? { fetcher: env.fetchFont } : {}),
    }).pipe(Effect.mapError((e) => new FileError({ path: outDir, detail: e.message })))
    const t = cliMessages[profile.language ?? fallback]
    yield* out.line(t.rendered(files.html))
    yield* out.line(files.card ? t.cardLine(files.card) : t.cardSkipped(files.cardError ?? "?"))
  })

export const runCacheClear = (language: Language) =>
  Effect.gen(function* () {
    const cache = yield* AnalysisCache
    const out = yield* Output
    yield* cache.clear
    yield* out.line(cliMessages[language].cacheCleared(cache.location))
  })
