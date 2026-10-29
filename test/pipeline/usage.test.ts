import { describe, expect, it } from "@effect/vitest"
import { DateTime } from "effect"
import {
  UNKNOWN_PLAN,
  ZERO_TOKENS,
  type TokenCounts,
  type UsageEvent,
} from "../../src/domain/Usage.ts"
import { PRICING_VERSION } from "../../src/pipeline/pricing.ts"
import { summarizeUsage, type SourceUsageInput } from "../../src/pipeline/usage.ts"

const at = (iso: string) => Date.parse(iso)
const tokens = (t: Partial<TokenCounts>): TokenCounts => ({ ...ZERO_TOKENS, ...t })
const event = (
  iso: string,
  model: string | null,
  t: Partial<TokenCounts>,
  source: UsageEvent["source"] = "claude-code",
  tier: UsageEvent["tier"] = "standard",
): UsageEvent => ({
  source,
  sessionId: "s1",
  timestampMs: at(iso),
  model,
  tokens: tokens(t),
  tier,
})

const input = (
  source: SourceUsageInput["source"],
  events: ReadonlyArray<UsageEvent>,
): SourceUsageInput => ({
  source,
  events,
  plan: UNKNOWN_PLAN,
  diagnostics: { unreadableFiles: 0, badLines: 0, duplicates: 0, markerSessions: 0 },
})

const now = DateTime.makeUnsafe("2026-10-29T00:00:00Z")
const options = { since: DateTime.makeUnsafe("2026-09-01T00:00:00Z"), now, timezone: "Asia/Taipei" }

describe("summarizeUsage", () => {
  it("one entry per source in source order, with the pricing version", () => {
    const usage = summarizeUsage([input("codex", []), input("claude-code", [])], options)
    expect(usage.pricingVersion).toBe(PRICING_VERSION)
    expect(usage.currency).toBe("USD")
    expect(usage.sources.map((s) => s.source)).toEqual(["claude-code", "codex"])
    expect(usage.sources[0]!.totals).toEqual({
      requests: 0,
      tokens: ZERO_TOKENS,
      cost: null,
      unpricedRequests: 0,
      fastRequests: 0,
    })
  })

  it("applies the same --since window as the prompts, and months in the profile's time zone", () => {
    const usage = summarizeUsage(
      [
        input("claude-code", [
          event("2026-08-31T23:59:59Z", "claude-opus-5-5", { input: 1000 }), // before --since
          event("2026-09-30T16:30:00Z", "claude-opus-5-5", { input: 1_000_000 }), // Oct 1 in Taipei
          event("2026-09-15T00:00:00Z", "claude-opus-5-5", { output: 1_000_000 }),
          event("2026-10-29T00:00:01Z", "claude-opus-5-5", { input: 1000 }), // after now
        ]),
      ],
      options,
    )
    const cc = usage.sources[0]!
    expect(cc.totals.requests).toBe(2)
    expect(cc.totals.tokens.input).toBe(1_000_000)
    expect(cc.totals.cost).toBeCloseTo(4 + 20, 9)
    expect(cc.byMonth.map((m) => [m.month, m.usage.requests])).toEqual([
      ["2026-09", 1],
      ["2026-10", 1],
    ])
  })

  it("an unknown model keeps its tokens but no cost, and is listed; the rest is still priced", () => {
    const usage = summarizeUsage(
      [
        input("codex", [
          event("2026-10-01T00:00:00Z", "gpt-6.1-sol", { input: 100_000 }, "codex"),
          event("2026-10-02T00:00:00Z", "codex-auto-review", { input: 50 }, "codex"),
          event("2026-10-02T00:00:00Z", "codex-auto-review", { input: 50 }, "codex"),
          event("2026-10-03T00:00:00Z", null, { output: 7 }, "codex"),
        ]),
      ],
      options,
    )
    const codex = usage.sources[1]!
    expect(codex.totals.tokens.input).toBe(100_100)
    expect(codex.totals.tokens.output).toBe(7)
    expect(codex.totals.cost).toBeCloseTo(0.2, 9)
    expect(codex.totals.unpricedRequests).toBe(3)
    expect(codex.unpricedModels).toEqual(["codex-auto-review"])
    expect(codex.byModel.map((m) => [m.model, m.usage.requests, m.usage.cost])).toEqual([
      ["gpt-6.1-sol", 1, expect.closeTo(0.2, 9)],
      ["codex-auto-review", 2, null],
      [null, 1, null],
    ])
  })

  it("fast responses are priced at fast rates and counted; an unknown tier stays unpriced", () => {
    const usage = summarizeUsage(
      [
        input("codex", [
          event("2026-10-01T00:00:00Z", "gpt-6.1-sol", { input: 100_000 }, "codex", "fast"),
          event("2026-10-01T00:01:00Z", "gpt-6.1-sol", { input: 100_000 }, "codex"),
          event("2026-10-01T00:02:00Z", "gpt-6.1-sol", { input: 100_000 }, "codex", "other"),
        ]),
      ],
      options,
    )
    const totals = usage.sources[1]!.totals
    // $4 fast + $2 standard per million input tokens; the unknown tier is not guessed
    expect(totals.cost).toBeCloseTo(0.4 + 0.2, 9)
    expect(totals.fastRequests).toBe(1)
    expect(totals.unpricedRequests).toBe(1)
  })

  it("only unpriced usage → cost null, not zero", () => {
    const usage = summarizeUsage(
      [input("codex", [event("2026-10-01T00:00:00Z", "mystery", { input: 9 }, "codex")])],
      options,
    )
    expect(usage.sources[1]!.totals.cost).toBeNull()
    expect(usage.sources[1]!.byMonth[0]!.usage.cost).toBeNull()
  })

  it("records the period the usage covers, which can differ from the prompts' period", () => {
    const usage = summarizeUsage(
      [
        input("claude-code", [
          event("2026-08-01T00:00:00Z", "claude-opus-5-5", { input: 1 }), // before --since
          event("2026-09-10T00:00:00Z", "claude-opus-5-5", { input: 1 }),
        ]),
        input("codex", [event("2026-10-02T08:00:00Z", "gpt-6.1-sol", { input: 1 }, "codex")]),
      ],
      options,
    )
    expect(usage.range).toEqual({
      from: DateTime.makeUnsafe("2026-09-10T00:00:00Z"),
      to: DateTime.makeUnsafe("2026-10-02T08:00:00Z"),
    })
    expect(summarizeUsage([], options).range).toBeNull()
  })

  it("keeps the plan and the diagnostics", () => {
    const plan = { kind: "subscription", name: "team", detail: null } as const
    const diagnostics = { unreadableFiles: 1, badLines: 2, duplicates: 3, markerSessions: 4 }
    const usage = summarizeUsage([{ source: "claude-code", events: [], plan, diagnostics }], {
      ...options,
      since: null,
    })
    expect(usage.sources[0]!.plan).toEqual(plan)
    expect(usage.sources[0]!.diagnostics).toEqual(diagnostics)
  })
})
