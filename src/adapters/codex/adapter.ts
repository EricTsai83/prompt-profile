import { DateTime, Effect, FileSystem, Option, Path, Schema, Stream } from "effect"
import type { PromptRecord } from "../../domain/PromptRecord.ts"
import type { SourceAdapter } from "../../domain/SourceAdapter.ts"
import { isAnalysisPrompt } from "../../domain/markers.ts"
import { DiagnosticsCollector } from "../common/diagnostics.ts"
import { findFiles } from "../common/fs.ts"
import { readJsonl } from "../common/jsonl.ts"
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

/** Session id from the rollout file name: `rollout-<time>-<uuid>.jsonl`. */
const idFromFileName = (name: string): string | undefined =>
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(name)?.[1]

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
    let diag = new DiagnosticsCollector()

    const readRollout = (
      file: string,
    ): Effect.Effect<{ ids: ReadonlyArray<string>; records: ReadonlyArray<PromptRecord> }> =>
      Effect.gen(function* () {
        diag.filesRead++
        const lines = yield* Stream.runCollect(
          readJsonl(fs, file, { onBadLine: () => void diag.badLines++ }),
        )
        let meta: SessionMeta | undefined
        const fileId = idFromFileName(path.basename(file))
        const records: Array<PromptRecord> = []
        const seen = new Set<string>()
        const userLines: Array<{ ts: string | undefined; ordinal: number; payload: unknown }> = []
        for (const { value, lineNumber } of lines) {
          const outer = decodeRollout(value)
          if (Option.isNone(outer)) {
            diag.badLines++
            continue
          }
          const { type, payload, timestamp, ordinal } = outer.value
          if (type === "session_meta" && meta === undefined) {
            meta = Option.getOrUndefined(decodeMeta(payload))
          } else if (type === "response_item") {
            userLines.push({ ts: timestamp, ordinal: ordinal ?? lineNumber, payload })
          }
        }
        const sessionId = meta?.id ?? fileId
        const ids = [meta?.id, meta?.session_id, fileId].filter((x): x is string => x !== undefined)
        if (sessionId === undefined) return { ids, records }
        const sessionRule = meta ? firstMatch(SESSION_RULES, meta) : undefined
        for (const line of userLines) {
          const msg = decodeUser(line.payload)
          if (Option.isNone(msg)) continue // assistant / developer / tool items
          if (sessionRule) {
            diag.exclude(sessionRule.name)
            continue
          }
          const candidate = toCandidate(msg.value.content)
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
          // a resume may rewrite old messages into a new rollout file
          const key = `${line.ts}\u0000${candidate.text}`
          if (seen.has(key)) {
            diag.exclude("duplicate-message")
            continue
          }
          seen.add(key)
          records.push({
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
          })
        }
        return { ids, records }
      })

    const fromHistory = (value: unknown, known: ReadonlySet<string>): PromptRecord | undefined => {
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

    const read: Stream.Stream<PromptRecord> = Stream.unwrap(
      Effect.gen(function* () {
        diag = new DiagnosticsCollector()
        const files = yield* findFiles(
          fs,
          path,
          sessionsDir,
          (n) => n.startsWith("rollout-") && n.endsWith(".jsonl"),
        )
        const known = new Set<string>()
        for (const f of files) {
          const id = idFromFileName(path.basename(f))
          if (id) known.add(id)
        }
        const rollouts = Stream.fromIterable(files).pipe(
          Stream.mapEffect(readRollout, { concurrency: READ_CONCURRENCY }),
          Stream.flatMap(({ ids, records }) => {
            for (const id of ids) known.add(id)
            return Stream.fromIterable(records)
          }),
        )
        const history = Stream.unwrap(
          fs.exists(historyFile).pipe(
            Effect.orElseSucceed(() => false),
            Effect.map((exists) => {
              if (!exists) return Stream.empty
              diag.filesRead++
              return readJsonl(fs, historyFile, { onBadLine: () => void diag.badLines++ }).pipe(
                Stream.map((l) => fromHistory(l.value, known)),
                Stream.filter((r): r is PromptRecord => r !== undefined),
              )
            }),
          ),
        )
        return Stream.concat(rollouts, history)
      }),
    )

    return {
      id: SOURCE,
      displayName: "Codex",
      locations: Effect.succeed([sessionsDir, historyFile]),
      read,
      diagnostics: Effect.sync(() => diag.snapshot()),
    }
  })
