import { Schema } from "effect"
import {
  addTokens,
  totalTokens,
  TOKEN_KINDS,
  ZERO_TOKENS,
  type ServiceTier,
  type TokenCounts,
} from "./Usage.ts"

/** Generation accounting is separate from the historical activity in Profile.usage. */
export const EXECUTION_VERSION = 1
export const EXECUTION_STAGES = ["map", "merge", "draft", "review", "translation"] as const
export type ExecutionStage = (typeof EXECUTION_STAGES)[number]
export type MeasurementState = "known-zero" | "complete" | "partial" | "unavailable"
export type ExecutionOutcome =
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "interrupted"
  | "unknown"

export interface ExecutionCost {
  readonly provenance: "reported" | "estimated"
  readonly usd: number
  readonly pricingVersion: string | null
  readonly tier: ServiceTier | null
}

/** Only bounded operational metadata belongs here; never prompts, output or error messages. */
export interface ExecutionAttempt {
  readonly id: number
  /** Shared by retries of the same logical request; unique within one execution. */
  readonly callId: number
  readonly stage: ExecutionStage
  readonly engine: "claude-code" | "codex"
  readonly model: string | null
  readonly modelSource: "reported" | "requested" | null
  readonly startedAtMs: number
  readonly finishedAtMs: number | null
  readonly outcome: "running" | "succeeded" | "failed" | "cancelled"
  /** Null means unavailable. Cache and reasoning use the existing TokenCounts semantics. */
  readonly unknownTokenKinds?: ReadonlyArray<keyof TokenCounts> | undefined
  readonly tokens: TokenCounts | null
  readonly cost: ExecutionCost | null
}

export interface ExecutionSummary {
  readonly stages: Readonly<
    Record<
      ExecutionStage,
      { readonly calls: number; readonly failed: number; readonly cancelled: number }
    >
  >
  readonly calls: number
  readonly retries: number
  readonly running: number
  readonly cancelled: number
  readonly failed: number
  readonly localCacheHits: number
  readonly wallDurationMs: number
  /** Finished calls only; overlap is deliberately counted in each call. */
  readonly callDurationMs: number
  readonly tokens: {
    readonly state: MeasurementState
    readonly subtotal: TokenCounts
    readonly total: number
    readonly unknownAttempts: number
  }
  readonly cost: {
    readonly state: MeasurementState
    readonly usd: number
    readonly unknownAttempts: number
    readonly reportedAttempts: number
    readonly estimatedAttempts: number
  }
}

export interface ExecutionRecord {
  readonly version: typeof EXECUTION_VERSION
  readonly id: string
  readonly accountingFinishedAtMs: number | null
  readonly engine: "claude-code" | "codex" | null
  readonly requestedModel: string | null
  readonly stopReason: string | null
  readonly limits: { readonly maxCalls: number | null; readonly maxCostUsd: number | null }
  readonly operation: "analyze"
  readonly startedAtMs: number
  readonly finishedAtMs: number | null
  readonly outcome: ExecutionOutcome
  readonly reportId: string | null
  readonly analysis: "pending" | "complete" | "partial" | "failed"
  readonly languages: ReadonlyArray<{ readonly language: string; readonly available: boolean }>
  readonly artifacts: ReadonlyArray<{
    readonly kind: "profile" | "html" | "card"
    readonly path: string
    readonly available: boolean
  }>
  readonly attempts: ReadonlyArray<ExecutionAttempt>
  readonly summary: ExecutionSummary
}

export type ExecutionEvent =
  | { readonly type: "started"; readonly executionId: string; readonly atMs: number }
  | {
      readonly type: "stage"
      readonly stage: ExecutionStage
      readonly completed: number
      readonly total: number | null
    }
  | { readonly type: "attempt"; readonly attempt: ExecutionAttempt }
  | { readonly type: "cache-hit"; readonly stage: "map" | "merge" }
  | {
      readonly type: "finished"
      readonly outcome: ExecutionOutcome
      readonly summary: ExecutionSummary
    }

const state = (
  calls: number,
  unknown: number,
  zero: boolean,
  available = calls - unknown,
): MeasurementState =>
  calls === 0
    ? "known-zero"
    : available === 0
      ? "unavailable"
      : unknown > 0
        ? "partial"
        : zero
          ? "known-zero"
          : "complete"

