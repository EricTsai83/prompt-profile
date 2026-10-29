import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { workflowCharts } from "../../src/report/overview.ts"
import { makeLoc } from "../../src/report/loc.ts"
import { renderHtml } from "../../src/report/html.ts"

const sample = async () => ({
  ...(await Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )),
  portrait: JSON.parse(
    readFileSync(new URL("../fixtures/portrait.sample.json", import.meta.url), "utf8"),
  ),
})

describe("report views", () => {
  it("opens on a visual overview and puts narrative, evidence and skill descriptions on the detail page", async () => {
    const html = renderHtml(await sample())
    const overview = html.split('<section id="overview"')[1]?.split('<section id="detail"')[0] ?? ""
    const detail = html.split('<section id="detail"')[1] ?? ""
    expect(html).toMatch(/id="report-overview"[^>]*checked/)
    expect(html).toContain('for="report-detail"')
    expect(html).toContain('for="report-overview"')
    expect(overview).toContain('class="preference-map panel"')
    expect(overview).toContain('class="heat"')
    expect(overview).not.toContain("The work starts before the code")
    expect(overview).not.toContain("Before editing, outline the steps")
    expect(detail).toContain("The work starts before the code")
    expect(detail).toContain("Before editing, outline the steps")
    expect(detail).toContain('class="techniques"')
    expect(html).not.toMatch(/<details(?![^>]*\bopen\b)[^>]*>/)
    expect(html).toContain("Visual overview")
    expect(html).toContain("圖表總覽")
    expect(html).toContain("@media print")
    expect(html).not.toContain("<script")
  })
  it("preserves visibility choices on both pages", async () => {
    const html = renderHtml(await sample(), {
      look: "classic",
      cardHide: [],
      exclude: ["quotes", "custom-names"],
    })
    expect(html).not.toContain("Before editing, outline the steps")
    expect(html).toContain('id="overview"')
    expect(html).toContain('id="detail"')
  })
})

describe("workflow chart evidence", () => {
  it("labels the actual denominators and stored tool numerators without reconstructing prompt counts", async () => {
    const p = await sample()
    const t = p.stats.techniques!
    const input = {
      ...p,
      stats: {
        ...p.stats,
        totalSessions: 40,
        analyzedPrompts: 17,
        techniques: {
          ...t,
          coveredSessions: 8,
          tools: { ...t.tools, web: { count: 9, sessions: 3 } },
          prompts: { ...t.prompts, context: 0.3333 },
        },
      },
    }
    const chart = workflowCharts(input, makeLoc(input)).value
    expect(chart).toContain("8 of 40 sessions")
    expect(chart).toContain("3 / 8")
    expect(chart).toContain("38%")
    expect(chart).toContain("17 cleaned prompts")
    expect(chart).toContain("33%")
    expect(chart).toContain("Categories overlap")
    expect(chart).toContain("Exact matching prompt counts are not stored")
  })
  it("distinguishes missing measurements, zero coverage and observed zero; no bars with zero denominators", async () => {
    const p = await sample()
    const show = (stats: typeof p.stats) => workflowCharts({ ...p, stats }, makeLoc(p)).value
    expect(show({ ...p.stats, techniques: null })).toContain(
      "Technique measurements are not stored",
    )
    const t = p.stats.techniques!
    const empty = show({ ...p.stats, analyzedPrompts: 0, techniques: { ...t, coveredSessions: 0 } })
    expect(empty).toContain("0 sessions have tool metadata")
    expect(empty).toContain("No cleaned prompts")
    expect(empty).not.toContain('class="overview-bar-track"')
    const zero = show({
      ...p.stats,
      techniques: {
        ...t,
        coveredSessions: 8,
        tools: Object.fromEntries(
          Object.keys(t.tools).map((k) => [k, { count: 0, sessions: 0 }]),
        ) as typeof t.tools,
      },
    })
    expect(zero).toContain("0 / 8")
    expect(zero).toContain("0%")
  })
})
