import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"

const sample = () =>
  Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )

const balance = (axes: Array<[string, number, number]>) => ({
  axes: axes.map(([key, first, second]) => ({
    key: key as "framing" | "pacing" | "control" | "closure",
    first,
    second,
    examples: { first: [], second: [] },
  })),
  conversations: 40,
  rejected: 0,
})

describe("axis balance scale", () => {
  it("shows each axis as the share of conversations for each way, in every language", async () => {
    const p = {
      ...(await sample()),
      axisBalance: balance([
        ["framing", 9, 3],
        ["pacing", 2, 2],
        ["control", 1, 0],
        ["closure", 0, 0],
      ]),
    }
    const html = renderHtml(p)
    const out = /<section class="axis-balance">.*?<\/section>/s.exec(html)?.[0] ?? ""
    expect(out).not.toBe("")
    // framing: 9 of 12 conversations define first
    expect(out).toContain("Define first 75%")
    expect(out).toContain("Explore first 25%")
    expect(out).toContain('style="width:75%"')
    expect(out).toContain("先定義 75%")
    expect(out).toContain("12 conversations")
    expect(out).not.toContain(p.engine.model!)
    // pacing: an even split is shown as such
    expect(out).toContain("Step by step 50%")
    // control and closure have too few conversations to show a share
    expect(out).not.toContain("Direct 100%")
    expect(out).not.toContain("Check criteria")
  })

  it("is left out when no axis has enough conversations, and for profiles without a measurement", async () => {
    const base = await sample()
    expect(renderHtml({ ...base, axisBalance: null })).not.toContain('class="axis-balance"')
    expect(renderHtml({ ...base, axisBalance: balance([["framing", 1, 1]]) })).not.toContain(
      'class="axis-balance"',
    )
  })
})

describe("preference evidence next to the scale", () => {
  it("drops the cited-choice coverage note for an axis the scale measures", async () => {
    const base = await sample()
    const portrait = {
      introduction: "Intro.",
      chapters: [{ title: "Chapter", body: "Body.", evidence: [] }],
      axes: (["framing", "pacing", "control", "closure"] as const).map((key) => ({
        key,
        explanation: "Observed.",
        coverage: {
          citedSessions: 4,
          analysedSessions: 288,
          periods: 4,
          scope: "cited_choices" as const,
        },
        sides: [{ pole: "first" as const, context: "reviews", sessions: 2, evidence: [] }],
      })),
    }
    const note = "4 conversations with cited choices"
    expect(renderHtml({ ...base, portrait, axisBalance: null })).toContain(note)
    const measured = renderHtml({
      ...base,
      portrait,
      axisBalance: balance([
        ["framing", 9, 3],
        ["pacing", 2, 2],
        ["control", 5, 5],
        ["closure", 4, 1],
      ]),
    })
    expect(measured).not.toContain(note)
  })
})
