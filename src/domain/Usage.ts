import { Schema } from "effect"
import { SourceId } from "./Source.ts"

/**
 * Token usage, subscription plan and API list-price equivalent per source (plan 23). Read from
 * local logs and the logged-in CLIs; never sent to an LLM. A profile without `usage` (before
 * schema version 10) is "not measured", which is not the same as zero.
 */

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Amount = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))

/**
 * Tokens by kind, the same meaning for every source: `input` excludes cache reads and writes;
 * `output` includes reasoning, which `reasoning` repeats as a part of it (Codex only).
 * `cacheWriteUnknown` is a cache write whose duration the log does not say; it cannot be priced.
 */
export const TokenCounts = Schema.Struct({
  input: Count,
  output: Count,
  cacheRead: Count,
  cacheWrite5m: Count,
  cacheWrite1h: Count,
  cacheWriteUnknown: Count,
  reasoning: Count,
})
export type TokenCounts = typeof TokenCounts.Type

export const TOKEN_KINDS = [
  "input",
  "output",
  "cacheRead",
  "cacheWrite5m",
  "cacheWrite1h",
  "cacheWriteUnknown",
  "reasoning",
] as const satisfies ReadonlyArray<keyof TokenCounts>

export const ZERO_TOKENS: TokenCounts = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite5m: 0,
  cacheWrite1h: 0,
  cacheWriteUnknown: 0,
  reasoning: 0,
}

/** Every billed token once (reasoning is part of output). */
export const totalTokens = (t: TokenCounts): number =>
  t.input + t.output + t.cacheRead + t.cacheWrite5m + t.cacheWrite1h + t.cacheWriteUnknown

export const addTokens = (a: TokenCounts, b: TokenCounts): TokenCounts => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite5m: a.cacheWrite5m + b.cacheWrite5m,
  cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h,
  cacheWriteUnknown: a.cacheWriteUnknown + b.cacheWriteUnknown,
  reasoning: a.reasoning + b.reasoning,
})

/**
 * The service tier a response ran on: standard, the faster premium tier (Claude Code
 * `speed: "fast"`, Codex `service_tier: priority`), or another the price table does not know
 * (e.g. flex), which is left unpriced.
 */
export const SERVICE_TIERS = ["standard", "fast", "other"] as const
export type ServiceTier = (typeof SERVICE_TIERS)[number]

/** One model response, as an adapter reports it: counts only, never any text. */
export interface UsageEvent {
  readonly source: SourceId
  readonly sessionId: string
  readonly timestampMs: number
  /** `null` when the log does not say. */
  readonly model: string | null
  readonly tokens: TokenCounts
  readonly tier: ServiceTier
}

/** What happened while reading usage lines; bad data is skipped and counted. */
export interface UsageDiagnostics {
  /** Usage lines that could not be read as numbers. */
  readonly badLines: number
  /** Responses written more than once (Claude Code) or totals repeated or copied (Codex). */
  readonly duplicates: number
  /** Sessions of prompt-profile's own analysis calls, left out. */
  readonly markerSessions: number
}

export const PLAN_KINDS = ["subscription", "api-key", "unknown"] as const

/**
 * The plan a source runs on, from the CLI or its local files. `name` is the plan code the tool
 * reports (e.g. "team", "pro"); `detail` is an undocumented extra hint. Never an account id,
 * email or token.
 */
export const PlanInfo = Schema.Struct({
  kind: Schema.Literals(PLAN_KINDS),
  name: Schema.NullOr(Schema.String),
  detail: Schema.NullOr(Schema.String),
})
export type PlanInfo = typeof PlanInfo.Type

export const UNKNOWN_PLAN: PlanInfo = { kind: "unknown", name: null, detail: null }

/** A group of responses: tokens, and their cost at API list prices. */
export const UsageBucket = Schema.Struct({
  requests: Count,
  tokens: TokenCounts,
  /** USD at list prices for the priced responses; null when none could be priced. */
  cost: Schema.NullOr(Amount),
  /** Responses that could not be priced (unknown model, tier or cache write duration). */
  unpricedRequests: Count,
  /** Responses on the fast tier, priced at its rates. */
  fastRequests: Count,
})
export type UsageBucket = typeof UsageBucket.Type

export const SourceUsage = Schema.Struct({
  source: SourceId,
  plan: PlanInfo,
  totals: UsageBucket,
  /** `YYYY-MM` in the profile's time zone, oldest first. */
  byMonth: Schema.Array(Schema.Struct({ month: Schema.String, usage: UsageBucket })),
  /** Busiest first; `model` null when the log does not say. */
  byModel: Schema.Array(Schema.Struct({ model: Schema.NullOr(Schema.String), usage: UsageBucket })),
  /** Models seen without a price in the table, sorted. */
  unpricedModels: Schema.Array(Schema.String),
  diagnostics: Schema.Struct({
    unreadableFiles: Count,
    badLines: Count,
    duplicates: Count,
    markerSessions: Count,
  }),
})
export type SourceUsage = typeof SourceUsage.Type

export const Usage = Schema.Struct({
  /** The price table the costs were computed with. */
  pricingVersion: Schema.String,
  /**
   * First and last response counted, over every source; null when none. Usage is summed over
   * the whole `--since` window, so this can differ from the prompts' `stats.dateRange`.
   */
  range: Schema.NullOr(
    Schema.Struct({ from: Schema.DateTimeUtcFromString, to: Schema.DateTimeUtcFromString }),
  ),
  currency: Schema.Literal("USD"),
  /** One entry per source, in SOURCE_IDS order. */
  sources: Schema.Array(SourceUsage),
})
export type Usage = typeof Usage.Type

/**
 * A plan code as a tool reports it ("team", "prolite", "default_claude_max_5x"), or null for
 * anything else: an unexpected value is never shown, in case it is not a code at all.
 */
export const planCode = (value: unknown): string | null =>
  typeof value === "string" && /^[a-z0-9][a-z0-9_.-]{0,47}$/i.test(value) ? value : null
