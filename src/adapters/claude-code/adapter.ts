import { DateTime, Effect, FileSystem, Option, Path, Schema, Stream } from "effect"
import type { Origin } from "../../domain/Source.ts"
import type { PromptRecord } from "../../domain/PromptRecord.ts"
import type { SourceAdapter } from "../../domain/SourceAdapter.ts"
import { isAnalysisPrompt } from "../../domain/markers.ts"
import { DiagnosticsCollector } from "../common/diagnostics.ts"
import { listDir } from "../common/fs.ts"
import { readJsonl } from "../common/jsonl.ts"
import { firstMatch, slashCommandName } from "../common/rules.ts"
import { CLAUDE_RULES, type ClaudeCandidate } from "./rules.ts"
import { ClaudeLine, HistoryLine } from "./schema.ts"

const SOURCE = "claude-code" as const
const READ_CONCURRENCY = 8

const decodeLine = Schema.decodeUnknownOption(ClaudeLine)
const decodeHistory = Schema.decodeUnknownOption(HistoryLine)

export const resolveClaudeRoot = (
  env: Readonly<Record<string, string | undefined>>,
  home: string,
  path: Path.Path,
): string => env["CLAUDE_CONFIG_DIR"] || path.join(home, ".claude")

export const toOrigin = (entrypoint: string | null | undefined): Origin =>
  entrypoint === "cli" ? "interactive" : entrypoint?.startsWith("sdk") ? "sdk" : "unknown"

/** Extract user-typed text and image flag from `message.content`. */
export const extractContent = (
  content: unknown,
): { text: string; hasImage: boolean; toolResultOnly: boolean } => {
  if (typeof content === "string") return { text: content, hasImage: false, toolResultOnly: false }
  if (!Array.isArray(content)) return { text: "", hasImage: false, toolResultOnly: false }
  const parts = content.filter(
    (p): p is { type?: unknown; text?: unknown } => typeof p === "object" && p !== null,
  )
  const texts = parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
  const hasImage = parts.some((p) => p.type === "image")
  const toolResultOnly = parts.length > 0 && parts.every((p) => p.type === "tool_result")
  return { text: texts.join("\n"), hasImage, toolResultOnly }
}

const parseTimestamp = (ts: string | number | undefined): DateTime.Utc | undefined =>
  ts === undefined ? undefined : Option.getOrUndefined(DateTime.make(ts))

