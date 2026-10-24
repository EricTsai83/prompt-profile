import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { renderHtml, renderShareHtml } from "../../src/report/index.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)
const sample = () => decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))
const englishOnly = (p: Profile): Profile => ({ ...p, languages: ["en"], translations: {} })

describe("How I work with AI: the capability map", () => {
  it.effect("the private report shows every stage and every name with its details", () =>
    Effect.gen(function* () {
      const out = renderHtml(englishOnly(yield* sample()))
      for (const stage of ["Plan", "Delegate", "Extend", "Verify", "Ship"])
        expect(out).toContain(`<h3>${stage}</h3>`)
      expect(out).toContain("Adoption over time")
      for (const skill of [
        "code-review",
        "review-with-two-models",
        "vercel:deploy",
        "release-notes",
      ])
        expect(out).toContain(skill)
      expect(out).toContain("Implement a change, then get an independent second-model review")
      expect(out).toContain("18 sessions · Jul 12 – Oct 22")
      for (const name of [
        "Explore",
        "migration-planner",
        "github",
        "acme-billing",
        "claude-opus-5-5",
      ])
        expect(out).toContain(name)
      expect(out).toContain("Up to 4 sessions at once")
    }),
  )

  it.effect("the share page shows public names and counts custom ones, and has no quotes", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const out = renderShareHtml(englishOnly(p))
      for (const name of [
        "code-review",
        "vercel:deploy",
        "Explore",
        "github",
        "linear",
        "claude-opus-5-5",
      ])
        expect(out).toContain(name)
      for (const hidden of [
        "review-with-two-models",
        "second-model review",
        "release-notes",
        "migration-planner",
        "acme-billing",
      ])
        expect({ hidden, shown: out.includes(hidden) }).toEqual({ hidden, shown: false })
      expect(out).toContain("2 custom skills")
      expect(out).toContain("1 custom agent type")
      expect(out).toContain("1 private server")
      for (const q of [...p.traits, ...p.dimensions, ...p.improvements].flatMap((x) =>
        x.evidence.map((e) => e.quote),
      ))
        expect(out.includes(q)).toBe(false)
    }),
  )

  it.effect("the section is translated", () =>
    Effect.gen(function* () {
      const out = renderHtml(yield* sample())
      expect(out).toContain("委派")
      expect(out).toContain("用過的 skills")
    }),
  )

  it.effect("profiles without technique data leave the section out", () =>
    Effect.gen(function* () {
      const p = englishOnly(yield* sample())
      expect(renderHtml({ ...p, stats: { ...p.stats, techniques: null } })).not.toContain(
        "How I work with AI",
      )
    }),
  )
})
