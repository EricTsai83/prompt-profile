import type { ServiceTier, TokenCounts } from "../domain/index.ts"

/**
 * Public API list prices, embedded so a report never downloads anything (plan 23). Bump
 * PRICING_VERSION whenever a price is added or changed; profiles store the version their costs
 * were computed with, so a later `render` shows the same numbers.
 *
 * The amount is "what this usage would cost on the API", not what a subscriber paid.
 */
export const PRICING_VERSION = "2026-10-29"

/** USD per million tokens. `null`: the provider has no such price, or it cannot be applied. */
export interface Rates {
  readonly input: number
  readonly output: number
  readonly cacheRead: number
  readonly cacheWrite5m: number | null
  readonly cacheWrite1h: number | null
}

/**
 * The rates of one service tier. Prompts (input + cache reads + cache writes) above
 * `long.abovePromptTokens` pay `long.rates`; `null` there means the provider lists no such
 * price, so those responses stay unpriced.
 */
export interface Tier {
  readonly rates: Rates
  readonly long?: { readonly abovePromptTokens: number; readonly rates: Rates | null }
}

export interface ModelPrice {
  /** The API model id; dated snapshots (`<model>-YYYYMMDD`) share its price. */
  readonly model: string
  readonly standard: Tier
  /** Absent when the provider lists no fast price: fast responses then stay unpriced. */
  readonly fast?: Tier
  readonly source: string
  readonly asOf: string
}

const ANTHROPIC = "https://platform.claude.com/docs/en/about-claude/pricing"
const OPENAI = "https://developers.openai.com/api/docs/pricing"
const AS_OF = "2026-10-29"

/** Anthropic: cache writes 1.25× (5 minutes) and 2× (1 hour) input; reads at the model's ratio. */
const anthropicRates = (input: number, output: number, readRatio: number): Rates => ({
  input,
  output,
  cacheRead: input * readRatio,
  cacheWrite5m: input * 1.25,
  cacheWrite1h: input * 2,
})

/**
 * `cacheRead` as listed; `fast`: the fast-mode input and output, with the same caching
 * multipliers on top (as the pricing page says).
 */
const anthropic = (
  model: string,
  input: number,
  output: number,
  cacheRead: number,
  fast?: readonly [input: number, output: number],
): ModelPrice => ({
  model,
  standard: { rates: anthropicRates(input, output, cacheRead / input) },
  ...(fast === undefined
    ? {}
    : { fast: { rates: anthropicRates(fast[0], fast[1], cacheRead / input) } }),
  source: ANTHROPIC,
  asOf: AS_OF,
})

const LONG_OPENAI = 272_000

/** OpenAI long prompts: 2× input and cached input, 1.5× output (as listed for every tier). */
const openaiTier = (input: number, cacheRead: number, output: number, long: boolean): Tier => {
  const rates: Rates = { input, output, cacheRead, cacheWrite5m: null, cacheWrite1h: null }
  return long
    ? {
        rates,
        long: {
          abovePromptTokens: LONG_OPENAI,
          rates: { ...rates, input: input * 2, cacheRead: cacheRead * 2, output: output * 1.5 },
        },
      }
    : { rates }
}

/**
 * OpenAI: input, cached input and output. Its cache writes are priced per 30 minutes / 12 hours,
 * which the Codex log does not tell apart, so a write stays unpriced. `long`: the model has
 * long-prompt rates. `fast`: the fast tier (formerly Priority) and whether it lists long rates;
 * a long fast prompt without them stays unpriced.
 */
const openai = (
  model: string,
  input: number,
  cacheRead: number,
  output: number,
  long: boolean,
  fast?: { readonly rates: readonly [number, number, number]; readonly long: boolean },
): ModelPrice => {
  const fastTier =
    fast === undefined
      ? undefined
      : openaiTier(fast.rates[0], fast.rates[1], fast.rates[2], fast.long)
  return {
    model,
    standard: openaiTier(input, cacheRead, output, long),
    ...(fastTier === undefined
      ? {}
      : {
          fast:
            long && !fast!.long
              ? { rates: fastTier.rates, long: { abovePromptTokens: LONG_OPENAI, rates: null } }
              : fastTier,
        }),
    source: OPENAI,
    asOf: AS_OF,
  }
}

/**
 * Models seen in Claude Code and Codex logs. A data list: add a model by adding a row (and
 * bumping PRICING_VERSION). Retired models and models with a long-context rule this table cannot
 * express are left out on purpose: their cost shows as unknown, never borrowed.
 */
