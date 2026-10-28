import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
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
