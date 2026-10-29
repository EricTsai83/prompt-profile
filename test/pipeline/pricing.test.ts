import { describe, expect, it } from "@effect/vitest"
import { ZERO_TOKENS, type TokenCounts } from "../../src/domain/Usage.ts"
import { costOf, PRICE_TABLE, priceOf } from "../../src/pipeline/pricing.ts"

const tokens = (t: Partial<TokenCounts>): TokenCounts => ({ ...ZERO_TOKENS, ...t })
const M = 1_000_000

describe("price table", () => {
  it("every entry names its source and as-of date, once per model", () => {
    for (const p of PRICE_TABLE) {
      expect(p.source).toMatch(/^https:\/\//)
      expect(p.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    const models = PRICE_TABLE.map((p) => p.model)
    expect(new Set(models).size).toBe(models.length)
  })

  it("a dated snapshot of a listed model uses that model's price; anything else is unknown", () => {
    expect(priceOf("claude-haiku-4-5-20251001")?.model).toBe("claude-haiku-4-5")
    expect(priceOf("claude-opus-5-5")?.model).toBe("claude-opus-5-5")
    // never borrowed from a similar model
    expect(priceOf("claude-opus-5-5-preview")).toBeUndefined()
    expect(priceOf("gpt-6.1-sol-mini")).toBeUndefined()
    expect(priceOf("codex-auto-review")).toBeUndefined()
    // listed models only: a variant missing from the price page stays unknown
    expect(priceOf("gpt-5.3-codex")?.model).toBe("gpt-5.3-codex")
    expect(priceOf("gpt-5.3-codex-spark")).toBeUndefined()
    expect(priceOf("<synthetic>")).toBeUndefined()
  })
})

describe("costOf", () => {
  it("Anthropic: input, output, 5-minute and 1-hour cache writes and cache reads", () => {
    // Claude Opus 5.5: $4 in, $20 out, $5 5m write, $8 1h write, $0.20 read
    const cost = costOf(
      "claude-opus-5-5",
      tokens({ input: M, output: M, cacheWrite5m: M, cacheWrite1h: M, cacheRead: M }),
    )
    expect(cost).toBeCloseTo(4 + 20 + 5 + 8 + 0.2, 9)
  })

  it("OpenAI: uncached input, cached input and output; reasoning is not charged twice", () => {
    // gpt-6.1-sol: $2 in, $0.10 cached, $10 out
    const cost = costOf(
      "gpt-6.1-sol",
      tokens({ input: 100_000, cacheRead: 100_000, output: 10_000, reasoning: 5_000 }),
    )
    expect(cost).toBeCloseTo((100_000 * 2 + 100_000 * 0.1 + 10_000 * 10) / M, 12)
  })

  it("long prompts pay the higher tier per request (Haiku 5.5 over 100K, OpenAI over 272K)", () => {
    // the prompt counts cache reads and writes too
    expect(costOf("claude-haiku-5-5", tokens({ input: 50_000, cacheRead: 50_000 }))).toBeCloseTo(
      (50_000 * 0.1 + 50_000 * 0.01) / M,
      12,
    )
    expect(
      costOf("claude-haiku-5-5", tokens({ input: 50_000, cacheRead: 50_001, output: 1000 })),
    ).toBeCloseTo((50_000 * 0.5 + 50_001 * 0.05 + 1000 * 2.5) / M, 12)
    expect(costOf("gpt-6.1-sol", tokens({ input: 272_001, output: 1000 }))).toBeCloseTo(
      (272_001 * 4 + 1000 * 15) / M,
      12,
    )
    expect(costOf("gpt-6.1-sol", tokens({ input: 272_000, output: 1000 }))).toBeCloseTo(
      (272_000 * 2 + 1000 * 10) / M,
      12,
    )
  })

  it("unknown: a model not in the table, no model, or a cache write that cannot be priced", () => {
    expect(costOf("codex-auto-review", tokens({ input: 10 }))).toBeNull()
    expect(costOf(null, tokens({ input: 10 }))).toBeNull()
    // a write whose duration the log does not say
    expect(costOf("claude-opus-5-5", tokens({ input: 10, cacheWriteUnknown: 5 }))).toBeNull()
    // OpenAI lists 30-minute / 12-hour writes, which the Codex log does not tell apart
    expect(costOf("gpt-6.1-sol", tokens({ input: 10, cacheWriteUnknown: 5 }))).toBeNull()
    expect(costOf("gpt-6.1-sol", tokens({ input: 10, cacheWrite5m: 5 }))).toBeNull()
  })

  it("zero tokens cost zero, not unknown", () => {
    expect(costOf("claude-opus-5-5", ZERO_TOKENS)).toBe(0)
  })
})

describe("fast mode (Codex priority, Claude speed: fast)", () => {
  it("OpenAI fast rates, short and long prompts", () => {
    // gpt-6.1-sol fast: $4 / $0.20 / $20; over 272K: $8 / $0.40 / $30
    expect(
      costOf("gpt-6.1-sol", tokens({ input: 100_000, cacheRead: 100_000, output: 1000 }), "fast"),
    ).toBeCloseTo((100_000 * 4 + 100_000 * 0.2 + 1000 * 20) / M, 12)
    expect(costOf("gpt-6.1-sol", tokens({ input: 300_000, output: 1000 }), "fast")).toBeCloseTo(
      (300_000 * 8 + 1000 * 30) / M,
      12,
    )
  })

  it("Anthropic fast rates with the caching multipliers on top", () => {
    // Claude Opus 5.5 fast: $8 in, $40 out; writes 1.25× / 2×, reads 0.05× of the fast input
    expect(
      costOf(
        "claude-opus-5-5",
        tokens({ input: M, output: M, cacheWrite5m: M, cacheWrite1h: M, cacheRead: M }),
        "fast",
      ),
    ).toBeCloseTo(8 + 40 + 10 + 16 + 0.4, 9)
  })

  it("no listed fast price → unknown, never the standard price", () => {
    expect(costOf("claude-haiku-4-5", tokens({ input: 10 }), "fast")).toBeNull()
    // gpt-5.5 lists fast rates for short prompts only
    expect(costOf("gpt-5.5", tokens({ input: 10 }), "fast")).not.toBeNull()
    expect(costOf("gpt-5.5", tokens({ input: 300_000 }), "fast")).toBeNull()
  })
})
