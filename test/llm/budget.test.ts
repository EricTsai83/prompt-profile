import { expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { withCallBudget } from "../../src/llm/budget.ts"
import { makeFakeLlmRunner } from "../../src/llm/fake.ts"
import { InvalidOutput, makeLlmSchema } from "../../src/llm/LlmRunner.ts"
import { withRetry } from "../../src/llm/retry.ts"

it.effect("counts retries against the budget and never starts an extra call", () =>
  Effect.gen(function* () {
    const fake = makeFakeLlmRunner({
      respond: () => ({ ok: true }),
      failures: new Map([[1, new InvalidOutput({ runner: "codex", detail: "bad" })]]),
    })
    const runner = withRetry(withCallBudget(fake, 1), { baseDelay: 0 })
    const result = yield* Effect.result(
      runner.generate({
        system: "Return JSON",
        prompt: "fake data",
        schema: makeLlmSchema("Ok", Schema.Struct({ ok: Schema.Boolean })),
      }),
    )
    expect(result).toMatchObject({
      _tag: "Failure",
      failure: { _tag: "CallBudgetExceeded", limit: 1 },
    })
    expect(fake.calls()).toBe(1)
  }),
)

it.effect("enforces one shared budget for concurrent calls", () =>
  Effect.gen(function* () {
    const fake = makeFakeLlmRunner({ respond: () => ({ ok: true }) })
    const runner = withCallBudget(fake, 2)
    const outcomes = yield* Effect.forEach(
      [1, 2, 3],
      () =>
        Effect.result(
          runner.generate({
            system: "Return JSON",
            prompt: "fake data",
            schema: makeLlmSchema("Ok", Schema.Struct({ ok: Schema.Boolean })),
          }),
        ),
      { concurrency: "unbounded" },
    )
    expect(outcomes.filter((r) => r._tag === "Failure")).toHaveLength(1)
    expect(fake.calls()).toBe(2)
  }),
)
