import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { zstdCompressSync } from "node:zlib"
import { makeClaudeCodeAdapter } from "../../src/adapters/claude-code/adapter.ts"
import { makeCodexAdapter } from "../../src/adapters/codex/adapter.ts"
import { ZERO_TOKENS, type TokenCounts, type UsageEvent } from "../../src/domain/Usage.ts"
import { fixtureDir } from "./helpers.ts"

const tokens = (t: Partial<TokenCounts>): TokenCounts => ({ ...ZERO_TOKENS, ...t })
const sorted = (events: ReadonlyArray<UsageEvent>) =>
  events.toSorted((a, b) => a.timestampMs - b.timestampMs || a.sessionId.localeCompare(b.sessionId))
const at = (iso: string) => Date.parse(iso)

describe("Claude Code usage", () => {
  const read = Effect.gen(function* () {
    const adapter = yield* makeClaudeCodeAdapter(fixtureDir("usage/claude-code"))
    return yield* adapter.read
  }).pipe(Effect.provide(NodeServices.layer))

  it.effect(
    "one event per response: de-duplicated, subagents included, marker sessions left out",
    () =>
      Effect.gen(function* () {
        const { usage } = yield* read
        const event = (
          iso: string,
          model: string,
          t: Partial<TokenCounts>,
          tier: UsageEvent["tier"] = "standard",
        ): UsageEvent => ({
          source: "claude-code",
          sessionId: "sess-u1",
          timestampMs: at(iso),
          model,
          tokens: tokens(t),
          tier,
        })
        expect(sorted(usage!.events)).toEqual([
          // written twice (one line per content block), counted once, with the final output
          // count: the first copy is written while the response streams (12 → 40)
          event("2026-10-01T01:00:05.000Z", "claude-opus-5-5", {
            input: 100,
            output: 40,
            cacheRead: 1000,
            cacheWrite5m: 200,
            cacheWrite1h: 100,
          }),
          // a side task on another model, from the subagent transcript
          event("2026-10-01T01:00:30.000Z", "claude-haiku-5-5", { input: 20, output: 10 }),
          event("2026-10-01T01:01:00.000Z", "claude-haiku-4-5-20251001", { input: 10, output: 5 }),
          // no request id: kept as it is; it ran in fast mode (`usage.speed: "fast"`)
          event("2026-10-02T02:00:00.000Z", "claude-opus-5-5", { input: 1, output: 2 }, "fast"),
          // an older line without the 5-minute / 1-hour split
          event("2026-10-02T02:01:00.000Z", "claude-opus-5-5", {
            input: 3,
            output: 4,
            cacheWriteUnknown: 50,
          }),
          event("2026-10-02T02:02:00.000Z", "claude-unreleased-9", { input: 7, output: 7 }),
        ])
        // one usage that is not a count, one assistant line cut off while writing
        expect(usage!.diagnostics).toEqual({ badLines: 2, duplicates: 1, markerSessions: 1 })
      }),
  )

  it.effect("usage reading does not change the prompts that are read", () =>
    Effect.gen(function* () {
      const { records } = yield* read
      expect(records.map((r) => r.text)).toEqual(["add a retry to the fetch helper"])
    }),
  )
})

