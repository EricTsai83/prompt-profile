import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Path, Stream } from "effect"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  makeCodexAdapter,
  resolveCodexRoot,
  toCandidate,
} from "../../src/adapters/codex/adapter.ts"
import { codexOrigin, MESSAGE_RULES, SESSION_RULES } from "../../src/adapters/codex/rules.ts"
import { firstMatch } from "../../src/adapters/common/rules.ts"
import { makeAdapters, readAll } from "../../src/adapters/registry.ts"
import { fixtureDir, readAllSorted } from "./helpers.ts"

describe("Codex filter rules", () => {
  it.each([
    ["<environment_context>…", "injected-content"],
    ["<user_action>…", "injected-content"],
    ["<guardian_tool_descriptions>…", "injected-content"],
    ["<user_instructions>…", "injected-content"],
    ["# AGENTS.md instructions for /x", "injected-content"],
    ["# AGENTS", "injected-content"],
    ["[prompt-profile:analysis]\nx", "analysis-marker"],
    ["   ", "empty"],
  ] as const)("%s → %s", (text, rule) => {
    expect(firstMatch(MESSAGE_RULES, toCandidate([{ type: "input_text", text }]))?.name).toBe(rule)
  })

  it("keeps user text next to injected blocks", () => {
    const c = toCandidate([
      { type: "input_text", text: "<environment_context>x" },
      { type: "input_text", text: "real prompt" },
    ])
    expect(c).toEqual({ text: "real prompt", hasImage: false, injectedBlocks: 1 })
    expect(firstMatch(MESSAGE_RULES, c)).toBeUndefined()
  })

  it("excludes subagent sessions", () => {
    expect(firstMatch(SESSION_RULES, { source: { subagent: "review" } })?.name).toBe(
      "subagent-session",
    )
    expect(firstMatch(SESSION_RULES, { source: "exec" })).toBeUndefined()
  })

  it.each([
    [{ originator: "T3 Code", source: "exec" }, "sdk"],
    [{ originator: "T3 Code", source: "vscode" }, "sdk"],
    [{ originator: "codex_exec", source: "exec" }, "exec"],
    [{ originator: "codex_cli_rs", source: "cli" }, "interactive"],
    [{ originator: "codex_vscode", source: "vscode" }, "interactive"],
    [{ originator: "codex_exec", source: "mcp" }, "unknown"],
    [undefined, "unknown"],
  ] as const)("origin %j → %s", (meta, origin) => {
    expect(codexOrigin(meta)).toBe(origin)
  })
})

describe("Codex adapter (fixture)", () => {
  it.effect("parses the fixture directory", () =>
    Effect.gen(function* () {
      const adapter = yield* makeCodexAdapter(fixtureDir("codex"))
      const records = yield* readAllSorted(adapter)
      expect(records).toMatchSnapshot("records")
      const diagnostics = yield* adapter.diagnostics
      expect(diagnostics).toMatchSnapshot("diagnostics")
      const texts = records.map((r) => r.text)
      expect(texts.filter((t) => t.startsWith("幫我重構"))).toHaveLength(1)
      expect(texts).toContain("still broken, try again")
      expect(texts).toContain("history-only prompt from a deleted session")
      expect(texts).not.toContain("Review the diff for bugs")
      expect(records.find((r) => r.text === "看一下這張截圖")?.hasImage).toBe(true)
      expect(records.find((r) => r.text.startsWith("legacy"))?.id).toMatch(/:2$/)
      expect(records.find((r) => r.text.startsWith("history-only"))?.timestamp).toBe(
        "2026-05-28T20:26:40.000Z",
      )
      expect(diagnostics.badLines).toBe(2)
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("a message copied into another rollout file (resume / fork) is kept once", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-codex-"))
      const day = join(root, "sessions", "2026", "09", "03")
      mkdirSync(day, { recursive: true })
      const user = (ts: string, text: string, ordinal: number) =>
        JSON.stringify({
          timestamp: ts,
          type: "response_item",
          ordinal,
          payload: { type: "message", role: "user", content: [{ type: "input_text", text }] },
        })
      const rollout = (id: string, lines: ReadonlyArray<string>) => {
        const meta = JSON.stringify({ type: "session_meta", payload: { id, source: "cli" } })
        writeFileSync(
          join(day, `rollout-2026-09-03T15-00-00-${id}.jsonl`),
          [meta, ...lines].join("\n"),
        )
      }
      rollout("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", [
        user("2026-09-03T15:01:00.000Z", "original", 1),
      ])
      rollout("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", [
        user("2026-09-03T15:01:00.000Z", "original", 1),
        user("2026-09-03T16:00:00.000Z", "new after resume", 2),
      ])
      const adapter = yield* makeCodexAdapter(root)
      const records = yield* readAllSorted(adapter)
      expect(records.map((r) => [r.sessionId.slice(0, 1), r.text])).toEqual([
        ["a", "original"],
        ["b", "new after resume"],
      ])
      expect((yield* adapter.diagnostics).excluded).toEqual({ "duplicate-message": 1 })
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("missing directory → empty stream; CODEX_HOME override", () =>
    Effect.gen(function* () {
      const adapter = yield* makeCodexAdapter("/definitely/not/here")
      expect(yield* readAllSorted(adapter)).toEqual([])
      const path = yield* Path.Path
      expect(resolveCodexRoot({ CODEX_HOME: "/c" }, "/home/x", path)).toBe("/c")
      expect(resolveCodexRoot({}, "/home/x", path)).toBe("/home/x/.codex")
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})

describe("registry", () => {
  it.effect("readAll merges both sources", () =>
    Effect.gen(function* () {
      const adapters = yield* makeAdapters({
        home: "/nowhere",
        env: { CLAUDE_CONFIG_DIR: fixtureDir("claude-code"), CODEX_HOME: fixtureDir("codex") },
      })
      expect(adapters.map((a) => a.id)).toEqual(["claude-code", "codex"])
      const records = yield* Stream.runCollect(readAll(adapters))
      expect(new Set(records.map((r) => r.source))).toEqual(new Set(["claude-code", "codex"]))
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
