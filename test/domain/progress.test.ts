import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { snapshotOf } from "../../src/domain/Progress.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)

describe("progress snapshot", () => {
  it.effect("keeps the measured numbers and improvement titles, never quotes", () =>
    Effect.gen(function* () {
      const p = yield* decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))
      const snap = snapshotOf(p)
      expect(snap.correctionRate).toBe(p.stats.correctionRate)
      expect(snap.terseShare).toBe(p.stats.promptHabits.terseShare)
      expect(snap.nightShare).toBeCloseTo(
        [22, 23, 0, 1, 2, 3, 4].reduce((n, h) => n + p.stats.hourHistogram[h]!, 0) /
          p.stats.hourHistogram.reduce((a, b) => a + b, 0),
        4,
      )
      expect(snap.promptShares.planFirst).toBe(p.stats.techniques!.prompts.planFirst)
      expect(snap.toolShares.subagents).toBeCloseTo(
        p.stats.techniques!.tools.subagents.sessions / p.stats.techniques!.coveredSessions,
        4,
      )
      expect(snap.improvements).toEqual(p.improvements.map((i) => i.title))
      for (const q of p.traits.flatMap((t) => t.evidence.map((e) => e.quote)))
        expect(JSON.stringify(snap)).not.toContain(q)
    }),
  )
})
