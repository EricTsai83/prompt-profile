import { expect, it } from "vitest"
import { inspectClaimSupport } from "../../scripts/eval-quality.ts"

const prompts = [
  { id: "a", session: "one", text: "Explain the alert threshold." },
  { id: "b", session: "one", text: "Explain the alert threshold again." },
  { id: "c", session: "two", text: "Implement the fix directly." },
]

it("reports authentic quotes and session spread without certifying semantic support", () => {
  const result = inspectClaimSupport(
    [
      { promptId: "a", quote: "Explain the alert threshold." },
      { promptId: "b", quote: "Explain the alert threshold again." },
    ],
    prompts,
  )
  expect(result.quoteValidity).toEqual({ kept: 2, dropped: 0 })
  expect(result.selectedEvidence).toEqual({ prompts: 2, sessions: 1 })
  expect(result.availableSource).toEqual({ prompts: 3, sessions: 2 })
  expect(result.manualReview).toEqual({
    semanticSupport: "unreviewed",
    specificity: "unreviewed",
    contradictions: "unreviewed",
    uncertainty: "unreviewed",
  })
})

it("excludes missing, fabricated and duplicate quotes from selected support", () => {
  const result = inspectClaimSupport(
    [
      { promptId: "a", quote: "Explain the alert threshold." },
      { promptId: "a", quote: "Explain the alert threshold." },
      { promptId: "b", quote: "I deployed the fix." },
      { promptId: "missing", quote: "Explain" },
    ],
    prompts,
  )
  expect(result.quoteValidity).toEqual({ kept: 1, dropped: 3 })
  expect(result.selectedEvidence).toEqual({ prompts: 1, sessions: 1 })
})

it("keeps authored semantic failures separate from successful quote checks", async () => {
  const { default: cases } = await import("../eval/claim-support/cases.json")
  expect(cases).toHaveLength(6)
  for (const item of cases) {
    const result = inspectClaimSupport(item.evidence, item.prompts)
    expect(result.quoteValidity.dropped).toBe(0)
    expect(result.selectedEvidence.sessions).toBe(item.expectedSelectedSessions)
    expect(result.manualReview.semanticSupport).toBe("unreviewed")
    expect(item.before).not.toBe(item.after)
  }
})
