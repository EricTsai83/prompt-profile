import { expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { makeExecutionAccounting } from "../../src/llm/accounting.ts"
import { InvalidOutput, makeLlmSchema, type LlmRunnerShape } from "../../src/llm/LlmRunner.ts"
import { withRetry } from "../../src/llm/retry.ts"
import { withCallBudget } from "../../src/llm/budget.ts"

const input = {
  system: "private instructions",
  prompt: "private prompt",
  stage: "review" as const,
  schema: makeLlmSchema("Ok", Schema.Struct({ ok: Schema.Boolean })),
}

it.effect(
  "counts paid parse failures and retries separately, without counting rejected admission",
  () =>
    Effect.gen(function* () {
      const accounting = makeExecutionAccounting("fake", 0)
      let n = 0
      const base: LlmRunnerShape = {
        id: "codex",
        displayName: "Codex",
        generate: (request) =>
          Effect.suspend(() => {
            n++
            request.onMeasurement?.({
              model: "gpt-5.4",
              modelSource: "requested",
              tokens: { input: 10, output: 5, cacheRead: 2 },
              costUsd: 0.01,
              tier: null,
            })
            return Effect.fail(new InvalidOutput({ runner: "codex", detail: "private output" }))
          }),
      }
      const runner = accounting.logical(
        withRetry(withCallBudget(accounting.attempts(base), 2), { baseDelay: 0 }),
      )
      yield* Effect.result(runner.generate(input))
      const record = accounting.record(100)
      expect(n).toBe(2)
      expect(record.summary).toMatchObject({
        calls: 2,
        retries: 1,
        failed: 2,
        cost: { usd: 0.02, reportedAttempts: 2 },
      })
      expect(record.attempts.map((a) => a.stage)).toEqual(["review", "review"])
      expect(JSON.stringify(record)).not.toContain("private")
    }),
)

it.effect("records interruption and unknown consumption without masking cancellation", () =>
  Effect.gen(function* () {
    const accounting = makeExecutionAccounting("fake", 0)
    const base: LlmRunnerShape = {
      id: "codex",
      displayName: "Codex",
      generate: () => Effect.interrupt,
    }
    yield* Effect.exit(accounting.logical(accounting.attempts(base)).generate(input))
    expect(accounting.record(100)).toMatchObject({
      summary: { calls: 1, cancelled: 1, cost: { state: "unavailable" } },
    })
  }),
)

it.effect("retains malformed-output measurements supplied before decoding", () =>
  Effect.gen(function* () {
    const { makeClaudeCodeRunner } = yield* Effect.promise(() => import("../../src/llm/claude.ts"))
    const { makeFakeSpawner } = yield* Effect.promise(() => import("./fakeSpawner.ts"))
    const { NodeServices } = yield* Effect.promise(() => import("@effect/platform-node"))
    const { Layer } = yield* Effect.promise(() => import("effect"))
    const spawner = makeFakeSpawner(() => ({
      exitCode: 0,
      stdout: JSON.stringify({
        structured_output: { ok: "bad" },
        total_cost_usd: 0.02,
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 3,
          cache_creation_input_tokens: 4,
        },
      }),
    }))
    const accounting = makeExecutionAccounting("fake", 0)
    yield* Effect.gen(function* () {
      const base = yield* makeClaudeCodeRunner()
      yield* Effect.result(accounting.logical(accounting.attempts(base)).generate(input))
      expect(accounting.record(100).summary).toMatchObject({
        calls: 1,
        failed: 1,
        cost: { usd: 0.02 },
        tokens: { subtotal: { input: 10, cacheRead: 3, cacheWriteUnknown: 4, output: 5 } },
      })
    }).pipe(Effect.provide(Layer.merge(NodeServices.layer, spawner.layer)))
  }),
)

