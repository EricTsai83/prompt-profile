import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { renderHtml, renderShareHtml } from "../../src/report/index.ts"
import { TECHNIQUE_VIEWS } from "../../src/report/techniques.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)
const sample = () => decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))
const englishOnly = (p: Profile): Profile => ({ ...p, languages: ["en"], translations: {} })

describe("How I work with AI", () => {
  it.effect("every layout shows the workflow and prompt techniques with definitions", () =>
    Effect.gen(function* () {
      const p = englishOnly(yield* sample())
      for (const techniques of TECHNIQUE_VIEWS) {
        const out = renderHtml(p, { look: "classic", cardHide: [], techniques })
        expect({ techniques, ok: out.includes("How I work with AI") }).toEqual({
          techniques,
          ok: true,
        })
        expect(out).toContain("Delegates to subagents")
        expect(out).toContain("States constraints")
        expect(out).toContain('data-tip-en="Sessions where the agent started subagents')
        expect(out).toContain("Up to 4 sessions at once")
      }
    }),
  )

  it.effect("the share page shows techniques but no quotes in any layout", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const quotes = [...p.traits, ...p.dimensions, ...p.improvements].flatMap((x) =>
        x.evidence.map((e) => e.quote),
      )
      for (const techniques of TECHNIQUE_VIEWS) {
        const out = renderShareHtml(p, { look: "classic", cardHide: [], techniques })
        expect(out).toContain("委派子代理")
        for (const q of quotes)
          expect({ techniques, leaked: out.includes(q) }).toEqual({ techniques, leaked: false })
      }
    }),
  )

  it.effect("profiles without technique data leave the section out", () =>
    Effect.gen(function* () {
      const p = englishOnly(yield* sample())
      const out = renderHtml({ ...p, stats: { ...p.stats, techniques: null } })
      expect(out).not.toContain("How I work with AI")
    }),
  )
})
