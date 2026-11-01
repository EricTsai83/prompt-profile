import { NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { expect, it } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeClaudeCodeAdapter } from "../../src/adapters/claude-code/adapter.ts"
import { makeCodexAdapter } from "../../src/adapters/codex/adapter.ts"

const root = () => mkdtempSync(join(tmpdir(), "instruction-fixture-"))
const stamp = "2026-09-03T12:00:00Z"
it("preserves a user slash invocation with its historical Claude skill expansion", async () => {
  const dir = root()
  mkdirSync(join(dir, "projects", "project"), { recursive: true })
  const lines = [
    {
      type: "user",
      sessionId: "s",
      uuid: "u",
      timestamp: stamp,
      message: { content: "<command-name>/review</command-name>" },
    },
    {
      type: "assistant",
      sessionId: "s",
      timestamp: stamp,
      message: {
        content: [{ type: "tool_use", id: "c", name: "Skill", input: { skill: "review" } }],
      },
    },
    {
      type: "user",
      sessionId: "s",
      uuid: "meta",
      timestamp: stamp,
      isMeta: true,
      message: {
        content:
          "Base directory for this skill: /work/.claude/skills/review\n\nRun tests before acceptance.",
      },
    },
  ]
  writeFileSync(
    join(dir, "projects/project/s.jsonl"),
    lines.map((l) => JSON.stringify(l)).join("\n"),
  )
  const read = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* makeClaudeCodeAdapter(dir)).read
    }).pipe(Effect.provide(NodeServices.layer)),
  )
  expect(read.records).toHaveLength(1)
  expect(read.records[0]?.instructionContexts?.[0]).toMatchObject({
    selection: "user_explicit",

    content: "Run tests before acceptance.",
  })
})
it("links a Codex read result to its user trigger while ignoring unrelated output", async () => {
  const dir = root()
  mkdirSync(join(dir, "sessions"), { recursive: true })
  const lines = [
    { type: "session_meta", payload: { id: "s", source: "cli", cwd: "/work" } },
    {
      type: "response_item",
      payload: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Use $review to check the menu." }],
      },
    },
    {
      type: "response_item",
      payload: {
        type: "function_call",
        name: "exec_command",
        call_id: "c",
        arguments: JSON.stringify({ cmd: "cat /work/.agents/skills/review/SKILL.md" }),
      },
    },
    {
      type: "response_item",
      payload: { type: "function_call_output", call_id: "wrong", output: "Not the selected file." },
    },
    {
      type: "response_item",
      payload: {
        type: "function_call_output",
        call_id: "c",
        output: "Check bounds before accepting changes.",
      },
    },
  ].map((x) => ({ timestamp: stamp, ...x }))
  writeFileSync(
    join(dir, "sessions/rollout-s.jsonl"),
    lines.map((l) => JSON.stringify(l)).join("\n"),
  )
  const read = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* (yield* makeCodexAdapter(dir)).read
    }).pipe(Effect.provide(NodeServices.layer)),
  )
  expect(read.records).toHaveLength(1)
  expect(read.records[0]?.instructionContexts?.[0]).toMatchObject({
    selection: "user_explicit",
    content: "Check bounds before accepting changes.",
  })
})
