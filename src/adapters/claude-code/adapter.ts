import { DateTime, Effect, FileSystem, Option, Path, Schema, Stream } from "effect"
import {
  type Origin,
  type PromptRecord,
  type SourceAdapter,
  type SourceRead,
  isAnalysisPrompt,
  type TechniqueEvent,
  type ServiceTier,
  type TokenCounts,
  type UsageEvent,
} from "../../domain/index.ts"
import { DiagnosticsCollector, jsonlCallbacks } from "../common/diagnostics.ts"
import { listDir } from "../common/fs.ts"
import { readJsonl } from "../common/jsonl.ts"
import { techniqueOfTool, toolDetail } from "../common/techniques.ts"
import { parseSkillListing } from "./skills.ts"
import { createHash } from "node:crypto"
import { firstMatch, slashCommandName } from "../common/rules.ts"
import { CLAUDE_RULES, type ClaudeCandidate } from "./rules.ts"
import { ClaudeLine, HistoryLine, responseOf, usageCounts } from "./schema.ts"
import { readClaudePlanHint } from "./plan.ts"

const SOURCE = "claude-code" as const
const READ_CONCURRENCY = 8

const decodeLine = Schema.decodeUnknownOption(ClaudeLine)
const decodeHistory = Schema.decodeUnknownOption(HistoryLine)

export const resolveClaudeRoot = (
  env: Readonly<Record<string, string | undefined>>,
  home: string,
  path: Path.Path,
): string => env["CLAUDE_CONFIG_DIR"] || path.join(home, ".claude")

/** Claude Code's config file: inside CLAUDE_CONFIG_DIR when set, otherwise `~/.claude.json`. */
export const resolveClaudeConfigFile = (
  env: Readonly<Record<string, string | undefined>>,
  home: string,
  path: Path.Path,
): string =>
  env["CLAUDE_CONFIG_DIR"]
    ? path.join(env["CLAUDE_CONFIG_DIR"], ".claude.json")
    : path.join(home, ".claude.json")

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
  readonly skillDescriptions: Map<string, { ms: number; description: string }>
  /** Sessions of prompt-profile's own analysis calls: their usage is left out. */
  readonly markerSessions: Set<string>
  readonly usage: { badLines: number; duplicates: number }
}

/** A response's usage; `key` (message id + request id) identifies copies of one response. */
interface UsageCandidate {
  readonly key: string | null
  readonly event: UsageEvent
}

/**
 * The usage of an assistant line. Synthetic messages are not API responses. A cache write is
 * split into 5-minute and 1-hour writes when the line says so; the rest has an unknown duration.
 */
/** `usage.speed`: "fast" is fast mode; missing or "standard" is standard; anything else unknown. */
const tierOf = (speed: unknown): ServiceTier =>
  speed === "fast"
    ? "fast"
    : speed === undefined || speed === null || speed === "standard"
      ? "standard"
      : "other"

const usageOf = (
  line: ClaudeLine,
  value: unknown,
  state: ReadState,
): UsageCandidate | undefined => {
  if (line.type !== "assistant") return undefined
  const response = responseOf(value)
  if (response.usage === undefined) return undefined
  const model = typeof line.message?.model === "string" ? line.message.model : null
  if (model === "<synthetic>") return undefined
  const u = usageCounts(response.usage)
  const ms = line.timestamp === undefined ? Number.NaN : Date.parse(line.timestamp)
  if (u === null || line.sessionId === undefined || Number.isNaN(ms)) {
    state.usage.badLines++
    return undefined
  }
  const tokens: TokenCounts = {
    input: u.input,
    output: u.output,
    cacheRead: u.cacheRead,
    cacheWrite5m: u.cache5m,
    cacheWrite1h: u.cache1h,
    cacheWriteUnknown: Math.max(0, u.cacheCreation - u.cache5m - u.cache1h),
    reasoning: 0,
  }
  const { id, requestId } = response
  return {
    key: typeof id === "string" && typeof requestId === "string" ? `${id}\u0000${requestId}` : null,
    event: {
      source: SOURCE,
      sessionId: line.sessionId,
      timestampMs: ms,
      model,
      tokens,
      tier: tierOf((response.usage as { speed?: unknown }).speed),
    },
  }
}

/** Lines that can carry a workflow technique; everything else is skipped unparsed. */
const TECHNIQUE_NEEDLES = [
  '"tool_use"',
  '"pr-link"',
  '"worktree-state"',
  '"permissionMode"',
  '"skill_listing"',
]

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
  // skill names and descriptions the agent was offered; the latest listing wins
  const att = line.attachment as { type?: unknown; content?: unknown } | undefined
  if (
    line.type === "attachment" &&
    att?.type === "skill_listing" &&
    typeof att.content === "string"
  ) {
    for (const [name, description] of parseSkillListing(att.content)) {
      const seen = state.skillDescriptions.get(name)
      if (seen === undefined || seen.ms <= file.lastMs)
        state.skillDescriptions.set(name, { ms: file.lastMs, description })
    }
  }
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