it.effect("normalizes Codex cache reads as a subset and estimates only a known reported tier", () =>
  Effect.gen(function* () {
    const { makeCodexRunner } = yield* Effect.promise(() => import("../../src/llm/codex.ts"))
    const { makeFakeSpawner } = yield* Effect.promise(() => import("./fakeSpawner.ts"))
    const { NodeServices } = yield* Effect.promise(() => import("@effect/platform-node"))
    const { Layer } = yield* Effect.promise(() => import("effect"))
    const { writeFileSync } = yield* Effect.promise(() => import("node:fs"))
    const spawner = makeFakeSpawner((record) => {
      writeFileSync(record.args[record.args.indexOf("-o") + 1]!, '{"ok":true}')
      return {
        exitCode: 0,
        stdout: JSON.stringify({
          type: "turn.completed",
          usage: {
            input_tokens: 20,
            cached_input_tokens: 8,
            output_tokens: 5,
            reasoning_output_tokens: 3,
            service_tier: "standard",
          },
        }),
      }
    })
    const accounting = makeExecutionAccounting("fake", 0, (m) =>
      m.tier === "standard"
        ? { provenance: "estimated", usd: 0.01, pricingVersion: "fake", tier: m.tier }
        : null,
    )
    yield* Effect.gen(function* () {
      const base = yield* makeCodexRunner({ model: "gpt-5.4" })
      yield* accounting.logical(accounting.attempts(base)).generate(input)
      expect(accounting.record(100).summary).toMatchObject({
        tokens: {
          state: "complete",
          total: 25,
          subtotal: { input: 12, cacheRead: 8, output: 5, reasoning: 3 },
        },
        cost: { estimatedAttempts: 1, usd: 0.01 },
      })
      expect(accounting.record(100).attempts[0]).toMatchObject({ modelSource: "requested" })
    }).pipe(Effect.provide(Layer.merge(NodeServices.layer, spawner.layer)))
  }),
)

it.effect(
  "stops subsequent admissions on checkpoint failure without hiding the measured call",
  () =>
    Effect.gen(function* () {
      const accounting = makeExecutionAccounting("fake", 0)
      let calls = 0
      const base: LlmRunnerShape = {
        id: "codex",
        displayName: "Codex",
        generate: () =>
          Effect.sync(() => {
            calls++
            return {
              value: null as never,
              model: null,
              usage: { inputTokens: null, outputTokens: null, costUsd: 0.2 },
              durationMs: 0,
            }
          }),
      }
      accounting.setCheckpoint(Effect.die("synthetic write failure"))
      const runner = accounting.logical(accounting.attempts(base))
      expect(yield* Effect.result(runner.generate(input))).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "AccountingUnavailable" },
      })
      yield* Effect.result(runner.generate(input))
      expect(calls).toBe(1)
      expect(accounting.record(100).summary).toMatchObject({ calls: 1, cost: { usd: 0.2 } })
    }),
)

it.effect("does not charge a local spawn failure as a model invocation", () =>
  Effect.gen(function* () {
    const { makeClaudeCodeRunner } = yield* Effect.promise(() => import("../../src/llm/claude.ts"))
    const { makeFakeSpawner } = yield* Effect.promise(() => import("./fakeSpawner.ts"))
    const { NodeServices } = yield* Effect.promise(() => import("@effect/platform-node"))
    const { Layer } = yield* Effect.promise(() => import("effect"))
    const spawner = makeFakeSpawner(() => "enoent")
    const accounting = makeExecutionAccounting("fake", 0)
    yield* Effect.gen(function* () {
      const base = yield* makeClaudeCodeRunner()
      yield* Effect.result(accounting.logical(accounting.attempts(base)).generate(input))
      expect(accounting.record(100).summary).toMatchObject({
        calls: 0,
        cost: { state: "known-zero" },
      })
    }).pipe(Effect.provide(Layer.merge(NodeServices.layer, spawner.layer)))
  }),
)

it.effect("keeps valid token fields when another metadata field is malformed", () =>
  Effect.gen(function* () {
    const { makeClaudeCodeRunner } = yield* Effect.promise(() => import("../../src/llm/claude.ts"))
    const { makeFakeSpawner } = yield* Effect.promise(() => import("./fakeSpawner.ts"))
    const { NodeServices } = yield* Effect.promise(() => import("@effect/platform-node"))
    const { Layer } = yield* Effect.promise(() => import("effect"))
    const spawner = makeFakeSpawner(() => ({
      exitCode: 0,
      stdout: JSON.stringify({
        structured_output: { ok: true },
        total_cost_usd: "bad",
        usage: { input_tokens: "bad", output_tokens: 7 },
      }),
    }))
    const accounting = makeExecutionAccounting("fake", 0)
    yield* Effect.gen(function* () {
      const base = yield* makeClaudeCodeRunner()
      yield* accounting.logical(accounting.attempts(base)).generate(input)
      expect(accounting.record(100).summary).toMatchObject({
        tokens: { state: "partial", total: 7, unknownAttempts: 1 },
        cost: { state: "unavailable" },
      })
    }).pipe(Effect.provide(Layer.merge(NodeServices.layer, spawner.layer)))
  }),
)
