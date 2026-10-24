import { describe, expect, it } from "@effect/vitest"
import type { Stats } from "../../src/domain/Stats.ts"
import {
  chapters,
  chronotype,
  correctionEvery,
  nightShare,
  promptsPerSession,
} from "../../src/report/derive.ts"

const hours = (entries: Record<number, number>) =>
  Array.from({ length: 24 }, (_, h) => entries[h] ?? 0)

const stats = (patch: Partial<Stats>): Stats => ({ ...({} as Stats), ...patch }) as Stats

describe("derived measures", () => {
  it("night share counts 22:00–04:59", () => {
    expect(nightShare(stats({ hourHistogram: hours({ 22: 2, 3: 2, 4: 1, 5: 5, 12: 10 }) }))).toBe(
      0.25,
    )
    expect(nightShare(stats({ hourHistogram: hours({}) }))).toBe(0)
  })

  it("the chronotype is the busiest four hours, wrapping past midnight", () => {
    expect(chronotype(stats({ hourHistogram: hours({ 23: 5, 0: 5, 1: 5, 2: 5, 12: 9 }) }))).toEqual(
      { start: 23, end: 3, share: 20 / 29 },
    )
    expect(chronotype(stats({ hourHistogram: hours({}) }))).toBeNull()
  })

  it("prompts per session and corrections are plain ratios", () => {
    expect(promptsPerSession(stats({ totalPrompts: 50, totalSessions: 8 }))).toBe(6.3)
    expect(promptsPerSession(stats({ totalPrompts: 0, totalSessions: 0 }))).toBeNull()
    expect(correctionEvery(stats({ correctionRate: 0.12 }))).toBe(8)
    expect(correctionEvery(stats({ correctionRate: 0 }))).toBeNull()
  })

  it("chapters: the dominant project per month, consecutive months merged", () => {
    const day = (date: string, byProject: Array<number>) => ({
      date,
      count: byProject.reduce((a, b) => a + b, 0),
      byProject,
    })
    const s = stats({
      activity: {
        projects: ["a", "b"],
        days: [
          day("2026-05-02", [5, 1, 0]),
          day("2026-06-10", [3, 0, 1]),
          day("2026-07-01", [0, 4, 9]),
          day("2026-08-15", [0, 6, 1]),
          day("2026-08-20", [1, 2, 0]),
        ],
        gridByProject: [],
      },
    })
    expect(chapters(s)).toEqual([
      { from: "2026-05", to: "2026-06", slot: 0, prompts: 10 },
      // "other" never names a chapter while a named project has prompts that month
      { from: "2026-07", to: "2026-08", slot: 1, prompts: 23 },
    ])
    expect(chapters(stats({ activity: { projects: [], days: [], gridByProject: [] } }))).toEqual([])
  })
})
