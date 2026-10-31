import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"

const sample = () =>
  Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )

const frequency = (
  sessions: number,
  byProject: Array<[string, number, number]> = [],
  analysedSessions = 200,
) => ({
  sessions,
  analysedSessions,
  byProject: byProject.map(([project, s, a]) => ({ project, sessions: s, analysedSessions: a })),
})

/** The sample's traits, measured: 50%, 100%, 25%, plus project splits. */
const measured = async (): Promise<Profile> => {
  const base = await sample()
  const projects = (a: number, b: number): Array<[string, number, number]> => [
    ["PROJECT_ALPHA", a, 120],
    ["PROJECT_BETA", b, 80],
    ["PROJECT_TINY", 1, 3],
    // stored by a report from before the threshold: still too few to draw
    ["PROJECT_SMALL", 5, 12],
  ]
  const values = [
    frequency(100, projects(70, 30)),
    frequency(200, projects(120, 80)),
    frequency(50, projects(10, 40)),
  ]
  return {
    ...base,
    traits: base.traits.slice(0, 3).map((t, i) => ({ ...t, frequency: values[i]! })),
  }
}

const section = (html: string, cls: string) =>
  new RegExp(`<section class="${cls}">.*?</section>`, "s").exec(html)?.[0] ?? ""

describe("trait radar", () => {
  it("draws every measured trait on its own 0–100% axis, in every language", async () => {
    const p = await measured()
    const radar = section(renderHtml(p), "trait-radar")
    expect(radar).not.toBe("")
    expect(radar).toContain("<svg")
    // one point per trait
    expect(radar.match(/class="radar-point"/g)).toHaveLength(3)
    // each trait is counted on its own: one at 100% does not shrink the others
    for (const share of ["50%", "100%", "25%"]) expect(radar).toContain(share)
    expect(radar).toContain("100 of 200 conversations")
    expect(radar).toContain("200 段對話中的 100 段")
    expect(radar).toContain(p.traits[0]!.name)
    expect(radar).toContain(p.translations["zh-TW"]!.traits[0]!.name)
    expect(radar).toContain("not an ability score")
    expect(radar).toContain(`Measured by ${p.engine.model}`)
    expect(radar).toContain(`由 ${p.engine.model} 量測`)
  })

  it("adds one small radar per project with enough conversations, on the same axes", async () => {
    const p = await measured()
    const projects = section(renderHtml(p), "trait-radar-projects")
    expect(projects.match(/<svg/g)).toHaveLength(2)
    expect(projects).toContain("PROJECT_ALPHA")
    expect(projects).toContain("PROJECT_BETA")
    expect(projects).not.toContain("PROJECT_TINY")
    expect(projects).not.toContain("PROJECT_SMALL")
    expect(projects).toContain("20 or more analysed conversations")
    // --exclude projects hides the project radars with their names
    const hidden = renderHtml(p, { look: "classic", cardHide: [], exclude: ["projects"] })
    expect(section(hidden, "trait-radar")).not.toBe("")
    expect(hidden).not.toContain("PROJECT_ALPHA")
  })

  it("is left out with fewer than three measured traits", async () => {
    const p = await measured()
    const two = { ...p, traits: p.traits.map((t, i) => (i === 2 ? { ...t, frequency: null } : t)) }
    expect(section(renderHtml(two), "trait-radar")).toBe("")
    expect(section(renderHtml(await sample()), "trait-radar")).toBe("")
  })
})
