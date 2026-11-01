import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { expect, it } from "vitest"
import { ABILITY_KEYS, decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"

const sample = () =>
  Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )
it("renders fixed abilities, unassessed states and project scores in both languages", async () => {
  const base = await sample()
  const p = {
    ...base,
    abilities: ABILITY_KEYS.map((key, i) => ({
      key,
      score: i === 0 ? null : 75,
      evidence: [],
      support: { sessions: 2, weeks: 1 },
      byProject: [
        {
          project: "PROJECT_ALPHA",
          analysedSessions: 20,
          score: 50,
          evidence: [],
          support: { sessions: 1, weeks: 1 },
        },
      ],
    })),
  }
  const html = renderHtml(p)
  expect(html).toContain("Providing context")
  expect(html).toContain("提供脈絡")
  expect(html).toContain("Not assessed")
  expect(html).toContain("尚未評估")
  expect(html).toContain("75%")
  expect(html).toContain("50%")
  expect(html).toContain("PROJECT_ALPHA")
  expect(html).not.toContain("not an ability score")
  expect(renderHtml(p, { look: "classic", cardHide: [], exclude: ["projects"] })).not.toContain(
    "PROJECT_ALPHA",
  )
})
it("does not invent scores when rendering a legacy profile", async () => {
  expect(renderHtml(await sample())).not.toContain('<section class="trait-radar">')
})

it("keeps an assessed zero distinct from unknown and respects quote exclusions", async () => {
  const base = await sample()
  const p = {
    ...base,
    abilities: ABILITY_KEYS.map((key, i) => ({
      key,
      score: i === 0 ? 0 : null,
      evidence: [{ promptId: "synthetic", quote: "<script>synthetic quote</script>" }],
      support: { sessions: 1, weeks: 1 },
      byProject: [],
    })),
  }
  const html = renderHtml(p)
  const radar = /<section class="trait-radar">[\s\S]*?<\/section>/.exec(html)![0]
  expect(radar).toContain("0%")
  expect(radar).toContain("Not assessed")
  expect(radar.match(/class="radar-point"/g)).toHaveLength(1)
  expect(radar).not.toContain('class="radar-shape"')
  expect(radar).toContain("&lt;script&gt;synthetic quote&lt;/script&gt;")
  expect(renderHtml(p, { look: "classic", cardHide: [], exclude: ["quotes"] })).not.toContain(
    "synthetic quote",
  )
})

it("shows instruction provenance and honors quote/custom-name exclusions", async () => {
  const base = await sample()
  const p = {
    ...base,
    headline: "You use PrivateReview",
    instructionContexts: [
      {
        id: "u:instruction:0",
        parentPromptId: "u",
        name: "PrivateReview",
        kind: "skill" as const,
        selection: "user_explicit" as const,
        selectionEvidence: "Use PrivateReview",
        description: "Reviews changes for correctness and acceptance checks.",
        content: "<script>Verify output</script>",
        contentStatus: "recorded" as const,
      },
    ],
  }
  const html = renderHtml(p)
  expect(html).toContain("Reviews changes for correctness and acceptance checks.")
  expect(html.includes("Author unknown")).toBe(false)
  expect(html).toContain("使用者明確指定")
  expect(html).toContain("&lt;script&gt;Verify output&lt;/script&gt;")
  expect(renderHtml(p, { look: "classic", cardHide: [], exclude: ["quotes"] })).not.toContain(
    "Verify output",
  )
  expect(
    renderHtml(p, { look: "classic", cardHide: [], exclude: ["custom-names"] }).includes(
      "PrivateReview",
    ),
  ).toBe(false)
})