/** Replace `[Pasted text #N …]` placeholders with the pasted content when available. */
export const restorePasted = (
  display: string,
  pasted: unknown,
): { text: string; hasImage: boolean } => {
  const contents = (typeof pasted === "object" && pasted !== null ? pasted : {}) as Record<
    string,
    { type?: unknown; content?: unknown } | undefined
  >
  let hasImage = /\[Image #\d+\]/.test(display)
  const text = display.replace(/\[Pasted text #(\d+)[^\]]*\]/g, (match, n: string) => {
    const entry = contents[n]
    return entry?.type === "text" && typeof entry.content === "string" ? entry.content : match
  })
  for (const entry of Object.values(contents)) if (entry?.type === "image") hasImage = true
  return { text, hasImage }
}

export const makeClaudeCodeAdapter = (
  root: string,
): Effect.Effect<SourceAdapter, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const projectsDir = path.join(root, "projects")
    const historyFile = path.join(root, "history.jsonl")
    let diag = new DiagnosticsCollector()

    /** Top-level session files only: `projects/<project>/<session>.jsonl`. Subagent
     * transcripts live in `<session>/subagents/` and are sidechains by definition. */
    const sessionFiles = Effect.gen(function* () {
      const files: Array<string> = []
      for (const dir of (yield* listDir(fs, projectsDir)).toSorted()) {
        for (const name of (yield* listDir(fs, path.join(projectsDir, dir))).toSorted()) {
          if (name.endsWith(".jsonl")) files.push(path.join(projectsDir, dir, name))
        }
      }
      return files
    })

    const fromProjectLine = (value: unknown, seenUuids: Set<string>): PromptRecord | undefined => {
      const decoded = decodeLine(value)
      if (Option.isNone(decoded)) {
        diag.badLines++
        return undefined
      }
      const line = decoded.value
      if (line.type !== "user") return undefined
      const { text, hasImage, toolResultOnly } = extractContent(line.message?.content)
      const candidate: ClaudeCandidate = { line, text, hasImage, toolResultOnly }
      const slash = text.trimStart().startsWith("<command-name>") ? slashCommandName(text) : null
      if (slash !== null && line.isSidechain !== true) diag.slashCommand(slash)
      const rule = firstMatch(CLAUDE_RULES, candidate)
      if (rule) {
        diag.exclude(rule.name)
        return undefined
      }
      const timestamp = parseTimestamp(line.timestamp)
      if (line.uuid === undefined || line.sessionId === undefined || timestamp === undefined) {
        diag.badLines++
        return undefined
      }
      if (seenUuids.has(line.uuid)) {
        diag.exclude("duplicate-uuid")
        return undefined
      }
      seenUuids.add(line.uuid)
      return {
        id: `${SOURCE}:${line.sessionId}:${line.uuid}`,
        source: SOURCE,
        sessionId: line.sessionId,
        timestamp,
        project: line.cwd ?? null,
        gitBranch: line.gitBranch ?? null,
        text,
        hasImage,
        origin: toOrigin(line.entrypoint),
        client: line.entrypoint ?? null,
      }
    }

    const fromHistoryLine = (
      value: unknown,
      knownSessions: ReadonlySet<string>,
    ): PromptRecord | undefined => {
      const decoded = decodeHistory(value)
      if (Option.isNone(decoded)) {
        diag.badLines++
        return undefined
      }
      const h = decoded.value
      if (h.sessionId === undefined || knownSessions.has(h.sessionId)) return undefined
      const slash = slashCommandName(h.display)
      if (slash !== null) {
        diag.slashCommand(slash)
        diag.exclude("slash-command")
        return undefined
      }
      const { text, hasImage } = restorePasted(h.display, h.pastedContents)
      if (isAnalysisPrompt(text)) {
        diag.exclude("analysis-marker")
        return undefined
      }
      if (text.trim() === "" && !hasImage) {
        diag.exclude("empty")
        return undefined
      }
      const timestamp = parseTimestamp(h.timestamp)
      if (timestamp === undefined) {
        diag.badLines++
        return undefined
      }
      return {
        id: `${SOURCE}:${h.sessionId}:h${h.timestamp}`,
        source: SOURCE,
        sessionId: h.sessionId,
        timestamp,
        project: h.project ?? null,
        gitBranch: null,
        text,
        hasImage,
        origin: "interactive",
        client: "history",
      }
    }

    const read: Stream.Stream<PromptRecord> = Stream.unwrap(
      Effect.gen(function* () {
        diag = new DiagnosticsCollector()
        const files = yield* sessionFiles
        const knownSessions = new Set(files.map((f) => path.basename(f, ".jsonl")))
        const seenUuids = new Set<string>()
        const onBadLine = () => void diag.badLines++
        // Files are read concurrently but processed in path order, so cross-file uuid
        // dedup is deterministic.
        const projects = Stream.fromIterable(files).pipe(
          Stream.mapEffect(
            (file) => {
              diag.filesRead++
              return Stream.runCollect(readJsonl(fs, file, { onBadLine, prefilter: '"user"' }))
            },
            { concurrency: READ_CONCURRENCY },
          ),
          Stream.flatMap((lines) => Stream.fromIterable(lines)),
          Stream.map((l) => fromProjectLine(l.value, seenUuids)),
        )
        const history = Stream.suspend(() => {
          // Sessions that appeared inside files (e.g. resumed into another file) also count.
          return Stream.unwrap(
            fs.exists(historyFile).pipe(
              Effect.orElseSucceed(() => false),
              Effect.map((exists) => {
                if (!exists) return Stream.empty
                diag.filesRead++
                return readJsonl(fs, historyFile, { onBadLine }).pipe(
                  Stream.map((l) => fromHistoryLine(l.value, knownSessions)),
                )
              }),
            ),
          )
        })
        return Stream.concat(projects, history).pipe(
          Stream.filter((r): r is PromptRecord => r !== undefined),
        )
      }),
    )

    return {
      id: SOURCE,
      displayName: "Claude Code",
      locations: Effect.succeed([projectsDir, historyFile]),
      read,
      diagnostics: Effect.sync(() => diag.snapshot()),
    }
  })