/** `readJsonl` callbacks that also count a broken line mentioning usage as lost usage. */
const usageCallbacks = (diag: DiagnosticsCollector, state: ReadState) => ({
  ...jsonlCallbacks(diag),
  onBadLine: (raw: string) => {
    diag.badLines++
    if (raw.includes('"usage"')) state.usage.badLines++
  },
})

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
  /** Default: `<root>/.claude.json`. */
  configFile?: string,
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

    /** Subagent transcripts, `projects/<project>/<session>/subagents/*.jsonl`: usage only. */
    const subagentFiles = Effect.gen(function* () {
      const files: Array<string> = []
      for (const dir of (yield* listDir(fs, projectsDir)).toSorted()) {
        for (const session of (yield* listDir(fs, path.join(projectsDir, dir))).toSorted()) {
          const sub = path.join(projectsDir, dir, session, "subagents")
          for (const name of (yield* listDir(fs, sub)).toSorted())
            if (name.endsWith(".jsonl")) files.push(path.join(sub, name))
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
        if (rule.name === "analysis-marker" && line.sessionId !== undefined)
          state.markerSessions.add(line.sessionId)
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
        state.markerSessions.add(h.sessionId)
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
        skillDescriptions: new Map(),
        markerSessions: new Set(),
        usage: { badLines: 0, duplicates: 0 },
      }
      const { diag } = state
      // Files are read and parsed concurrently — each line is reduced to a small record right
      // away, so big tool results are not kept — but de-duplicated in path order, so the
      // copy kept for a uuid is deterministic.
      // Usage copies are de-duplicated in path order too: subagent files after the sessions.
      // A response's first copy is written while it streams, so its output count can still be
      // low: the copy with the most output (the final count) is the one kept.
      const responseIndex = new Map<string, number>()
      const usageEvents: Array<UsageEvent> = []
      const keepUsage = (usage: ReadonlyArray<UsageCandidate>) => {
        for (const { key, event } of usage) {
          const at = key === null ? undefined : responseIndex.get(key)
          if (at === undefined) {
            if (key !== null) responseIndex.set(key, usageEvents.length)
            usageEvents.push(event)
            continue
          }
          state.usage.duplicates++
          const kept = usageEvents[at]!
          if (event.tokens.output > kept.tokens.output)
            usageEvents[at] = { ...kept, tokens: { ...kept.tokens, output: event.tokens.output } }
        }
      }
      const projects = Stream.fromIterable(files).pipe(
        Stream.mapEffect(
          (file) => {
            diag.filesRead++
            const fileState = { lastMs: null as number | null }
            const usage: Array<UsageCandidate> = []
            return readJsonl(fs, file, {
              ...usageCallbacks(diag, state),
              // "usage" last: a line found by it alone carries no technique
              prefilter: ['"user"', ...TECHNIQUE_NEEDLES, '"usage"'],
            }).pipe(
              Stream.map((l) => {
                const decoded = decodeLine(l.value)
                if (Option.isSome(decoded)) {
                  // only the lines techniques were read from before usage was added
                  if (l.needle !== '"usage"') noteTechniques(decoded.value, fileState, state)
                  const u = usageOf(decoded.value, l.value, state)
                  if (u !== undefined) usage.push(u)
                }
                // prompts (and known sessions) come only from lines mentioning "user", as before
                return l.raw.includes('"user"') ? fromProjectLine(l.value, state) : undefined
              }),
              Stream.filter((c) => c !== undefined),
              Stream.runCollect,
              Effect.map((candidates) => ({ candidates, usage })),
            )
          },
          { concurrency: READ_CONCURRENCY },
        ),
        Stream.flatMap(({ candidates, usage }) => {
          keepUsage(usage)
          return Stream.fromIterable(candidates)
        }),
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
      // read alongside the sessions; kept after them, so the copy kept is deterministic
      const readSubagents = Stream.fromIterable(yield* subagentFiles).pipe(
        Stream.mapEffect(
          (file) => {
            diag.filesRead++
            return readJsonl(fs, file, {
              ...usageCallbacks(diag, state),
              prefilter: '"usage"',
            }).pipe(
              Stream.map((l) => {
                const decoded = decodeLine(l.value)
                return Option.isSome(decoded) ? usageOf(decoded.value, l.value, state) : undefined
              }),
              Stream.filter((u) => u !== undefined),
              Stream.runCollect,
            )
          },
          { concurrency: READ_CONCURRENCY },
        ),
        Stream.runCollect,
      )
      const readRecords = Stream.runCollect(
        Stream.concat(projects, history).pipe(
          Stream.filter((r): r is PromptRecord => r !== undefined),
        ),
      )
      const [records, subagentUsage] = yield* Effect.all([readRecords, readSubagents], {
        concurrency: 2,
      })
      countSlashCommands(state)
      for (const usage of subagentUsage) keepUsage(usage)
      return {
        records,
        diagnostics: diag.snapshot(),
        events: state.events,
        skillDescriptions: Object.fromEntries(
          [...state.skillDescriptions].map(([name, x]) => [name, x.description]),
        ),
        usage: {
          events: usageEvents.filter((e) => !state.markerSessions.has(e.sessionId)),
          diagnostics: { ...state.usage, markerSessions: state.markerSessions.size },
        },
      }
    })

    return {
      id: SOURCE,
      displayName: "Claude Code",
      locations: [projectsDir, historyFile],
      read,
      plan: readClaudePlanHint(fs, configFile ?? path.join(root, ".claude.json")),
    }
  })
