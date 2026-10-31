import { Effect, Exit } from "effect"
import { CostBudgetExceeded, type GenerateInput, type LlmRunnerShape } from "./LlmRunner.ts"

/** Completed measurements control admission. Requests already running can overshoot. */
export const withCostStop = (runner: LlmRunnerShape, limit: number): LlmRunnerShape => {
  let spent = 0
  let unknown = false
  const stopped = () =>
    new CostBudgetExceeded({
      runner: runner.id,
      limit,
      measuredUsd: spent,
      reason: unknown ? "unavailable" : "threshold",
    })
  return {
    ...runner,
    generate: <A>(input: GenerateInput<A>) =>
      Effect.suspend(() => {
        if (unknown || spent >= limit) return Effect.fail(stopped())
        let measured = false
        let amount: number | null = null
        return runner
          .generate({
            ...input,
            onMeasurement: (m) => {
              measured = true
              amount = m.costUsd
              input.onMeasurement?.(m)
            },
          })
          .pipe(
            Effect.onExit((exit) =>
              Effect.sync(() => {
                const cost = measured
                  ? amount
                  : Exit.isSuccess(exit)
                    ? exit.value.usage.costUsd
                    : null
                if (cost === null || !Number.isFinite(cost) || cost < 0) unknown = true
                else spent += cost
              }),
            ),
            Effect.flatMap((result) => (unknown ? Effect.fail(stopped()) : Effect.succeed(result))),
          )
      }),
  }
}
