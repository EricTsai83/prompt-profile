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

/** The identity view (opens first) and the factual view of a rendered report. */
const views = (page: string) => ({
  identity: page.split('<section id="overview"')[1]?.split('<section id="detail"')[0] ?? "",
  facts: page.split('<section id="detail"')[1] ?? "",
})

describe("report views", () => {
  it("changes the opening content with the selected purpose instead of retaining a shared identity hero", async () => {
    const p = await sample()
    const page = renderHtml(p)
    const { identity, facts } = views(page)
    expect(identity).toContain('class="hero"')
    expect(identity).toContain(p.archetype.name)
    expect(page.split('<section id="overview"')[0]).not.toContain('class="hero"')
    expect(facts).not.toContain('class="hero"')
    expect(facts).toContain('class="view-heading"')
    expect(facts).toContain("Facts &amp; evidence")
  })
  it("opens on an identity introduction: signature behaviours in their own words, preferences and the portrait story", async () => {
    const html = renderHtml(await sample())
    const { identity } = views(html)
    expect(html).toMatch(/id="report-overview"[^>]*checked/)
    expect(html).toContain('for="report-detail"')
    expect(html).toContain('for="report-overview"')
    expect(html).toContain("How you collaborate")
    expect(html).toContain("你的協作方式")
    expect(identity).toContain('class="identity-moves"')
    // the copy states the selection rule; it does not claim the strongest or most consistent
    expect(identity).toContain("medium or high confidence")
    expect(identity).not.toMatch(/most consistent|best-supported|最一致|證據最充分/)
    expect(identity).toContain("Adds scope and corrections after the first request")
    expect(identity).not.toContain("Type purist")
    expect(identity).toContain('class="preference-map panel"')
    expect(identity).toContain("The work starts before the code")
    expect(identity).toContain("Before editing, outline the steps")
    expect(identity).toContain("Latest prompt: 03:12 AM.")
    for (const factual of [
      'class="sigs"',
      'class="heat"',
      'class="overview-charts"',
      'class="techniques"',
      'class="dims"',
      'class="usage"',
      'class="about"',
      "Contrary evidence",
    ])
      expect(identity).not.toContain(factual)
    // evidence starts expanded; only measurement definitions (ⓘ) are folded
    expect(html).not.toMatch(
      /<details(?![^>]*(?:\bopen\b|class="(?:def|experiment-alternatives)"))[^>]*>/,
    )
    expect(html).toContain("@media print")
    expect(html).not.toContain("<script")
  })
  it("collects every measurement, all traits and the preference evidence on the factual view", async () => {
    const { facts } = views(renderHtml(await sample()))
    expect(facts).toContain("Facts &amp; evidence")
    for (const factual of [
      'class="sigs"',
      'class="heat"',
      'class="overview-charts"',
      'class="techniques"',
      'class="dims"',
      'class="usage"',
      'class="about"',
      'class="preference-evidence"',
    ])
      expect(facts).toContain(factual)
    for (const trait of ["Plan first", "Straight talker", "Type purist"])
      expect(facts).toContain(trait)
    expect(facts).toContain("One planning checkpoint does not establish a consistent pace")
    expect(facts).not.toContain("The work starts before the code")
    expect(facts).not.toContain("Latest prompt: 03:12 AM.")
  })
  it("keeps the identity view intentional without a portrait", async () => {
    const p = await sample()
    const { identity, facts } = views(renderHtml({ ...p, portrait: null }))
    expect(identity).toContain('class="identity-moves"')
    expect(identity).toContain("Facts &amp; evidence")
    expect(facts).not.toContain('class="preference-evidence"')
  })
  it("describes featured habits only where the hero does not, and states when none has medium or high confidence", async () => {
    const p = { ...(await sample()), patterns: [] }
    const moves = (page: string) =>
      views(page).identity.split('class="identity-moves"')[1]!.split("</section>")[0]!
    const description = p.traits[0]!.description
    expect(moves(renderHtml(p))).toContain(description)
    expect(moves(renderHtml(p, { look: "prism", cardHide: [], exclude: [] }))).not.toContain(
      description,
    )
    const thin = { ...p, traits: p.traits.map((t) => ({ ...t, confidence: "low" as const })) }
    const empty = moves(renderHtml(thin))
    expect(empty).toContain("No observation has medium or high confidence")
    expect(empty).not.toContain("<blockquote")
  })
  it("preserves visibility choices on both pages", async () => {
    const html = renderHtml(await sample(), {
      look: "classic",
      cardHide: [],
      exclude: ["quotes", "custom-names", "funfacts"],
    })
    expect(html).not.toContain("Before editing, outline the steps")
    expect(html).not.toContain("Latest prompt: 03:12 AM.")
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
