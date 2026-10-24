import { Effect } from "effect"
import { CallBudgetExceeded, type LlmRunnerShape } from "./LlmRunner.ts"

/** Wrap before withRetry, so retries and concurrent map/merge calls share the same budget. */
export const withCallBudget = (runner: LlmRunnerShape, limit: number): LlmRunnerShape => {
  let started = 0
  return {
    ...runner,
    generate: (input) =>
      Effect.suspend(() => {
        // No async boundary between checking and reserving a call.
        if (started >= limit)
          return Effect.fail(new CallBudgetExceeded({ runner: runner.id, limit }))
        started++
        return runner.generate(input)
      }),
  }
}
