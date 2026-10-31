import satori from "satori"
import { cardTree } from "../../src/report/card.ts"
import { embeddedFonts } from "../../src/report/fonts.ts"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"
import { LOOK_IDS, type LookId } from "../../src/report/looks.ts"
import { lookOf, THEMES } from "../../src/report/theme.ts"

const sample = () =>
  decodeProfile(
    JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
  )
describe("production templates", () => {
  it.effect(
    "offers three original layouts with supported signature behaviors and preserves default",
    () =>
      Effect.gen(function* () {
        const p = yield* sample()
        for (const id of ["prism", "slate", "folio"]) {
          expect(LOOK_IDS).toContain(id)
          expect(lookOf(id as LookId).id).toBe(id)
          const output = renderHtml(p, { look: id as LookId, cardHide: [] })
          expect(output).toContain('class="identity-signatures"')
          expect(output).toContain(`data-look="${id}"`)
          expect(output).toBe(
            renderHtml(p, { look: id as LookId, cardHide: ["traits", "stats", "graphic"] }),
          )
        }
        expect(renderHtml(p)).not.toContain('class="identity-signatures"')
      }),
  )
})

const textNodes = (value: unknown): string[] => {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(textNodes)
  if (value && typeof value === "object" && "props" in value)
    return textNodes((value as { props: { children?: unknown } }).props.children)
  return []
}

// Renders every look twice per project name: allow for slow CI runners (5 s default).
it(
  "respects project visibility in both report and card languages",
  { timeout: 20_000 },
  async () => {
    const p = await Effect.runPromise(sample())
    for (const project of ["PrivateOrchard", "XY"]) {
      const profile = {
        ...p,
        headline: `Builds ${project} at midnight`,
        archetype: { name: `${project} architect`, description: project },
        traits: p.traits.map((t) => ({ ...t, name: `${project} specialist` })),
        stats: {
          ...p.stats,
          topProjects: p.stats.topProjects.map((x) => ({ ...x, name: project })),
        },
        translations: {
          ...p.translations,
          "zh-TW": {
            ...p.translations["zh-TW"]!,
            headline: `Builds ${project}`,
            archetype: { name: `${project} architect`, description: project },
            traits: p.traits.map(() => ({ name: `${project} specialist`, description: project })),
          },
        },
      }
      for (const look of LOOK_IDS)
        for (const hidden of [false, true]) {
          const options = { look, cardHide: [], exclude: hidden ? ["projects" as const] : [] }
          // One HTML report holds both languages: render it once, not once per card language.
          // Embedded font/image bytes can coincidentally contain a short project name.
          const report = renderHtml(profile, options)
            .replace(/<style[\s\S]*?<\/style>/g, "")
            .replace(/data:[^"']*/g, "")
          expect(report.includes(project)).toBe(!hidden)
          for (const lang of ["en", "zh-TW"] as const) {
            const card = textNodes(cardTree(profile, options, lang)).join("\n")
            expect(card.includes(project)).toBe(!hidden)
          }
        }
      expect(renderHtml(profile, { look: "prism", cardHide: [] })).toContain(project)
    }
  },
)

it("keeps long card identity text above the footer in every product card", async () => {
  const p = await Effect.runPromise(sample())
  const profile = {
    ...p,
    archetype: { ...p.archetype, name: "W\n".repeat(26) },
    headline: "W\n".repeat(52),
    traits: p.traits.map((t) => ({ ...t, name: "W\n".repeat(24) })),
  }
  for (const look of THEMES.filter((t) => t.card.composition === "product").map((t) => t.id)) {
    const textBoxes: Array<{ top: number; height: number }> = []
    await satori(cardTree(profile, { look, cardHide: [] }, "en") as never, {
      width: 1200,
      height: 630,
      fonts: embeddedFonts().map((f) => ({ ...f, data: Buffer.from(f.data) })),
      onNodeDetected: (node) => {
        if (node.textContent?.startsWith("W"))
          textBoxes.push({ top: node.top, height: node.height })
      },
    })
    expect(textBoxes.length).toBeGreaterThanOrEqual(2)
    for (const box of textBoxes) expect(box.top + box.height).toBeLessThanOrEqual(510)
  }
})

it("presents featured observations and grouped quotes without step numbering", async () => {
  const base = await Effect.runPromise(sample())
  for (const collaboration of [
    null,
    {
      moves: [
        {
          name: "Review with checks",
          description: "Requests checks.",
          episodeIds: base.episodes.map((e) => e.id),
          benefit: null,
          cost: null,
          support: { sessions: 2, weeks: 1 },
        },
      ],
      signals: [],
      rejected: { moves: 0, signals: 0, effects: 0 },
    },
  ]) {
    const output = renderHtml({ ...base, collaboration })
    const moves = output.split('class="identity-moves')[1]!.split("</section>")[0]!
    expect(moves.includes("<ol>")).toBe(false)
    expect(moves.includes("<ul>")).toBe(true)
    expect(/<li>\d+\. /.test(moves)).toBe(false)
    for (const episode of base.episodes.slice(0, 2))
      for (const turn of episode.turns) expect(moves.includes(`<li>${turn.turn}. `)).toBe(false)
  }
})