export const PRICE_TABLE: ReadonlyArray<ModelPrice> = [
  anthropic("claude-fable-5-1", 10, 50, 0.25),
  anthropic("claude-fable-5", 10, 50, 1),
  anthropic("claude-opus-5-5", 4, 20, 0.2, [8, 40]),
  anthropic("claude-opus-5", 5, 25, 0.5, [10, 50]),
  anthropic("claude-opus-4-8", 5, 25, 0.5, [10, 50]),
  anthropic("claude-opus-4-7", 5, 25, 0.5),
  anthropic("claude-opus-4-6", 5, 25, 0.5),
  anthropic("claude-opus-4-5", 5, 25, 0.5),
  anthropic("claude-sonnet-5-5", 2, 10, 0.1),
  anthropic("claude-sonnet-5", 2, 10, 0.2),
  anthropic("claude-sonnet-4-6", 3, 15, 0.3),
  {
    ...anthropic("claude-haiku-5-5", 0.1, 0.5, 0.01),
    standard: {
      rates: anthropicRates(0.1, 0.5, 0.1),
      long: { abovePromptTokens: 100_000, rates: anthropicRates(0.5, 2.5, 0.1) },
    },
  },
  anthropic("claude-haiku-4-5", 1, 5, 0.1),
  openai("gpt-6-astra", 10, 1, 50, true, { rates: [20, 2, 100], long: true }),
  openai("gpt-6.1-sol", 2, 0.1, 10, true, { rates: [4, 0.2, 20], long: true }),
  openai("gpt-6.1-terra", 1, 0.05, 5, true, { rates: [2, 0.1, 10], long: true }),
  openai("gpt-6-sol", 2, 0.2, 10, true, { rates: [4, 0.4, 20], long: true }),
  openai("gpt-6-luna", 0.1, 0.01, 0.5, true, { rates: [0.2, 0.02, 1], long: true }),
  openai("gpt-5.6-sol", 4, 0.4, 20, true, { rates: [8, 0.8, 40], long: true }),
  openai("gpt-5.6-terra", 2, 0.2, 12, true, { rates: [4, 0.4, 24], long: true }),
  openai("gpt-5.6-luna", 0.2, 0.02, 1.2, true, { rates: [0.4, 0.04, 2.4], long: true }),
  openai("gpt-5.5", 5, 0.5, 30, true, { rates: [12.5, 1.25, 75], long: false }),
  openai("gpt-5.4", 2.5, 0.25, 15, true, { rates: [5, 0.5, 30], long: false }),
  openai("gpt-5.4-mini", 0.75, 0.075, 4.5, false, { rates: [1.5, 0.15, 9], long: false }),
  openai("gpt-5.4-nano", 0.2, 0.02, 1.25, false),
  openai("gpt-5.3-codex", 1.75, 0.175, 14, false, { rates: [3.5, 0.35, 28], long: false }),
  openai("gpt-5.2", 1.75, 0.175, 14, false, { rates: [3.5, 0.35, 28], long: false }),
  openai("gpt-5.1", 1.25, 0.125, 10, false, { rates: [2.5, 0.25, 20], long: false }),
  openai("gpt-5", 1.25, 0.125, 10, false, { rates: [2.5, 0.25, 20], long: false }),
  openai("gpt-5-mini", 0.25, 0.025, 2, false, { rates: [0.45, 0.045, 3.6], long: false }),
  openai("gpt-5-nano", 0.05, 0.005, 0.4, false),
]

const BY_MODEL = new Map(PRICE_TABLE.map((p) => [p.model, p]))

/** The model's price, also for a dated snapshot of it; undefined when not in the table. */
export const priceOf = (model: string): ModelPrice | undefined =>
  BY_MODEL.get(model) ?? BY_MODEL.get(model.replace(/-\d{8}$/, ""))

const promptTokens = (t: TokenCounts) =>
  t.input + t.cacheRead + t.cacheWrite5m + t.cacheWrite1h + t.cacheWriteUnknown

/**
 * USD at list prices for one response; null when it cannot be priced: no model, a model not in
 * the table, a tier or prompt length without a listed price, or a cache write without a usable
 * price. Reasoning is part of output.
 */
export const costOf = (
  model: string | null,
  t: TokenCounts,
  tier: ServiceTier = "standard",
): number | null => {
  const price = model === null ? undefined : priceOf(model)
  const rated = tier === "other" ? undefined : price?.[tier]
  if (rated === undefined || t.cacheWriteUnknown > 0) return null
  const rates =
    rated.long !== undefined && promptTokens(t) > rated.long.abovePromptTokens
      ? rated.long.rates
      : rated.rates
  if (
    rates === null ||
    (t.cacheWrite5m > 0 && rates.cacheWrite5m === null) ||
    (t.cacheWrite1h > 0 && rates.cacheWrite1h === null)
  )
    return null
  return (
    (t.input * rates.input +
      t.output * rates.output +
      t.cacheRead * rates.cacheRead +
      t.cacheWrite5m * (rates.cacheWrite5m ?? 0) +
      t.cacheWrite1h * (rates.cacheWrite1h ?? 0)) /
    1_000_000
  )
}
