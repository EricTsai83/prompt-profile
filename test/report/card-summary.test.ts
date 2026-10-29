import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { cardPeriod, cardSummary } from "../../src/report/card-summary.ts"

const sample = () =>
  Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )

describe("share card measured summary", () => {
  it("sums both sources without double-counting reasoning and labels API estimates", async () => {
    const p = await sample()
    const sources = p.usage!.sources.map((s) => ({
      ...s,
      totals: {
        ...s.totals,
        tokens: {
          input: 100,
          output: 50,
          cacheRead: 20,
          cacheWrite5m: 0,
          cacheWrite1h: 0,
          cacheWriteUnknown: 0,
          reasoning: 30,
        },
        cost: 12.5,
        unpricedRequests: 0,
      },
    }))
    const summary = cardSummary({ ...p, usage: { ...p.usage!, sources } }, "en", true)
    expect(summary.metrics).toContainEqual(["Tokens", "340"])
    expect(summary.metrics).toContainEqual(["API estimate · USD", "$25.00"])
    expect(summary.note).toContain("Usage:")
  })
  it("distinguishes partial, unknown and unmeasured usage", async () => {
    const p = await sample()
    const usage = {
      ...p.usage!,
      sources: p.usage!.sources.map((s) => ({
        ...s,
        totals: { ...s.totals, cost: 10, unpricedRequests: 1 },
      })),
    }
    expect(cardSummary({ ...p, usage }, "en", true).metrics).toContainEqual([
      "API estimate · USD",
      "$20.00+",
    ])
    expect(cardSummary({ ...p, usage }, "en", true).note).toContain("Partial pricing")
    const unknown = {
      ...usage,
      sources: usage.sources.map((s) => ({ ...s, totals: { ...s.totals, cost: null } })),
    }
    expect(cardSummary({ ...p, usage: unknown }, "en", true).metrics).toContainEqual([
      "API estimate · USD",
      "Unknown",
    ])
    expect(cardSummary({ ...p, usage: null }, "en", true).metrics).toContainEqual([
      "Tokens",
      "Not measured",
    ])
    expect(cardSummary({ ...p, usage: null }, "zh-TW", true).metrics).toContainEqual([
      "Token 用量",
      "未統計",
    ])
  })
  it("keeps response and prompt periods distinct and respects date exclusions", async () => {
    const p = await sample()
    expect(cardPeriod(p, "en", true)).toContain("Apr 25, 2026")
    expect(cardSummary(p, "en", true).note).toContain("May 3, 2026")
    expect(cardPeriod(p, "en", false)).not.toContain("25")
    expect(cardSummary(p, "en", true, false).note).not.toContain("May 3")
    const empty = { ...p.usage!, sources: [] }
    expect(cardSummary({ ...p, usage: empty }, "en", true).metrics).toContainEqual([
      "API estimate · USD",
      "No responses",
    ])
  })

  it("excludes usage entirely while retaining prompt activity", async () => {
    const p = await sample()
    const summary = cardSummary(p, "en", false)
    expect(summary.metrics).toContainEqual([
      "Prompts",
      new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
        p.stats.totalPrompts,
      ),
    ])
    expect(JSON.stringify(summary)).not.toMatch(/USD|Tokens|API|Usage:/)
    expect(summary.note).toBe("")
  })
})
