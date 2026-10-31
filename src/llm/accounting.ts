import { Clock, Effect, Exit } from "effect"
import {
  EXECUTION_VERSION,
  summarizeExecution,
  type ExecutionAttempt,
  type ExecutionCost,
  type ExecutionOutcome,
  type ExecutionRecord,
} from "../domain/Execution.ts"
import { TOKEN_KINDS, ZERO_TOKENS } from "../domain/Usage.ts"
import {
  AccountingUnavailable,
  type CallMeasurement,
  type GenerateInput,
  type LlmRunnerShape,
} from "./LlmRunner.ts"

/** Mutable collector scoped to one command. Effects remain interruptible; metadata never stores content. */
export const makeExecutionAccounting = (
  id: string,
  startedAtMs: number,
  estimate?: (measurement: CallMeasurement) => ExecutionCost | null,
) => {
  const attempts = new Map<number, ExecutionAttempt>()
  let nextAttempt = 0
  let nextCall = 0
  let engine: ExecutionRecord["engine"] = null
  let requestedModel: string | null = null
  let stopReason: string | null = null
  let limits: ExecutionRecord["limits"] = { maxCalls: null, maxCostUsd: null }
  let accountingFinishedAtMs: number | null = null
  let checkpoint: Effect.Effect<void> = Effect.void
  let cacheHits = 0
  let recordingAvailable = true
  let details: Pick<
    ExecutionRecord,
    "outcome" | "reportId" | "analysis" | "languages" | "artifacts"
  > = {
    outcome: "running",
    reportId: null,
    analysis: "pending",
    languages: [],
    artifacts: [],
  }
  const record = (now: number): ExecutionRecord => ({
    version: EXECUTION_VERSION,
    id,
    operation: "analyze",
    stopReason,
    engine,
    requestedModel,
    limits,
    accountingFinishedAtMs,
    startedAtMs,
    finishedAtMs: details.outcome === "running" ? null : now,
    ...details,
    attempts: [...attempts.values()],
    summary: summarizeExecution(
      [...attempts.values()],
      cacheHits,
      startedAtMs,
      accountingFinishedAtMs ?? now,
    ),
  })
  const logical = (runner: LlmRunnerShape): LlmRunnerShape => ({
    ...runner,
    generate: (input) =>
      Effect.suspend(() => runner.generate({ ...input, executionCallId: ++nextCall })),
  })
  const wrapAttempts = (runner: LlmRunnerShape): LlmRunnerShape => ({
    ...runner,
    generate: <A>(input: GenerateInput<A>) =>
      Effect.gen(function* () {
        if (!recordingAvailable)
          return yield* new AccountingUnavailable({ runner: runner.id, reason: "checkpoint" })
        if (attempts.size >= 10000)
          return yield* new AccountingUnavailable({ runner: runner.id, reason: "capacity" })
        const start = yield* Clock.currentTimeMillis
        const index = nextAttempt++
        const clock = yield* Clock.Clock
        let invoked = runner.tracksInvocation !== true
        let measured: CallMeasurement | null = null
        let initial: ExecutionAttempt = {
          id: index + 1,
          callId: input.executionCallId ?? ++nextCall,
          stage: input.stage ?? "draft",
          engine: runner.id,
          model: null,
          modelSource: null,
          startedAtMs: start,
          finishedAtMs: null,
          outcome: "running",
          tokens: null,
          cost: null,
        }
        attempts.set(index, initial)
        return yield* runner
          .generate({
            ...input,
            onInvocation: () => {
              invoked = true
              initial = { ...initial, startedAtMs: clock.currentTimeMillisUnsafe() }
              attempts.set(index, initial)
              input.onInvocation?.()
            },
            onMeasurement: (m) => {
              measured = m
              input.onMeasurement?.(m)
            },
          })
          .pipe(
            Effect.onExit((exit) =>
              Effect.gen(function* () {
                if (!invoked) {
                  attempts.delete(index)
                  return
                }
                const end = yield* Clock.currentTimeMillis
                const m: CallMeasurement | null =
                  measured ??
                  (Exit.isSuccess(exit)
                    ? {
                        model: exit.value.model,
                        modelSource: exit.value.modelSource ?? null,
                        tokens: null,
                        costUsd: exit.value.usage.costUsd,
                        tier: null,
                      }
                    : null)
                const tokens = m?.tokens ? { ...ZERO_TOKENS, ...m.tokens } : null
                attempts.set(index, {
                  ...initial,
                  finishedAtMs: end,
                  outcome: Exit.isSuccess(exit)
                    ? "succeeded"
                    : exit.cause.reasons.some((r) => r._tag === "Interrupt")
                      ? "cancelled"
                      : "failed",
                  model:
                    m?.model?.slice(0, 200) ??
                    (Exit.isSuccess(exit) ? (exit.value.model?.slice(0, 200) ?? null) : null),
                  modelSource:
                    m?.modelSource ??
                    (Exit.isSuccess(exit) ? (exit.value.modelSource ?? null) : null),
                  tokens,
                  unknownTokenKinds: tokens
                    ? TOKEN_KINDS.filter((k) => m?.tokens?.[k] === undefined)
                    : TOKEN_KINDS,
                  cost:
                    m?.costUsd != null
                      ? {
                          provenance: "reported",
                          usd: m.costUsd,
                          pricingVersion: null,
                          tier: m.tier,
                        }
                      : m
                        ? (estimate?.(m) ?? null)
                        : null,
                })
                const saved = yield* Effect.exit(checkpoint)
                if (Exit.isFailure(saved)) {
                  recordingAvailable = false
                  if (Exit.isSuccess(exit))
                    return yield* new AccountingUnavailable({
                      runner: runner.id,
                      reason: "checkpoint",
                    })
                }
              }),
            ),
          )
      }),
  })
  return {
    record,
    setEngine: (value: ExecutionRecord["engine"], model: string | null) => {
      engine = value
      requestedModel = model?.slice(0, 200) ?? null
    },
    setLimits: (value: ExecutionRecord["limits"]) => {
      limits = value
    },
    stop: (reason: string) => {
      stopReason = reason
    },
    seal: (now: number) => {
      accountingFinishedAtMs = now
    },
    setCheckpoint: (effect: Effect.Effect<void>) => {
      checkpoint = effect
    },
    logical,
    attempts: wrapAttempts,
    cacheHit: () => {
      cacheHits++
    },
    update: (value: Partial<typeof details>) => {
      details = { ...details, ...value }
    },
    finish: (outcome: ExecutionOutcome) => {
      details = { ...details, outcome }
    },
  }
}
