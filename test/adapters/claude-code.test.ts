import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Path } from "effect"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  extractContent,
  makeClaudeCodeAdapter,
  resolveClaudeRoot,
  restorePasted,
} from "../../src/adapters/claude-code/adapter.ts"
import { CLAUDE_RULES, type ClaudeCandidate } from "../../src/adapters/claude-code/rules.ts"
import { firstMatch, slashCommandName } from "../../src/adapters/common/rules.ts"
import { fixtureDir, readSorted } from "./helpers.ts"

const candidate = (line: Record<string, unknown>, text = "hello"): ClaudeCandidate => ({
  line: { type: "user", ...line },
  text,
  hasImage: false,
  toolResultOnly: false,
})

describe("Claude Code filter rules", () => {
  it.each([
    ["tool-result-only", { ...candidate({}), toolResultOnly: true }],
    ["sidechain", candidate({ isSidechain: true })],
    ["meta", candidate({ isMeta: true })],
    ["compact-summary", candidate({ isCompactSummary: true })],
    ["system-notification", candidate({ promptSource: "system" })],
    ["system-notification", candidate({ turnOrigin: "task_notification" })],
    ["system-notification", candidate({ origin: { kind: "task-notification" } })],
    ["automated-turn", candidate({ turnOrigin: "scheduled" })],
    ["automated-turn", candidate({ turnOrigin: "peer" })],
    ["slash-command", candidate({}, "<command-name>/clear</command-name>")],
    ["injected-content", candidate({}, "<task-notification>x</task-notification>")],
    ["injected-content", candidate({}, "<local-command-caveat>x")],
    ["injected-content", candidate({}, "<local-command-stdout>x")],
    ["injected-content", candidate({}, "  <system-reminder>x")],
    ["analysis-marker", candidate({}, "[prompt-profile:analysis]\nfoo")],
    ["empty", candidate({}, "  \n ")],
  ] as const)("%s", (name, c) => {
    expect(firstMatch(CLAUDE_RULES, c)?.name).toBe(name)
  })

  it.each([
    ["plain prompt", candidate({ entrypoint: "cli" })],
    ["sdk prompt", candidate({ entrypoint: "sdk-ts", promptSource: "sdk", turnOrigin: "sdk" })],
    ["marker mentioned mid-text", candidate({}, "why skip [prompt-profile:analysis] prompts?")],
  ] as const)("keeps %s", (_name, c) => {
    expect(firstMatch(CLAUDE_RULES, c)).toBeUndefined()
  })
})

