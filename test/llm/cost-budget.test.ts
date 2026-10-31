import { expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { withCostStop } from "../../src/llm/cost-budget.ts"
import { makeLlmSchema, type LlmRunnerShape } from "../../src/llm/LlmRunner.ts"

const input = {
  system: "fake",
  prompt: "fake",
  schema: makeLlmSchema("Ok", Schema.Struct({ ok: Schema.Boolean })),
}
it.effect("stops new admissions at measured cost and never treats absent cost as free", () =>
  Effect.gen(function* () {
    let calls = 0
    const base: LlmRunnerShape = {
      id: "claude-code",
      displayName: "Claude",
      generate: () =>
        Effect.sync(() => {
          calls++
          return {
            value: null as never,
            model: null,
            usage: { inputTokens: 0, outputTokens: 0, costUsd: 0.6 },
            durationMs: 1,
          }
        }),
    }
    const runner = withCostStop(base, 1)
    yield* runner.generate(input)
    yield* runner.generate(input)
    expect((yield* Effect.result(runner.generate(input)))._tag).toBe("Failure")
    expect(calls).toBe(2)
    const unknown = withCostStop(
      {
        ...base,
        generate: () =>
          Effect.succeed({
            value: null as never,
            model: null,
            usage: { inputTokens: null, outputTokens: null, costUsd: null },
            durationMs: 0,
          }),
      },
      1,
    )
    expect(yield* Effect.result(unknown.generate(input))).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "CostBudgetExceeded", reason: "unavailable" },
    })
  }),
)

it.effect("permits already in-flight completions to overshoot and blocks the next admission", () =>
  Effect.gen(function* () {
    let calls = 0
    const base: LlmRunnerShape = {
      id: "claude-code",
      displayName: "Claude",
      generate: () =>
        Effect.gen(function* () {
          calls++
          yield* Effect.yieldNow
          return {
            value: null as never,
            model: null,
            usage: { inputTokens: 0, outputTokens: 0, costUsd: 0.8 },
            durationMs: 0,
          }
        }),
    }
    const runner = withCostStop(base, 1)
    yield* Effect.all([runner.generate(input), runner.generate(input), runner.generate(input)], {
      concurrency: "unbounded",
    })
    const result = yield* Effect.result(runner.generate(input))
    expect(calls).toBe(3)
    expect(result).toMatchObject({
      _tag: "Failure",
      failure: { reason: "threshold", measuredUsd: 2.4000000000000004 },
    })
  }),
)
