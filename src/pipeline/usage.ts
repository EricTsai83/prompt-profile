import { DateTime } from "effect"
import { SOURCE_IDS, type SourceId } from "../domain/Source.ts"
import {
  addTokens,
  totalTokens,
  ZERO_TOKENS,
  type PlanInfo,
  type SourceUsage,
  type Usage,
  type UsageBucket,
  type UsageEvent,
} from "../domain/Usage.ts"
import { costOf, priceOf, PRICING_VERSION } from "./pricing.ts"

/** What one source contributes: its usage events (already de-duplicated), plan and counters. */
export interface SourceUsageInput {
  readonly source: SourceId
  readonly events: ReadonlyArray<UsageEvent>
  readonly plan: PlanInfo
  readonly diagnostics: SourceUsage["diagnostics"]
}

export interface UsageOptions {
  /** The same window and time zone as the prompt analysis. */
  readonly since: DateTime.Utc | null
  readonly now: DateTime.Utc
  readonly timezone: string
}

const EMPTY_BUCKET: UsageBucket = {
  requests: 0,
  tokens: ZERO_TOKENS,
  cost: null,
  unpricedRequests: 0,
  fastRequests: 0,
}

const add = (b: UsageBucket, e: UsageEvent, cost: number | null): UsageBucket => ({
  requests: b.requests + 1,
  tokens: addTokens(b.tokens, e.tokens),
  cost: cost === null ? b.cost : (b.cost ?? 0) + cost,
  unpricedRequests: b.unpricedRequests + (cost === null ? 1 : 0),
  fastRequests: b.fastRequests + (e.tier === "fast" ? 1 : 0),
})

/** Stored to the micro-dollar: sums of many small floats would otherwise carry noise. */
const rounded = (b: UsageBucket): UsageBucket =>
  b.cost === null ? b : { ...b, cost: Math.round(b.cost * 1e6) / 1e6 }

const monthOf = (ms: number, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" })
    .format(ms)
    .slice(0, 7)

/**
 * Totals, months and models per source, priced at API list prices (plan 23). Events outside the
 * window are left out, exactly like prompts. A source without input still gets an (empty) entry.
 */
export const summarizeUsage = (
  inputs: ReadonlyArray<SourceUsageInput>,
  options: UsageOptions,
): Usage => {
  const from = options.since === null ? -Infinity : DateTime.toEpochMillis(options.since)
  const to = DateTime.toEpochMillis(options.now)
  let first = Infinity
  let last = -Infinity
  const sources = SOURCE_IDS.map((source): SourceUsage => {
    const given = inputs.find((i) => i.source === source)
    let totals = EMPTY_BUCKET
    const months = new Map<string, UsageBucket>()
    const models = new Map<string | null, UsageBucket>()
    const unpriced = new Set<string>()
    for (const e of given?.events ?? []) {
      if (e.timestampMs < from || e.timestampMs > to) continue
      first = Math.min(first, e.timestampMs)
      last = Math.max(last, e.timestampMs)
      const cost = costOf(e.model, e.tokens, e.tier)
      if (e.model !== null && priceOf(e.model) === undefined) unpriced.add(e.model)
      totals = add(totals, e, cost)
      const month = monthOf(e.timestampMs, options.timezone)
      months.set(month, add(months.get(month) ?? EMPTY_BUCKET, e, cost))
      models.set(e.model, add(models.get(e.model) ?? EMPTY_BUCKET, e, cost))
    }
    return {
      source,
      plan: given?.plan ?? { kind: "unknown", name: null, detail: null },
      totals: rounded(totals),
      byMonth: [...months]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([month, usage]) => ({ month, usage: rounded(usage) })),
      byModel: [...models]
        .toSorted(
          ([ma, a], [mb, b]) =>
            Number(ma === null) - Number(mb === null) ||
            totalTokens(b.tokens) - totalTokens(a.tokens) ||
            (ma ?? "").localeCompare(mb ?? ""),
        )
        .map(([model, usage]) => ({ model, usage: rounded(usage) })),
      unpricedModels: [...unpriced].toSorted(),
      diagnostics: given?.diagnostics ?? {
        unreadableFiles: 0,
        badLines: 0,
        duplicates: 0,
        markerSessions: 0,
      },
    }
  })
  return {
    pricingVersion: PRICING_VERSION,
    range:
      first === Infinity
        ? null
        : { from: DateTime.makeUnsafe(first), to: DateTime.makeUnsafe(last) },
    currency: "USD",
    sources,
  }
}