describe("helpers", () => {
  it("extracts text and image from array content", () => {
    expect(
      extractContent([{ type: "text", text: "a" }, { type: "image" }, { type: "text", text: "b" }]),
    ).toEqual({ text: "a\nb", hasImage: true, toolResultOnly: false })
    expect(extractContent([{ type: "tool_result" }]).toolResultOnly).toBe(true)
  })

  it("restores pasted text", () => {
    expect(
      restorePasted("see [Pasted text #2 +3 lines] ok", { "2": { type: "text", content: "X" } }),
    ).toEqual({ text: "see X ok", hasImage: false })
    expect(restorePasted("[Pasted text #9]", {}).text).toBe("[Pasted text #9]")
    expect(restorePasted("[Image #1] hi", {}).hasImage).toBe(true)
  })

  it.each([
    ["/clear", "/clear"],
    ["/model opus", "/model"],
    ["<command-name>/opsx:apply</command-name>", "/opsx:apply"],
    ["/Users/dev/file.ts broken", null],
    ["hello /clear", null],
  ] as const)("slashCommandName(%s)", (text, name) => {
    expect(slashCommandName(text)).toBe(name)
  })

  it.effect("CLAUDE_CONFIG_DIR overrides ~/.claude", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path
      expect(resolveClaudeRoot({ CLAUDE_CONFIG_DIR: "/custom" }, "/home/x", path)).toBe("/custom")
      expect(resolveClaudeRoot({}, "/home/x", path)).toBe("/home/x/.claude")
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})

describe("Claude Code adapter (fixture)", () => {
  it.effect("parses the fixture directory", () =>
    Effect.gen(function* () {
      const adapter = yield* makeClaudeCodeAdapter(fixtureDir("claude-code"))
      const { records, diagnostics } = yield* readSorted(adapter)
      expect(records).toMatchSnapshot("records")
      expect(diagnostics).toMatchSnapshot("diagnostics")

      const texts = records.map((r) => r.text)
      // session-level dedup: sess-a exists in projects/ → its history line is ignored
      expect(texts.filter((t) => t === "請幫我把這個函式改成 async")).toHaveLength(1)
      // history-only session is restored, pasted content expanded
      expect(texts).toContain("look at this log line1\nline2\nline3 and fix it")
      // a path is not a slash command
      expect(texts.some((t) => t.startsWith("/Users/dev/old"))).toBe(true)
      // subagent transcripts are not read
      expect(texts).not.toContain("subagent file prompt")
      // duplicate uuid (same file and across files) kept once
      expect(records.filter((r) => r.id.endsWith(":u01"))).toHaveLength(1)
      expect(diagnostics.slashCommands).toEqual({ "/clear": 2, "/model": 1 })
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("history of a session resumed into another file is not double counted", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-claude-"))
      mkdirSync(join(root, "projects", "p"), { recursive: true })
      const line = {
        type: "user",
        sessionId: "sess-old",
        uuid: "u1",
        timestamp: "2026-09-03T15:01:00.000Z",
        entrypoint: "cli",
        message: { content: "resumed prompt" },
      }
      writeFileSync(join(root, "projects", "p", "sess-new.jsonl"), `${JSON.stringify(line)}\n`)
      const history = { display: "resumed prompt", timestamp: 1788447660000, sessionId: "sess-old" }
      writeFileSync(join(root, "history.jsonl"), `${JSON.stringify(history)}\n`)
      const { records } = yield* readSorted(yield* makeClaudeCodeAdapter(root))
      expect(records.map((r) => r.text)).toEqual(["resumed prompt"])
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("slash commands of sessions without any prompt are not counted (automation)", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-claude-"))
      const history = [
        // a tool polling /usage, one fresh session each time
        ...[1, 2, 3].map((i) => ({
          display: "/usage",
          timestamp: 1788447660000 + i,
          sessionId: `poll-${i}`,
        })),
        // a person: a command and a prompt in the same session
        { display: "/clear", timestamp: 1788447670000, sessionId: "human" },
        { display: "please refactor this module", timestamp: 1788447680000, sessionId: "human" },
      ]
      writeFileSync(join(root, "history.jsonl"), history.map((h) => JSON.stringify(h)).join("\n"))
      const { records, diagnostics } = yield* readSorted(yield* makeClaudeCodeAdapter(root))
      expect(records.map((r) => r.text)).toEqual(["please refactor this module"])
      expect(diagnostics.slashCommands).toEqual({ "/clear": 1 })
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("reports workflow techniques from metadata, never from content", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-claude-"))
      mkdirSync(join(root, "projects", "p"), { recursive: true })
      const base = { sessionId: "s1", isSidechain: false }
      const tool = (name: string, ts: string, extra: object = {}) => ({
        ...base,
        ...extra,
        type: "assistant",
        timestamp: ts,
        message: { content: [{ type: "tool_use", id: "t", name, input: { prompt: "secret" } }] },
      })
      const lines = [
        {
          ...base,
          type: "user",
          uuid: "u1",
          timestamp: "2026-09-03T15:00:00.000Z",
          permissionMode: "plan",
          message: { content: "plan the change" },
        },
        tool("Agent", "2026-09-03T15:01:00.000Z"),
        tool("Bash", "2026-09-03T15:02:00.000Z"),
        tool("Skill", "2026-09-03T15:03:00.000Z", { isSidechain: true }),
        tool("mcp__linear__create_issue", "2026-09-03T15:04:00.000Z"),
        {
          ...base,
          type: "pr-link",
          prUrl: "https://example.test/pr/1",
          timestamp: "2026-09-03T15:05:00.000Z",
        },
        {
          ...base,
          type: "pr-link",
          prUrl: "https://example.test/pr/1",
          timestamp: "2026-09-03T15:06:00.000Z",
        },
        { ...base, type: "worktree-state", worktreeSession: {} },
        { ...base, type: "worktree-state", worktreeSession: null },
      ]
      writeFileSync(
        join(root, "projects", "p", "s1.jsonl"),
        lines.map((l) => JSON.stringify(l)).join("\n"),
      )
      const read = yield* (yield* makeClaudeCodeAdapter(root)).read
      expect(
        read.events.map((e) => [e.kind, new Date(e.timestampMs).toISOString().slice(11, 16)]),
      ).toEqual([
        ["planMode", "15:00"],
        ["subagents", "15:01"],
        ["mcp", "15:04"],
        ["pullRequests", "15:05"],
        // no timestamp of its own: the last one seen in the file
        ["worktrees", "15:06"],
      ])
      expect(JSON.stringify(read.events)).not.toContain("secret")
      expect(JSON.stringify(read.events)).not.toContain("example.test")
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("missing directory → empty stream", () =>
    Effect.gen(function* () {
      const adapter = yield* makeClaudeCodeAdapter("/definitely/not/here")
      const { records, diagnostics } = yield* readSorted(adapter)
      expect(records).toEqual([])
      expect(diagnostics.filesRead).toBe(0)
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
