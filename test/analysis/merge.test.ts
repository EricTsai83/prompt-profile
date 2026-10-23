import { describe, expect, it } from "@effect/vitest"
import type { Observation } from "../../src/domain/ChunkObservations.ts"
import { groupForMerge, observationsText } from "../../src/analysis/merge.ts"

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
