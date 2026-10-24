import { DateTime, Effect, FileSystem, Option, Path, Schema, Stream } from "effect"
import type { Origin } from "../../domain/Source.ts"
import type { PromptRecord } from "../../domain/PromptRecord.ts"
import type { SourceAdapter, SourceRead } from "../../domain/SourceAdapter.ts"
import { isAnalysisPrompt } from "../../domain/markers.ts"
import { DiagnosticsCollector, jsonlCallbacks } from "../common/diagnostics.ts"
import { listDir } from "../common/fs.ts"
import { readJsonl } from "../common/jsonl.ts"
import { techniqueOfTool, toolDetail } from "../common/techniques.ts"
import type { TechniqueEvent } from "../../domain/Techniques.ts"
import { createHash } from "node:crypto"
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

/** Mutable state of one `read` (each read gets its own: reads may run concurrently). */
interface ReadState {
  readonly diag: DiagnosticsCollector
  /** Sessions with a transcript: their history.jsonl entries are skipped. */
  readonly knownSessions: Set<string>
  readonly seenUuids: Set<string>
  /** Slash commands per session; counted at the end, for sessions with a prompt only. */
  readonly slashCommands: Map<string, Array<string>>
  readonly sessionsWithPrompts: Set<string>
  /** Workflow technique uses (plan 17), and pull requests already counted (by URL hash). */
  readonly events: Array<TechniqueEvent>
  readonly seenPullRequests: Set<string>
  readonly worktreeSessions: Set<string>
  readonly transcriptSessions: Set<string>
  readonly modelSessions: Set<string>
}

/** Lines that can carry a workflow technique; everything else is skipped unparsed. */
const TECHNIQUE_NEEDLES = ['"tool_use"', '"pr-link"', '"worktree-state"', '"permissionMode"']

/**
 * Workflow techniques of one line: tool names, plan mode, PR links, worktrees. Subagent
 * (sidechain) lines are the agent's own steps, not the user's workflow, and are skipped.
 * `file.lastMs` gives lines without a timestamp the last one seen in the same file.
 */
const noteTechniques = (line: ClaudeLine, file: { lastMs: number | null }, state: ReadState) => {
  const ms = line.timestamp === undefined ? null : Date.parse(line.timestamp)
  if (ms !== null && !Number.isNaN(ms)) file.lastMs = ms
  if (line.isSidechain === true || line.sessionId === undefined || file.lastMs === null) return
  const push = (kind: TechniqueEvent["kind"], detail?: string) =>
    state.events.push({
      source: SOURCE,
      sessionId: line.sessionId!,
      timestampMs: file.lastMs!,
      kind,
      ...(detail === undefined ? {} : { detail }),
    })
  // the session has a transcript with metadata: it counts in the workflow denominator
  if (!state.transcriptSessions.has(line.sessionId)) {
    state.transcriptSessions.add(line.sessionId)
    push("transcript")
  }
  if (line.type === "user" && line.permissionMode === "plan") push("planMode")
  if (line.type === "pr-link" && typeof line.prUrl === "string") {
    const key = createHash("sha256").update(line.prUrl).digest("hex")
    if (!state.seenPullRequests.has(key)) {
      state.seenPullRequests.add(key)
      push("pullRequests")
    }
  }
  // repeated on every state change: once per session
  if (line.type === "worktree-state" && !state.worktreeSessions.has(line.sessionId)) {
    state.worktreeSessions.add(line.sessionId)
    push("worktrees")
  }
  const content = line.message?.content
  if (line.type === "assistant") {
    const model = line.message?.model
    if (typeof model === "string" && model !== "<synthetic>") {
      const key = `${line.sessionId}\u0000${model}`
      if (!state.modelSessions.has(key)) {
        state.modelSessions.add(key)
        push("model", model)
      }
    }
  }
  if (line.type === "assistant" && Array.isArray(content)) {
    for (const item of content as ReadonlyArray<unknown>) {
      if (item && typeof item === "object" && (item as { type?: unknown }).type === "tool_use") {
        const { name, input } = item as { name?: unknown; input?: unknown }
        const kind = typeof name === "string" ? techniqueOfTool(name) : undefined
        if (kind && typeof name === "string") {
          const args = (input ?? {}) as Record<string, unknown>
          push(kind, toolDetail(kind, name, args))
          // a subagent running in the background or in its own worktree
          if (kind === "subagents" && args["run_in_background"] === true)
            push("background", "subagent")
          if (kind === "subagents" && args["isolation"] === "worktree")
            push("worktrees", "subagent")
        }
      }
    }
  }
}

const noteSlashCommand = (state: ReadState, sessionId: string, name: string): void => {
  const list = state.slashCommands.get(sessionId) ?? []
  list.push(name)
  state.slashCommands.set(sessionId, list)
}

/**
 * Count slash commands only for sessions that also hold a prompt: a session with nothing
 * but a command is a tool or a script (e.g. polling `/usage` every minute), not the user.
 */
