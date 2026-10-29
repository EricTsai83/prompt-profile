import { expect, it } from "vitest"
import { retainOmittedEvidence, capEvidence } from "../../src/analysis/merge.ts"
import { verifyCompleteEvidence } from "../../src/analysis/verify.ts"
import { verifyPortrait } from "../../src/analysis/portrait.ts"

const evidence = [
  { promptId: "a", quote: "Plan first for the migration." },
  { promptId: "b", quote: "Implement the small fix directly." },
]
const original = [
  { dimension: "work_style" as const, claim: "Planning depends on the task.", evidence },
]

it("restores an observation a merge dropped entirely, with its context", () => {
  const other = {
    dimension: "growth" as const,
    claim: "Learns Rust.",
    evidence: [{ promptId: "c", quote: "Explain lifetimes again." }],
  }
  const merged = [{ ...original[0]!, claim: "Planning depends on the task.", evidence }]
  expect(retainOmittedEvidence([...original, other], merged)).toEqual([...merged, other])
  expect(retainOmittedEvidence(original, original)).toEqual(original)
})

it("lets a merge or evidence cap trim the quotes of a claim it keeps, so merging can shrink", () => {
  const merged = [{ ...original[0]!, evidence: [evidence[0]!] }]
  expect(retainOmittedEvidence(original, merged)).toEqual(merged)
  expect(retainOmittedEvidence(original, capEvidence(original, 1))).toEqual(
    capEvidence(original, 1),
  )
})

it("rejects an entire compound assertion when any citation is fabricated", () => {
  const texts = new Map([["a", evidence[0]!.quote]])
  expect(verifyCompleteEvidence(evidence, texts, { kept: 0, dropped: 0 })).toEqual([])
  expect(
    verifyCompleteEvidence([evidence[0]!, evidence[0]!], texts, { kept: 0, dropped: 0 }),
  ).toEqual([evidence[0]])
})

it("does not retain portrait introduction or axis assertions after partial support rejection", () => {
  const portrait = {
    introduction: "They always plan first.",
    chapters: [{ title: "Planning", body: "They plan and verify every task.", evidence }],
    axes: [],
  }
  expect(
    verifyPortrait(portrait, new Map([["a", evidence[0]!.quote]]), new Map(), {
      kept: 0,
      dropped: 0,
    }),
  ).toBeNull()
})

it("does not invent independent sessions when source metadata is missing", async () => {
  const { verifyTraits } = await import("../../src/analysis/verify.ts")
  const traits = verifyTraits(
    [{ name: "Planner", description: "They plan.", confidence: "high", evidence }],
    new Map(evidence.map((e) => [e.promptId, e.quote])),
    { kept: 0, dropped: 0 },
  )
  expect(traits[0]?.support).toBeNull()
  expect(traits[0]?.confidence).toBe("low")
})
