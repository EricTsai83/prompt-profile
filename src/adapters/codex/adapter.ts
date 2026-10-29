import { DateTime, Effect, FileSystem, Option, Path, Schema, Stream } from "effect"
import type { PromptRecord } from "../../domain/PromptRecord.ts"
import type { SourceAdapter, SourceRead } from "../../domain/SourceAdapter.ts"
import { isAnalysisPrompt } from "../../domain/markers.ts"
import { DiagnosticsCollector, jsonlCallbacks } from "../common/diagnostics.ts"
import { findFiles } from "../common/fs.ts"
import { readJsonl } from "../common/jsonl.ts"
import { techniqueOfTool } from "../common/techniques.ts"
import type { TechniqueEvent, ToolTechnique } from "../../domain/Techniques.ts"
import type { SkillOrigin } from "../../domain/SourceAdapter.ts"
import { clipDescription } from "../claude-code/skills.ts"

/** `- name: description (file: …/SKILL.md)` lines of the skills section Codex adds. */
export const parseCodexSkillListing = (
  text: string,
): Array<{ name: string; description: string; file: string }> =>
  [...text.matchAll(/^- ([\w.:-]{1,80}): (.+?)\s*\(file: ([^)\n]+\/SKILL\.md)\)\s*$/gm)].map(
    (m) => ({
      name: m[1]!,
      description: clipDescription(m[2]!.trim()),
      file: m[3]!,
    }),
  )

/** Names of skills whose SKILL.md an exec input reads; nothing else of the input is kept. */
export const skillsReadIn = (input: string): Array<string> => [
  ...new Set(
    [...input.matchAll(/\/skills\/(?:[\w.-]+\/)*?([\w.-]{1,80})\/SKILL\.md/g)].map((m) => m[1]!),
  ),
]

/** Where a listed skill file lives: Codex system skills, the user's, a plugin's or a project's. */
export const originOfSkillPath = (file: string, cwd: string | null): SkillOrigin =>
  file.includes("/.codex/skills/.system/")
    ? "builtin"
    : file.includes("/plugins/")
      ? "plugin"
      : cwd !== null && file.startsWith(`${cwd}/`)
        ? "project"
        : /\/\.(?:codex|agents)\/skills\//.test(file)
          ? "personal"
          : "project"
import { firstMatch } from "../common/rules.ts"
import {
  codexOrigin,
  isInjected,
  MESSAGE_RULES,
  SESSION_RULES,
  type CodexCandidate,
} from "./rules.ts"
import { CodexHistoryLine, RolloutLine, SessionMeta, UserMessage } from "./schema.ts"

const SOURCE = "codex" as const
const READ_CONCURRENCY = 8

const decodeRollout = Schema.decodeUnknownOption(RolloutLine)
const decodeMeta = Schema.decodeUnknownOption(SessionMeta)
const decodeUser = Schema.decodeUnknownOption(UserMessage)
const decodeHistory = Schema.decodeUnknownOption(CodexHistoryLine)

export const resolveCodexRoot = (
  env: Readonly<Record<string, string | undefined>>,
  home: string,
  path: Path.Path,
): string => env["CODEX_HOME"] || path.join(home, ".codex")

/** Session id from the rollout file name: `rollout-<time>-<uuid>.jsonl` (or `.jsonl.zst`). */
const idFromFileName = (name: string): string | undefined =>
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl(?:\.zst)?$/i.exec(
    name,
  )?.[1]

/** Rollouts, plain or compressed: Codex compresses older ones with zstd. */
const isRollout = (name: string): boolean =>
  name.startsWith("rollout-") && (name.endsWith(".jsonl") || name.endsWith(".jsonl.zst"))

export const toCandidate = (
  content: ReadonlyArray<{ readonly type: string; readonly text?: string | undefined }>,
): CodexCandidate => {
  const texts = content
    .filter((c) => c.type === "input_text" && typeof c.text === "string")
    .map((c) => c.text!)
  const kept = texts.filter((t) => !isInjected(t))
  return {
    text: kept.join("\n"),
    hasImage: content.some((c) => c.type === "input_image"),
    injectedBlocks: texts.length - kept.length,
  }
}

