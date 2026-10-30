import { expect, it } from "vitest"
import { verifyNarrative } from "../../src/analysis/narrative.ts"
const evidence = [{ promptId: "a", quote: "Keep the API" }]
const texts = new Map([["a", "Keep the API"]])
const claim = { text: "They require compatibility.", evidence }
const plan = {
  thread: claim,
  representativeEpisodeId: null,
  chapters: [{ title: "Compatibility", focus: claim, episodeIds: [], patternClaims: [] }],
  nuance: claim,
  closing: claim,
}
const portrait = {
  introduction: "They require compatibility.",
  chapters: [{ title: "Compatibility", body: "They require compatibility.", evidence }],
  axes: [],
}
it("keeps a supported outline without inventing an episode from isolated observations", () => {
  expect(verifyNarrative(plan, portrait, [], [], texts)).toEqual(plan)
})
it("rejects fabricated outline evidence and references before allowing connected prose", () => {
  expect(
    verifyNarrative(
      { ...plan, thread: { ...claim, evidence: [{ promptId: "a", quote: "It passed" }] } },
      portrait,
      [],
      [],
      texts,
    ),
  ).toBeNull()
  expect(
    verifyNarrative({ ...plan, representativeEpisodeId: "missing" }, portrait, [], [], texts),
  ).toBeNull()
  expect(
    verifyNarrative(
      { ...plan, chapters: [{ ...plan.chapters[0]!, patternClaims: ["unsupported pattern"] }] },
      portrait,
      [],
      [],
      texts,
    ),
  ).toBeNull()
  expect(verifyNarrative(null, portrait, [], [], texts)).toBeNull()
})
it("rejects chapter drift from the outline's evidence and ordering", () => {
  expect(
    verifyNarrative(
      plan,
      { ...portrait, chapters: [{ ...portrait.chapters[0]!, title: "An unrelated title" }] },
      [],
      [],
      texts,
    ),
  ).toBeNull()
  expect(
    verifyNarrative(
      plan,
      {
        ...portrait,
        chapters: [
          { ...portrait.chapters[0]!, evidence: [{ promptId: "b", quote: "Another request" }] },
        ],
      },
      [],
      [],
      new Map([...texts, ["b", "Another request"]]),
    ),
  ).toBeNull()
})
