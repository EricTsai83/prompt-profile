import { describe, expect, it } from "@effect/vitest"
import { peakHour } from "../../src/domain/Stats.ts"

const withHours = (hourHistogram: ReadonlyArray<number>) => ({ hourHistogram })

describe("peakHour", () => {
  it("is the busiest hour, the earliest on ties", () => {
    const hours = Array.from({ length: 24 }, (_, h) => (h === 9 || h === 22 ? 5 : 1))
    expect(peakHour(withHours(hours))).toBe(9)
  })

  it("is null without any prompt", () => {
    expect(peakHour(withHours(Array.from({ length: 24 }, () => 0)))).toBeNull()
  })
})
