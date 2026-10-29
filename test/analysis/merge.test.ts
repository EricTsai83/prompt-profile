import { describe, expect, it } from "@effect/vitest"
import type { Observation } from "../../src/domain/ChunkObservations.ts"
import {
  capEvidence,
  groupForMerge,
  mergeBudget,
  observationsText,
} from "../../src/analysis/merge.ts"

const obs = (claim: string): Observation => ({
  dimension: "growth",
  claim,
  evidence: [{ promptId: "p", quote: "q" }],
})

describe("groupForMerge", () => {
  it("keeps order and fills groups up to half the limit", () => {
    const all = Array.from({ length: 10 }, (_, i) => obs(`claim ${i}`))
    const one = observationsText([all[0]!]).length
    const groups = groupForMerge(all, one * 6) // ~3 observations per group
    expect(groups.flat()).toEqual(all)
    expect(groups.map((g) => g.length)).toEqual([3, 3, 3, 1])
  })

  it("an observation larger than half the limit gets its own group", () => {
    const big = obs("x".repeat(500))
    const groups = groupForMerge([obs("a"), big, obs("b")], 200)
    expect(groups).toEqual([[obs("a")], [big], [obs("b")]])
  })

  it("no observations → one empty group", () => {
    expect(groupForMerge([], 100)).toEqual([[]])
  })
})

describe("capEvidence", () => {
  const withEvidence = (ids: ReadonlyArray<string>): Observation => ({
    dimension: "growth",
    claim: "c",
    evidence: ids.map((promptId, i) => ({ promptId, quote: `q${i}` })),
  })

  it("keeps at most `max` items, preferring different prompts, in their original order", () => {
    const [capped] = capEvidence([withEvidence(["a", "a", "a", "b", "c", "d", "e"])], 4)
    expect(capped!.evidence).toEqual([
      { promptId: "a", quote: "q0" },
      { promptId: "b", quote: "q3" },
      { promptId: "c", quote: "q4" },
      { promptId: "d", quote: "q5" },
    ])
  })

  it("fills up with repeats when there are not enough different prompts", () => {
    const [capped] = capEvidence([withEvidence(["a", "a", "b", "a"])], 3)
    expect(capped!.evidence.map((e) => e.quote)).toEqual(["q0", "q1", "q2"])
  })

  it("leaves small observations untouched", () => {
    const o = withEvidence(["a", "b"])
    expect(capEvidence([o], 4)).toEqual([o])
  })
})

describe("capEvidence across sessions", () => {
  it("keeps quotes from other conversations before more quotes from one long session", () => {
    const o: Observation = {
      dimension: "communication",
      claim: "corrects the approach",
      evidence: ["s1:1", "s1:2", "s1:3", "s1:4", "s2:1", "s3:7"].map((promptId) => ({
        promptId,
        quote: promptId,
      })),
    }
    const [capped] = capEvidence([o], 4, (id) => id.split(":")[0]!)
    expect(capped!.evidence.map((e) => e.promptId)).toEqual(["s1:1", "s1:2", "s2:1", "s3:7"])
  })
})

describe("mergeBudget", () => {
  it("asks a group for its share of the target size", () => {
    // 150k of observations against a 100k limit: aim at 80k, so keep about 53%
    expect(mergeBudget(40, 150_000, 100_000)).toBe(21)
  })

  it("never asks for fewer than one observation per four input quotes' worth", () => {
    // every input observation must keep a quote, and a merged observation holds at most 4
    expect(mergeBudget(40, 1_000_000, 100_000)).toBe(10)
    expect(mergeBudget(3, 1_000_000, 100_000)).toBe(1)
  })

  it("never asks for more than the group already has", () => {
    expect(mergeBudget(12, 50_000, 100_000)).toBe(12)
  })
})