const countSlashCommands = (state: ReadState): void => {
  for (const [sessionId, names] of state.slashCommands) {
    if (state.sessionsWithPrompts.has(sessionId))
      for (const name of names) state.diag.slashCommand(name)
  }
}

export const makeClaudeCodeAdapter = (
  root: string,
): Effect.Effect<SourceAdapter, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const projectsDir = path.join(root, "projects")
    const historyFile = path.join(root, "history.jsonl")

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

    /** A kept prompt with its uuid; uuid de-duplication happens later, in file order. */
    const fromProjectLine = (
      value: unknown,
      state: ReadState,
    ): { readonly uuid: string; readonly record: PromptRecord } | undefined => {
      const { diag, knownSessions } = state
      const decoded = decodeLine(value)
      if (Option.isNone(decoded)) {
        diag.badLines++
        return undefined
      }
      const line = decoded.value
      // A session's transcript may live in another session's file (e.g. after a resume);
      // its history.jsonl entries are then already covered. Only lines that pass the
      // `"user"` prefilter get here, on purpose: a session with no user lines in any
      // transcript still needs history.jsonl to recover its prompts.
      if (line.sessionId !== undefined) knownSessions.add(line.sessionId)
      if (line.type !== "user") return undefined
      const { text, hasImage, toolResultOnly } = extractContent(line.message?.content)
      const candidate: ClaudeCandidate = { line, text, hasImage, toolResultOnly }
      const slash = text.trimStart().startsWith("<command-name>") ? slashCommandName(text) : null
      if (slash !== null && line.isSidechain !== true && line.sessionId !== undefined) {
        noteSlashCommand(state, line.sessionId, slash)
      }
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
      const record: PromptRecord = {
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
      state.sessionsWithPrompts.add(line.sessionId)
      return { uuid: line.uuid, record }
    }

    const fromHistoryLine = (value: unknown, state: ReadState): PromptRecord | undefined => {
      const { diag, knownSessions } = state
      const decoded = decodeHistory(value)
      if (Option.isNone(decoded)) {
        diag.badLines++
        return undefined
      }
      const h = decoded.value
      if (h.sessionId === undefined || knownSessions.has(h.sessionId)) return undefined
      const slash = slashCommandName(h.display)
      if (slash !== null) {
        noteSlashCommand(state, h.sessionId, slash)
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
      state.sessionsWithPrompts.add(h.sessionId)
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

    const read: Effect.Effect<SourceRead> = Effect.gen(function* () {
      const files = yield* sessionFiles
      const state: ReadState = {
        diag: new DiagnosticsCollector(),
        knownSessions: new Set(files.map((f) => path.basename(f, ".jsonl"))),
        seenUuids: new Set(),
        slashCommands: new Map(),
        sessionsWithPrompts: new Set(),
        events: [],
        seenPullRequests: new Set(),
        worktreeSessions: new Set(),
        transcriptSessions: new Set(),
        modelSessions: new Set(),
      }
      const { diag } = state
      // Files are read and parsed concurrently — each line is reduced to a small record right
      // away, so big tool results are not kept — but de-duplicated in path order, so the
      // copy kept for a uuid is deterministic.
      const projects = Stream.fromIterable(files).pipe(
        Stream.mapEffect(
          (file) => {
            diag.filesRead++
            const fileState = { lastMs: null as number | null }
            return readJsonl(fs, file, {
              ...jsonlCallbacks(diag),
              prefilter: ['"user"', ...TECHNIQUE_NEEDLES],
            }).pipe(
              Stream.map((l) => {
                const decoded = decodeLine(l.value)
                if (Option.isSome(decoded)) noteTechniques(decoded.value, fileState, state)
                // prompts (and known sessions) come only from lines mentioning "user", as before
                return l.raw.includes('"user"') ? fromProjectLine(l.value, state) : undefined
              }),
              Stream.filter((c) => c !== undefined),
              Stream.runCollect,
            )
          },
          { concurrency: READ_CONCURRENCY },
        ),
        Stream.flatMap((candidates) => Stream.fromIterable(candidates)),
        Stream.map(({ uuid, record }) => {
          if (state.seenUuids.has(uuid)) {
            diag.exclude("duplicate-uuid")
            return undefined
          }
          state.seenUuids.add(uuid)
          return record
        }),
      )
      // Read after `projects` (Stream.concat), so `knownSessions` is complete by then.
      const history = Stream.unwrap(
        fs.exists(historyFile).pipe(
          Effect.orElseSucceed(() => false),
          Effect.map((exists) => {
            if (!exists) return Stream.empty
            diag.filesRead++
            return readJsonl(fs, historyFile, jsonlCallbacks(diag)).pipe(
              Stream.map((l) => fromHistoryLine(l.value, state)),
            )
          }),
        ),
      )
      const records = yield* Stream.runCollect(
        Stream.concat(projects, history).pipe(
          Stream.filter((r): r is PromptRecord => r !== undefined),
        ),
      )
      countSlashCommands(state)
      return { records, diagnostics: diag.snapshot(), events: state.events }
    })

    return {
      id: SOURCE,
      displayName: "Claude Code",
      locations: [projectsDir, historyFile],
      read,
    }
  })