/** Pure shared aggregation. Cached results are never included as attempts in this run. */
export const summarizeExecution = (
  attempts: ReadonlyArray<ExecutionAttempt>,
  localCacheHits: number,
  startedAtMs: number,
  finishedAtMs: number,
): ExecutionSummary => {
  let subtotal = { ...ZERO_TOKENS }
  let unknownTokens = 0
  let availableTokens = 0
  let unknownCost = 0
  let usd = 0
  let reportedAttempts = 0
  let estimatedAttempts = 0
  let callDurationMs = 0
  for (const attempt of attempts) {
    if (
      attempt.tokens === null ||
      (attempt.unknownTokenKinds?.filter((k) => k !== "reasoning").length ?? 0) > 0
    )
      unknownTokens++
    if (attempt.tokens !== null) {
      subtotal = addTokens(subtotal, attempt.tokens)
      if (TOKEN_KINDS.some((k) => k !== "reasoning" && !attempt.unknownTokenKinds?.includes(k)))
        availableTokens++
    }
    if (attempt.cost === null) unknownCost++
    else {
      usd += attempt.cost.usd
      if (attempt.cost.provenance === "reported") reportedAttempts++
      else estimatedAttempts++
    }
    if (attempt.finishedAtMs !== null)
      callDurationMs += Math.max(0, attempt.finishedAtMs - attempt.startedAtMs)
  }
  const total = totalTokens(subtotal)
  return {
    stages: Object.fromEntries(
      EXECUTION_STAGES.map((stage) => {
        const selected = attempts.filter((a) => a.stage === stage)
        return [
          stage,
          {
            calls: selected.length,
            failed: selected.filter((a) => a.outcome === "failed").length,
            cancelled: selected.filter((a) => a.outcome === "cancelled").length,
          },
        ]
      }),
    ) as ExecutionSummary["stages"],
    calls: attempts.length,
    retries: attempts.length - new Set(attempts.map((a) => a.callId)).size,
    running: attempts.filter((a) => a.outcome === "running").length,
    cancelled: attempts.filter((a) => a.outcome === "cancelled").length,
    failed: attempts.filter((a) => a.outcome === "failed").length,
    localCacheHits,
    wallDurationMs: Math.max(0, finishedAtMs - startedAtMs),
    callDurationMs,
    tokens: {
      state: state(attempts.length, unknownTokens, total === 0, availableTokens),
      subtotal,
      total,
      unknownAttempts: unknownTokens,
    },
    cost: {
      state: state(attempts.length, unknownCost, usd === 0),
      usd,
      unknownAttempts: unknownCost,
      reportedAttempts,
      estimatedAttempts,
    },
  }
}

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Amount = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))
const State = Schema.Literals(["known-zero", "complete", "partial", "unavailable"])
const Outcome = Schema.Literals([
  "running",
  "succeeded",
  "partial",
  "failed",
  "interrupted",
  "unknown",
])
const Tokens = Schema.Struct(
  Object.fromEntries(TOKEN_KINDS.map((k) => [k, Count])) as Record<keyof TokenCounts, typeof Count>,
)
export const ExecutionSummarySchema = Schema.Struct({
  stages: Schema.Struct(
    Object.fromEntries(
      EXECUTION_STAGES.map((stage) => [
        stage,
        Schema.Struct({ calls: Count, failed: Count, cancelled: Count }),
      ]),
    ) as Record<
      ExecutionStage,
      Schema.Struct<{ calls: typeof Count; failed: typeof Count; cancelled: typeof Count }>
    >,
  ),
  calls: Count,
  retries: Count,
  running: Count,
  cancelled: Count,
  failed: Count,
  localCacheHits: Count,
  wallDurationMs: Amount,
  callDurationMs: Amount,
  tokens: Schema.Struct({ state: State, subtotal: Tokens, total: Count, unknownAttempts: Count }),
  cost: Schema.Struct({
    state: State,
    usd: Amount,
    unknownAttempts: Count,
    reportedAttempts: Count,
    estimatedAttempts: Count,
  }),
})
export const GenerationMetadata = Schema.Struct({
  languages: Schema.Array(Schema.Struct({ language: Schema.String, available: Schema.Boolean })),
  executionId: Schema.String.check(Schema.isPattern(/^[0-9a-f-]{36}$/u)),
  outcome: Outcome,
  models: Schema.Array(
    Schema.Struct({
      engine: Schema.Literals(["claude-code", "codex"]),
      model: Schema.NullOr(Schema.String),
      source: Schema.NullOr(Schema.Literals(["reported", "requested"])),
    }),
  ),
  summary: ExecutionSummarySchema,
})
export type GenerationMetadata = typeof GenerationMetadata.Type
const AttemptSchema = Schema.Struct({
  id: Count,
  callId: Count,
  stage: Schema.Literals(EXECUTION_STAGES),
  engine: Schema.Literals(["claude-code", "codex"]),
  model: Schema.NullOr(Schema.String),
  modelSource: Schema.NullOr(Schema.Literals(["reported", "requested"])),
  startedAtMs: Amount,
  finishedAtMs: Schema.NullOr(Amount),
  outcome: Schema.Literals(["running", "succeeded", "failed", "cancelled"]),
  tokens: Schema.NullOr(Tokens),
  unknownTokenKinds: Schema.optional(Schema.Array(Schema.Literals(TOKEN_KINDS))),
  cost: Schema.NullOr(
    Schema.Struct({
      provenance: Schema.Literals(["reported", "estimated"]),
      usd: Amount,
      pricingVersion: Schema.NullOr(Schema.String),
      tier: Schema.NullOr(Schema.Literals(["standard", "fast", "other"])),
    }),
  ),
})
const RecordSchema = Schema.Struct({
  version: Schema.Literal(EXECUTION_VERSION),
  id: Schema.String.check(Schema.isPattern(/^[0-9a-f-]{36}$/u)),
  operation: Schema.Literal("analyze"),
  accountingFinishedAtMs: Schema.NullOr(Amount),
  engine: Schema.NullOr(Schema.Literals(["claude-code", "codex"])),
  requestedModel: Schema.NullOr(Schema.String),
  stopReason: Schema.NullOr(Schema.String),
  limits: Schema.Struct({ maxCalls: Schema.NullOr(Count), maxCostUsd: Schema.NullOr(Amount) }),
  startedAtMs: Amount,
  finishedAtMs: Schema.NullOr(Amount),
  outcome: Outcome,
  reportId: Schema.NullOr(Schema.String),
  analysis: Schema.Literals(["pending", "complete", "partial", "failed"]),
  languages: Schema.Array(Schema.Struct({ language: Schema.String, available: Schema.Boolean })),
  artifacts: Schema.Array(
    Schema.Struct({
      kind: Schema.Literals(["profile", "html", "card"]),
      path: Schema.String,
      available: Schema.Boolean,
    }),
  ),
  attempts: Schema.Array(AttemptSchema),
  summary: ExecutionSummarySchema,
})
export const parseExecution = (input: unknown): ExecutionRecord | null => {
  const parsed = Schema.decodeUnknownOption(RecordSchema)(input)
  if (parsed._tag === "None") return null
  const r = parsed.value
  if (r.attempts.length > 10000 || new Set(r.attempts.map((a) => a.id)).size !== r.attempts.length)
    return null
  return {
    ...r,
    summary: summarizeExecution(
      r.attempts,
      r.summary.localCacheHits,
      r.startedAtMs,
      r.accountingFinishedAtMs ?? r.finishedAtMs ?? r.startedAtMs + r.summary.wallDurationMs,
    ),
  }
}
export const generationOf = (r: ExecutionRecord): GenerationMetadata => ({
  executionId: r.id,
  languages: r.languages,
  outcome: r.outcome,
  summary: r.summary,
  models: [
    ...new Map(
      r.attempts.map((a) => [
        JSON.stringify([a.engine, a.model, a.modelSource]),
        { engine: a.engine, model: a.model, source: a.modelSource },
      ]),
    ).values(),
  ],
})

/** Legacy consumers can require complete coverage without turning a missing value into zero. */
export const completeAmount = (values: ReadonlyArray<number | null>): number | null =>
  values.some((v) => v === null) ? null : values.reduce<number>((sum, v) => sum + (v ?? 0), 0)