export const makeCodexAdapter = (
  root: string,
): Effect.Effect<SourceAdapter, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const sessionsDir = path.join(root, "sessions")
    const historyFile = path.join(root, "history.jsonl")

    /** `dedupKey` identifies a message across files: a resume / fork copies old messages. */
    const readRollout = (
      file: string,
      diag: DiagnosticsCollector,
    ): Effect.Effect<{
      ids: ReadonlyArray<string>
      records: ReadonlyArray<{ readonly dedupKey: string; readonly record: PromptRecord }>
      events: ReadonlyArray<TechniqueEvent>
      skills: ReadonlyArray<{ name: string; description: string; origin: SkillOrigin }>
    }> =>
      Effect.gen(function* () {
        diag.filesRead++
        let meta: SessionMeta | undefined
        const fileId = idFromFileName(path.basename(file))
        const records: Array<{ dedupKey: string; record: PromptRecord }> = []
        const listed: Array<{ name: string; description: string; file: string }> = []
        // Only user messages are kept while streaming: rollouts are mostly large tool output.
        const userLines: Array<{
          ts: string | undefined
          ordinal: number
          content: UserMessage["content"]
        }> = []
        // Tool names only (plan 17): never their input or output — except that an exec input
        // is matched against a SKILL.md path to learn which skill was read (only the name is kept).
        const tools: Array<{ ms: number; kind: ToolTechnique; detail?: string }> = []
        const models = new Map<string, number>()
        yield* readJsonl(fs, file, jsonlCallbacks(diag)).pipe(
          Stream.runForEach(({ value, lineNumber }) =>
            Effect.sync(() => {
              const outer = decodeRollout(value)
              if (Option.isNone(outer)) {
                diag.badLines++
                return
              }
              const { type, payload, timestamp, ordinal } = outer.value
              const lineMs = timestamp === undefined ? Number.NaN : Date.parse(timestamp)
              if (type === "session_meta" && meta === undefined) {
                meta = Option.getOrUndefined(decodeMeta(payload))
              } else if (type === "turn_context") {
                const model = (payload as { model?: unknown } | undefined)?.model
                if (typeof model === "string" && !models.has(model) && !Number.isNaN(lineMs))
                  models.set(model, lineMs)
              } else if (type === "response_item") {
                const item = payload as
                  | {
                      type?: unknown
                      role?: unknown
                      content?: unknown
                      input?: unknown
                      arguments?: unknown
                    }
                  | undefined
                if (
                  item?.type === "message" &&
                  item.role === "developer" &&
                  Array.isArray(item.content)
                ) {
                  const text = item.content
                    .map((x) =>
                      typeof (x as { text?: unknown }).text === "string"
                        ? (x as { text: string }).text
                        : "",
                    )
                    .join("\n")
                  for (const entry of parseCodexSkillListing(text)) listed.push(entry)
                }
                if (
                  (item?.type === "function_call" || item?.type === "custom_tool_call") &&
                  !Number.isNaN(lineMs)
                ) {
                  const input =
                    typeof item.input === "string"
                      ? item.input
                      : typeof item.arguments === "string"
                        ? item.arguments
                        : ""
                  for (const name of skillsReadIn(input))
                    tools.push({ ms: lineMs, kind: "skills", detail: name })
                }
                const call = payload as { type?: unknown; name?: unknown } | undefined
                if (
                  (call?.type === "function_call" || call?.type === "custom_tool_call") &&
                  typeof call.name === "string"
                ) {
                  const kind = techniqueOfTool(call.name)
                  const ms = timestamp === undefined ? Number.NaN : Date.parse(timestamp)
                  if (kind && !Number.isNaN(ms)) tools.push({ ms, kind })
                }
                const msg = decodeUser(payload)
                // assistant / developer / tool items are skipped
                if (Option.isSome(msg)) {
                  userLines.push({
                    ts: timestamp,
                    ordinal: ordinal ?? lineNumber,
                    content: msg.value.content,
                  })
                }
              }
            }),
          ),
        )
        const sessionId = meta?.id ?? fileId
        const ids = [meta?.id, meta?.session_id, fileId].filter((x): x is string => x !== undefined)
        if (sessionId === undefined) return { ids, records, events: [], skills: [] }
        const sessionRule = meta ? firstMatch(SESSION_RULES, meta) : undefined
        const firstMs = [
          ...models.values(),
          ...userLines.map((l) => (l.ts ? Date.parse(l.ts) : Number.NaN)),
          ...tools.map((t) => t.ms),
        ]
          .filter((ms) => !Number.isNaN(ms))
          .toSorted((a, b) => a - b)[0]
        const events: ReadonlyArray<TechniqueEvent> =
          sessionRule || firstMs === undefined
            ? []
            : [
                { source: SOURCE, sessionId, timestampMs: firstMs, kind: "transcript" },
                ...[...models].map(([model, ms]) => ({
                  source: SOURCE,
                  sessionId,
                  timestampMs: ms,
                  kind: "model" as const,
                  detail: model,
                })),
                ...tools.map((t) => ({
                  source: SOURCE,
                  sessionId,
                  timestampMs: t.ms,
                  kind: t.kind,
                  ...(t.detail === undefined ? {} : { detail: t.detail }),
                })),
              ]
        for (const line of userLines) {
          if (sessionRule) {
            diag.exclude(sessionRule.name)
            continue
          }
          const candidate = toCandidate(line.content)
          const rule = firstMatch(MESSAGE_RULES, candidate)
          if (rule) {
            diag.exclude(rule.name)
            continue
          }
          const timestamp =
            line.ts === undefined ? undefined : Option.getOrUndefined(DateTime.make(line.ts))
          if (timestamp === undefined) {
            diag.badLines++
            continue
          }
          records.push({
            dedupKey: `${line.ts}\u0000${candidate.text}`,
            record: {
              id: `${SOURCE}:${sessionId}:${line.ordinal}`,
              source: SOURCE,
              sessionId,
              timestamp,
              project: meta?.cwd ?? null,
              gitBranch: meta?.git?.branch ?? null,
              text: candidate.text,
              hasImage: candidate.hasImage,
              origin: codexOrigin(meta),
              client: meta?.originator ?? null,
            },
          })
        }
        const skills = listed.map((entry) => ({
          name: entry.name,
          description: entry.description,
          origin: originOfSkillPath(entry.file, meta?.cwd ?? null),
        }))
        return { ids, records, events, skills }
      })

    const fromHistory = (
      value: unknown,
      known: ReadonlySet<string>,
      diag: DiagnosticsCollector,
    ): PromptRecord | undefined => {
      const decoded = decodeHistory(value)
      if (Option.isNone(decoded)) {
        diag.badLines++
        return undefined
      }
      const h = decoded.value
      if (known.has(h.session_id)) return undefined
      if (isAnalysisPrompt(h.text)) {
        diag.exclude("analysis-marker")
        return undefined
      }
      if (h.text.trim() === "") {
        diag.exclude("empty")
        return undefined
      }
      const timestamp = Option.getOrUndefined(DateTime.make(h.ts * 1000))
      if (timestamp === undefined) {
        diag.badLines++
        return undefined
      }
      return {
        id: `${SOURCE}:${h.session_id}:h${h.ts}`,
        source: SOURCE,
        sessionId: h.session_id,
        timestamp,
        project: null,
        gitBranch: null,
        text: h.text,
        hasImage: false,
        // history.jsonl is only written by the interactive TUI
        origin: "interactive",
        client: "history",
      }
    }

    const read: Effect.Effect<SourceRead> = Effect.gen(function* () {
      const diag = new DiagnosticsCollector()
      const files = yield* findFiles(fs, path, sessionsDir, isRollout)
      const known = new Set<string>()
      for (const f of files) {
        const id = idFromFileName(path.basename(f))
        if (id) known.add(id)
      }
      // Files are read concurrently but processed in path order, so the copy kept by the
      // cross-file dedup is deterministic (the oldest file's).
      const seen = new Set<string>()
      const allEvents: Array<TechniqueEvent> = []
      const listings: Array<{ name: string; description: string; origin: SkillOrigin }> = []
      const rollouts = Stream.fromIterable(files).pipe(
        Stream.mapEffect((file) => readRollout(file, diag), { concurrency: READ_CONCURRENCY }),
        Stream.flatMap(({ ids, records, events, skills }) => {
          for (const id of ids) known.add(id)
          allEvents.push(...events)
          listings.push(...skills)
          const fresh: Array<PromptRecord> = []
          for (const { dedupKey, record } of records) {
            if (seen.has(dedupKey)) {
              diag.exclude("duplicate-message")
              continue
            }
            seen.add(dedupKey)
            fresh.push(record)
          }
          return Stream.fromIterable(fresh)
        }),
      )
      // Read after `rollouts` (Stream.concat), so `known` is complete by then.
      const history = Stream.unwrap(
        fs.exists(historyFile).pipe(
          Effect.orElseSucceed(() => false),
          Effect.map((exists) => {
            if (!exists) return Stream.empty
            diag.filesRead++
            return readJsonl(fs, historyFile, jsonlCallbacks(diag)).pipe(
              Stream.map((l) => fromHistory(l.value, known, diag)),
              Stream.filter((r): r is PromptRecord => r !== undefined),
            )
          }),
        ),
      )
      const records = yield* Stream.runCollect(Stream.concat(rollouts, history))
      return {
        records,
        diagnostics: diag.snapshot(),
        events: allEvents,
        skillDescriptions: Object.fromEntries(listings.map((l) => [l.name, l.description])),
        skillOrigins: Object.fromEntries(listings.map((l) => [l.name, l.origin])),
      }
    })

    return {
      id: SOURCE,
      displayName: "Codex",
      locations: [sessionsDir, historyFile],
      read,
    }
  })
