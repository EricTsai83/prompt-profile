import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { diffProfiles, rangeOf, structureOf } from "../../../scripts/experiment/compare.ts"
import { decodeProfile, type Profile } from "../../../src/domain/Profile.ts"

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), "utf8"))

const base: Profile = {
  ...Effect.runSync(decodeProfile(fixture("profile.sample.json"))),
  portrait: fixture("portrait.sample.json"),
}

describe("diffProfiles", () => {
  it("finds no difference between identical profiles", () => {
    expect(diffProfiles(base, base, "en")).toEqual({ wording: [], decisions: [], missing: [] })
  })

  it("reports changed wording separately from structured decisions", () => {
    const d = diffProfiles(base, { ...base, headline: "A different sentence" }, "en")
    expect(d.wording.map((c) => c.field)).toEqual(["headline"])
    expect(d.decisions).toEqual([])
  })

  it("reports a changed way of working and the resulting role as decisions", () => {
    const portrait = base.portrait!
    const only = (pole: "first" | "second") => [
      { pole, context: "c", evidence: portrait.chapters[0]!.evidence, sessions: 2 },
    ]
    const withSides = (sides: (i: number) => ReturnType<typeof only>) => ({
      ...base,
      portrait: { ...portrait, axes: portrait.axes.map((a, i) => ({ ...a, sides: sides(i) })) },
    })
    const resolved = withSides(() => only("first"))
    const flipped = withSides((i) => only(i === 0 ? "second" : "first"))
    const both = withSides((i) => (i === 0 ? [...only("first"), ...only("second")] : only("first")))
    const d = diffProfiles(resolved, flipped, "en")
    expect(d.decisions.map((c) => c.field)).toEqual(["role", `axis ${portrait.axes[0]!.key}`])
    expect(structureOf(resolved).role).not.toBeNull()
    expect(structureOf(both).role).toBeNull()
    expect(structureOf(both).axes[portrait.axes[0]!.key]).toBe("both")
    expect(d.wording).toEqual([])
  })

  it("reports missing content: a portrait or a language one side lacks", () => {
    const noPortrait = diffProfiles(base, { ...base, portrait: null }, "en")
    expect(noPortrait.missing).toContainEqual({
      field: "portrait",
      baseline: "present",
      candidate: "missing",
    })
    const english = { ...base, languages: ["en"] as const, translations: {} }
    const lang = base.languages.find((l) => l !== "en")
    if (lang === undefined) return
    expect(diffProfiles(base, english as never, lang).missing).toContainEqual({
      field: `${lang} text`,
      baseline: "present",
      candidate: "missing",
    })
  })
})

describe("rangeOf", () => {
  it("ignores unknown values and reports the sample size", () => {
    expect(rangeOf([3, null, 1])).toEqual({ min: 1, max: 3, n: 2 })
    expect(rangeOf([null])).toBeNull()
  })
})
