import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { expect, it } from "vitest"
import { ABILITY_KEYS, decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"
import { escapeHtml } from "../../src/report/html-template.ts"
import { LOOK_IDS } from "../../src/report/looks.ts"

const sample = async (): Promise<Profile> => {
  const p = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  return {
    ...p,
    portrait: JSON.parse(readFileSync("test/fixtures/portrait.sample.json", "utf8")),
    abilities: ABILITY_KEYS.map((key) => ({
      key,
      score: 75,
      evidence: p.traits[0]!.evidence,
      support: { sessions: 2, weeks: 1 },
      byProject: [],
    })),
  }
}
const views = (page: string) => ({
  overview: page.split('<section id="overview"')[1]!.split('<section id="detail"')[0]!,
  detail: page.split('<section id="detail"')[1]!,
})
const ordered = (html: string, markers: string[]) => {
  let previous = -1
  for (const marker of markers) {
    const index = html.indexOf(marker)
    expect({ marker, inOrder: index > previous }).toEqual({ marker, inOrder: true })
    previous = index
  }
}

it.each(LOOK_IDS)(
  "gives %s a portrait-first overview and evidence-first detail page",
  async (look) => {
    const p = await sample()
    const { overview, detail } = views(renderHtml(p, { look, cardHide: [] }))
    ordered(overview, [
      'class="hero"',
      'id="reading-overview-portrait"',
      'class="portrait"',
      'class="identity-moves"',
      'id="reading-overview-measures"',
      'class="trait-radar"',
    ])
    ordered(detail, [
      'id="reading-detail-evidence"',
      'id="reading-detail-conversations"',
      'id="reading-detail-next"',
      'id="reading-detail-activity"',
      'id="reading-detail-method"',
    ])
    expect(overview).not.toContain(p.funFacts[0]!)
    expect(detail).toContain(p.funFacts[0]!)
    expect(overview).not.toContain('class="coaching"')
    expect(detail).toContain('class="coaching"')
    for (const id of [...detail.matchAll(/href="#(reading-[^"]+)"/g)].map((m) => m[1]))
      expect(detail).toContain(`id="${id}"`)
  },
)

it("omits empty chapters, unassessed-only radar, missing metadata and unavailable suggestions", async () => {
  const p = await sample()
  const page = renderHtml({
    ...p,
    portrait: null,
    narrative: null,
    traits: [],
    patterns: [],
    episodes: [],
    dimensions: [],
    steering: null,
    collaboration: null,
    abilities: p.abilities.map((a) => ({ ...a, score: null })),
    axisBalance: null,
    improvements: [],
    historyComparison: null,
    previous: null,
    instructionContexts: [],
    generation: null,
    usage: null,
    coverage: { ...p.coverage, episodes: null },
    stats: { ...p.stats, techniques: null },
  })
  for (const id of [
    "reading-overview-portrait",
    "reading-overview-measures",
    "reading-detail-evidence",
    "reading-detail-conversations",
    "reading-detail-next",
  ])
    expect(page).not.toContain(`id="${id}"`)
  expect(page).not.toContain('class="trait-radar"')
  expect(page).not.toContain('class="overview-charts"')
  expect(page).not.toContain('class="generation"')
  expect(page).toContain('id="reading-detail-method"')
  expect(page).toContain('class="about"')
})

it("omits private evidence chapters from public exports and explains the missing source prompts up front", async () => {
  const { overview, detail } = views(
    renderHtml(await sample(), { look: "classic", cardHide: [], exclude: ["quotes", "coaching"] }),
  )
  expect(overview).toContain('class="reading-limit"')
  expect(overview).toContain("Original prompts are omitted")
  for (const id of [
    "reading-detail-evidence",
    "reading-detail-conversations",
    "reading-detail-next",
  ]) {
    expect(detail).not.toContain(`id="${id}"`)
    expect(detail).not.toContain(`href="#${id}"`)
  }
  expect(detail).not.toContain("<blockquote")
})

it("keeps original episode quotes, dates and prompt positions in the evidence reading path", async () => {
  const p = await sample()
  const { detail } = views(renderHtml(p))
  expect(detail).toContain('id="reading-detail-conversations"')
  expect(detail).toContain("Prompt 1 of 9")
  expect(detail).toContain("Sep 5, 2026")
  expect(detail).toContain("no, keep the old API")
})

it("puts dated prompt references beside overview examples, even when only episode provenance was stored", async () => {
  const base = await sample()
  const e = base.episodes[0]!
  const p: Profile = {
    ...base,
    evidenceOrigins: [],
    collaboration: {
      moves: [
        {
          name: "A grounded habit",
          description: "A supported description",
          episodeIds: [e.id],
          benefit: null,
          cost: null,
          support: { sessions: 2, weeks: 1 },
        },
      ],
      signals: [],
      rejected: { moves: 0, signals: 0, effects: 0 },
    },
  }
  const { overview } = views(renderHtml(p))
  expect(overview).toContain('class="quote-source"')
  expect(overview).toContain("Sep 5, 2026")
  expect(overview).toContain("prompt 1/9")
  expect(overview).toContain(escapeHtml(e.turns[0]!.quote))
})

it("keeps overview examples short while retaining complete conversations and scoring evidence in detail", async () => {
  const base = await sample()
  const episode = base.episodes[0]!
  const p: Profile = {
    ...base,
    collaboration: {
      moves: [
        {
          name: "A grounded habit",
          description: "A supported description",
          episodeIds: [episode.id],
          benefit: null,
          cost: null,
          support: { sessions: 2, weeks: 1 },
        },
      ],
      signals: [],
      rejected: { moves: 0, signals: 0, effects: 0 },
    },
  }
  const { overview, detail } = views(renderHtml(p))
  const moves = /<section class="identity-moves structured-moves">.*?<\/section>/s.exec(
    overview,
  )![0]
  expect(moves).toContain(escapeHtml(episode.turns[0]!.quote))
  expect(moves).not.toContain(escapeHtml(episode.turns[1]!.quote))
  for (const turn of episode.turns) expect(detail).toContain(escapeHtml(turn.quote))
  const radar = /<section class="trait-radar">.*?<\/section>/s.exec(overview)![0]
  expect(radar).not.toContain("<blockquote")
  expect(detail).toContain('class="ability-evidence"')
  expect(detail).toContain(escapeHtml(base.abilities[0]!.evidence[0]!.quote))
})