describe("Codex usage", () => {
  const read = Effect.gen(function* () {
    const adapter = yield* makeCodexAdapter(fixtureDir("usage/codex"))
    return yield* adapter.read
  }).pipe(Effect.provide(NodeServices.layer))

  /*
   * Checked on real rollouts (counts only, 2026-10-29): `total_tokens` always equals
   * `input_tokens + output_tokens`, so `output_tokens` already includes
   * `reasoning_output_tokens`, and `cached_input_tokens` is part of `input_tokens`. Reasoning is
   * therefore never priced on top of output.
   */
  it.effect(
    "per-response deltas of the cumulative total: repeats and fork copies counted once",
    () =>
      Effect.gen(function* () {
        const { usage } = yield* read
        const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
        const event = (
          sessionId: string,
          iso: string,
          model: string,
          t: Partial<TokenCounts>,
          tier: UsageEvent["tier"] = "standard",
        ): UsageEvent => ({
          source: "codex",
          sessionId,
          timestampMs: at(iso),
          model,
          tokens: tokens(t),
          tier,
        })
        expect(sorted(usage!.events)).toEqual([
          event(A, "2026-10-01T09:00:10.000Z", "gpt-6.1-sol", {
            input: 600,
            cacheRead: 400,
            output: 200,
            reasoning: 50,
          }),
          event(A, "2026-10-01T09:01:00.000Z", "gpt-6.1-sol", {
            input: 200,
            cacheRead: 300,
            output: 100,
            reasoning: 20,
          }),
          event(A, "2026-10-01T09:02:10.000Z", "codex-auto-review", { input: 100, output: 10 }),

          // the fork's own response, after the copied history
          event(B, "2026-10-02T09:00:20.000Z", "gpt-6.1-sol", {
            input: 200,
            cacheRead: 800,
            output: 100,
            reasoning: 20,
          }),
          // an empty total in between neither counts nor resets the running total
          event(D, "2026-10-04T09:00:10.000Z", "gpt-6.1-sol", { input: 1000, output: 100 }),
          // priority (fast) mode was switched on before this response
          event(D, "2026-10-04T09:00:30.000Z", "gpt-6.1-sol", { input: 500, output: 50 }, "fast"),
        ])
        // one repeated total in A, two copied totals in B; A's non-count total, D's empty
        // total and D's line cut off while writing
        expect(usage!.diagnostics).toEqual({ badLines: 3, duplicates: 3, markerSessions: 1 })
      }),
  )

  it.effect("the sum of totals would double count: the events add up to the last totals", () =>
    Effect.gen(function* () {
      const { usage } = yield* read
      const sum = usage!.events.reduce((n, e) => n + e.tokens.input + e.tokens.cacheRead, 0)
      // A ends at 1600 input, B adds 1000 after its copy of A, D ends at 1500
      expect(sum).toBe(1600 + 1000 + 1500)
    }),
  )
})

describe("Codex compressed rollouts", () => {
  it.effect("reads `.jsonl.zst` rollouts: their prompts and their usage", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-codex-zst-"))
      const dir = join(root, "sessions", "2026", "06", "09")
      mkdirSync(dir, { recursive: true })
      const id = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
      const usage = (input: number, output: number) => ({
        input_tokens: input,
        cached_input_tokens: 0,
        output_tokens: output,
        reasoning_output_tokens: 0,
        total_tokens: input + output,
      })
      const lines = [
        {
          timestamp: "2026-06-09T10:00:00.000Z",
          type: "session_meta",
          payload: { id, cwd: "/home/dev/delta", originator: "codex_cli_rs", source: "cli" },
        },
        {
          timestamp: "2026-06-09T10:00:00.000Z",
          type: "turn_context",
          payload: { model: "gpt-5.6-sol" },
        },
        {
          timestamp: "2026-06-09T10:00:01.000Z",
          type: "response_item",
          payload: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "make the cache key stable" }],
          },
        },
        {
          timestamp: "2026-06-09T10:00:09.000Z",
          type: "event_msg",
          payload: {
            type: "token_count",
            info: { total_token_usage: usage(300, 30), last_token_usage: usage(300, 30) },
          },
        },
      ]
      // Codex compresses older rollouts with zstd
      writeFileSync(
        join(dir, `rollout-2026-06-09T10-00-00-${id}.jsonl.zst`),
        zstdCompressSync(Buffer.from(lines.map((l) => JSON.stringify(l)).join("\n") + "\n")),
      )
      // a broken compressed file is unreadable, not an error
      writeFileSync(
        join(dir, `rollout-2026-06-09T11-00-00-${id.replace(/e/g, "f")}.jsonl.zst`),
        "not zstd",
      )
      const adapter = yield* makeCodexAdapter(root)
      const { records, usage: read, diagnostics } = yield* adapter.read
      expect(records.map((r) => r.text)).toEqual(["make the cache key stable"])
      expect(read!.events.map((e) => [e.model, e.tokens.input, e.tokens.output])).toEqual([
        ["gpt-5.6-sol", 300, 30],
      ])
      expect(diagnostics.unreadableFiles).toBe(1)
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
