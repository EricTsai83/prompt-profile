import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"
import { reportContents } from "../../src/report/visibility.ts"

const sample = () =>
  Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )

const english = (p: Profile): Profile => ({ ...p, languages: ["en"], translations: {} })
const section = (html: string) => {
  const start = html.indexOf('<section class="episodes"')
  return start === -1 ? "" : html.slice(start, html.indexOf("</section>", start))
}
const OPTIONS = { look: "classic", cardHide: [], exclude: [] } as const

describe("interaction episodes in the report", () => {
  it("shows each episode on the facts page, in order, with turn numbers and gaps", async () => {
    const out = renderHtml(english(await sample()))
    const episodes = section(out)
    expect(out.indexOf('<section class="episodes"')).toBeGreaterThan(
      out.indexOf('<section id="detail"'),
    )
    // E1 is turns 1, 2 and 5 of 9: two prompts between, four after
    expect(episodes).toContain("Planning a canvas export feature")
    expect(episodes).toContain("Prompt 1 of 9")
    expect(episodes).toContain("Prompt 5 of 9")
    expect(episodes).toContain("2 prompts not shown")
    expect(episodes).toContain("4 later prompts not shown")
    expect(episodes.indexOf("same for the SVG export")).toBeLessThan(
      episodes.indexOf("no, keep the old API"),
    )
    expect(episodes).toContain("Correction")
  })

  it("never presents a result the record does not show", async () => {
    const episodes = section(renderHtml(english(await sample())))
    expect(episodes).toContain("Result not visible in the record")
    expect(episodes).toContain("The user reported the result in prompt 6")
    expect(episodes).toContain("The user dropped this direction in prompt 4")
    expect(episodes).toContain("Only the user’s prompts are recorded")
  })

  it("separates analysed conversations from the whole history and counts rejections", async () => {
    const episodes = section(renderHtml(english(await sample())))
    expect(episodes).toContain("Showing 3 of 11 verified episodes")
    expect(episodes).toContain("from the 280 analysed conversations, not all 312 in the history")
    expect(episodes).toContain("3 proposed episodes were rejected")
    expect(episodes).toContain("2 stated results were withdrawn")
  })

  it("shows recurring patterns with their spread and counterexamples", async () => {
    const episodes = section(renderHtml(english(await sample())))
    expect(episodes).toContain("Adds scope and corrections after the first request")
    expect(episodes).toContain("In 2 conversations across 2 analysed periods")
    expect(episodes).toContain('href="#episode-E3"')
    expect(episodes).toContain("Went the other way")
  })

  it("renders translated task descriptions and labels", async () => {
    const zh: Profile = { ...(await sample()), languages: ["zh-TW"] }
    const episodes = section(renderHtml(zh))
    expect(episodes).toContain("規劃畫布匯出功能")
    expect(episodes).toContain("提出第一個需求後，再補上範圍與修正")
    expect(episodes).toContain("紀錄中看不到結果")
  })

  it("leaves out the quotes, not the structure, when quotes are excluded", async () => {
    const p = english(await sample())
    const out = section(renderHtml(p, { ...OPTIONS, exclude: ["quotes"] }))
    expect(out).toContain("Prompt 5 of 9")
    expect(out).not.toContain("no, keep the old API")
    const turns = p.episodes.reduce((n, e) => n + e.turns.length, 0)
    const without = { ...p, episodes: [] }
    expect(reportContents(p, OPTIONS).quotes - reportContents(without, OPTIONS).quotes).toBe(turns)
  })

  it("shows months instead of dates when dates are excluded", async () => {
    const p = english(await sample())
    expect(section(renderHtml(p))).toContain("Sep 5, 2026")
    const out = section(renderHtml(p, { ...OPTIONS, exclude: ["dates"] }))
    expect(out).not.toContain("Sep 5, 2026")
    expect(out).toContain("Sep 2026")
  })

  it("escapes quotes and replaces project names when projects are excluded", async () => {
    const p = english(await sample())
    const out = section(renderHtml(p))
    expect(out).toContain("&lt;script&gt;alert(")
    expect(out).not.toContain("<script>alert(")
    const named = {
      ...p,
      episodes: p.episodes.map((e, i) =>
        i === 0 ? { ...e, task: "Exporting from drawstuff" } : e,
      ),
    }
    expect(section(renderHtml(named, { ...OPTIONS, exclude: ["projects"] }))).not.toContain(
      "drawstuff",
    )
  })

  it("explains an empty selection, and stays silent for profiles from before episodes", async () => {
    const p = english(await sample())
    const none = section(renderHtml({ ...p, episodes: [], patterns: [] }))
    expect(none).toContain(
      "No conversation in the analysed prompts showed more than a single request",
    )
    expect(
      section(
        renderHtml({
          ...p,
          episodes: [],
          patterns: [],
          coverage: { ...p.coverage, episodes: null },
        }),
      ),
    ).toBe("")
  })
})
