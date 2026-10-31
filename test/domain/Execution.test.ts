import { describe, expect, it } from "vitest"
import { summarizeExecution, type ExecutionAttempt } from "../../src/domain/Execution.ts"
import { ZERO_TOKENS } from "../../src/domain/Usage.ts"

const attempt = (overrides: Partial<ExecutionAttempt> = {}): ExecutionAttempt => ({
  id: 1,
  callId: 1,
  stage: "map",
  engine: "codex",
  model: null,
  modelSource: null,
  startedAtMs: 100,
  finishedAtMs: 300,
  outcome: "succeeded",
  tokens: { ...ZERO_TOKENS, input: 10, output: 5, cacheRead: 3, reasoning: 2 },
  cost: { provenance: "estimated", usd: 0.01, pricingVersion: "fake", tier: "standard" },
  ...overrides,
})

describe("execution accounting", () => {
  it("distinguishes no calls from unavailable historic measurements", () => {
    expect(summarizeExecution([], 0, 100, 150)).toMatchObject({
      calls: 0,
      retries: 0,
      wallDurationMs: 50,
      callDurationMs: 0,
      tokens: { state: "known-zero", unknownAttempts: 0 },
      cost: { state: "known-zero", usd: 0 },
    })
    expect(summarizeExecution([attempt({ tokens: null, cost: null })], 0, 100, 300)).toMatchObject({
      tokens: { state: "unavailable", unknownAttempts: 1 },
      cost: { state: "unavailable", unknownAttempts: 1 },
    })
  })

  it("retains subtotals and missing coverage independently for tokens and cost", () => {
    const summary = summarizeExecution(
      [
        attempt(),
        attempt({ id: 2, callId: 2, tokens: null, cost: null, outcome: "failed" }),
        attempt({ id: 3, callId: 2, cost: null }),
      ],
      4,
      100,
      400,
    )
    expect(summary).toMatchObject({
      calls: 3,
      retries: 1,
      localCacheHits: 4,
      wallDurationMs: 300,
      callDurationMs: 600,
      tokens: {
        state: "partial",
        unknownAttempts: 1,
        subtotal: { input: 20, output: 10, cacheRead: 6, reasoning: 4 },
      },
      cost: {
        state: "partial",
        usd: 0.01,
        unknownAttempts: 2,
        estimatedAttempts: 1,
        reportedAttempts: 0,
      },
    })
  })

  it("separates reported and estimated amounts and does not count reasoning twice", () => {
    const summary = summarizeExecution(
      [
        attempt(),
        attempt({
          id: 2,
          callId: 2,
          engine: "claude-code",
          cost: { provenance: "reported", usd: 0.02, pricingVersion: null, tier: null },
        }),
      ],
      0,
      100,
      300,
    )
    expect(summary.tokens).toMatchObject({ state: "complete", total: 36 })
    expect(summary.cost).toMatchObject({
      state: "complete",
      usd: 0.03,
      reportedAttempts: 1,
      estimatedAttempts: 1,
    })
  })

  it("keeps in-flight and cancelled attempts unknown instead of free", () => {
    const summary = summarizeExecution(
      [
        attempt({ finishedAtMs: null, outcome: "running", tokens: null, cost: null }),
        attempt({ id: 2, callId: 2, outcome: "cancelled", tokens: null, cost: null }),
      ],
      0,
      100,
      400,
    )
    expect(summary).toMatchObject({
      calls: 2,
      running: 1,
      cancelled: 1,
      callDurationMs: 200,
      cost: { state: "unavailable" },
    })
  })
})

it("retains partially supplied token categories even when no call has complete token coverage", () => {
  const summary = summarizeExecution(
    [
      attempt({
        tokens: { ...ZERO_TOKENS, output: 7 },
        unknownTokenKinds: [
          "input",
          "cacheRead",
          "cacheWrite5m",
          "cacheWrite1h",
          "cacheWriteUnknown",
        ],
      }),
    ],
    0,
    100,
    300,
  )
  expect(summary.tokens).toMatchObject({ state: "partial", total: 7, unknownAttempts: 1 })
})
