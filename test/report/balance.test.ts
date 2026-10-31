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
