import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"
import { contentIn } from "../../src/report/content.ts"
import { ROLE_NAMES } from "../../src/domain/Interaction.ts"
import { translationInput } from "../../src/analysis/translate.ts"

const sample = () =>
  Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )

describe("portrait report", () => {
  it("introduces the person with the portrait story on the identity view and honors quote exclusions", async () => {
    const p = {
      ...(await sample()),
      portrait: {
        introduction: "A developer who defines the destination before delegating.",
        chapters: [
          {
            title: "Setting a course",
            body: "They clarify the result before choosing the route.",
            evidence: [{ promptId: "p1", quote: "UNIQUE_PRIVATE_QUOTE" }],
          },
        ],
        axes: [
          { key: "framing" as const, explanation: "They define the outcome first.", sides: [] },
        ],
      },
    }
    const out = renderHtml(p)
    expect(out).toContain('class="portrait"')
    // the story introduces the person, before the measurements of the facts view
    expect(out.indexOf("Setting a course")).toBeLessThan(out.indexOf('<section id="detail"'))
    expect(out.indexOf("Setting a course")).toBeGreaterThan(out.indexOf('<section id="overview"'))
    expect(out).toContain("UNIQUE_PRIVATE_QUOTE")
    expect(out).toContain("Observed collaboration preferences")
    expect(renderHtml(p, { look: "classic", cardHide: [], exclude: ["quotes"] })).not.toContain(
      "UNIQUE_PRIVATE_QUOTE",
    )
    const input = translationInput(p)
    expect(input.portrait?.chapters[0]?.body).toBe(p.portrait.chapters[0]!.body)
    expect(JSON.stringify(input)).not.toContain("UNIQUE_PRIVATE_QUOTE")
  })

  it("uses a fixed bilingual role name instead of a model's translated name", async () => {
    const base = await sample()
    const p = {
      ...base,
      languages: ["en", "zh-TW"] as const,
      portrait: {
        introduction: "Intro.",
        chapters: [{ title: "Chapter", body: "Body.", evidence: [] }],
        axes: (["framing", "pacing", "control", "closure"] as const).map((key) => ({
          key,
          explanation: "Observed.",
          sides: [{ pole: "first" as const, context: "reviews", sessions: 2, evidence: [] }],
        })),
      },
      archetype: { name: "MODEL_ROLE", description: "Personal description." },
    }
    const out = renderHtml(p)
    expect(out).toContain("Methodical Director")
    expect(out).toContain("有序領航者")
    expect(out).not.toContain("MODEL_ROLE")
    expect(out).toContain("Typical working rhythm")
    expect(out).toContain("Independent evidence")
    expect(out).toContain("Personal description.")
  })

  it("covers every role with stable distinct bilingual names and preserves the source", async () => {
    const base = await sample()
    const keys = ["framing", "pacing", "control", "closure"] as const
    const first = ["F", "S", "D", "C"]
    const translatedNames = new Set<string>()
    for (const [code, name] of Object.entries(ROLE_NAMES)) {
      const p = {
        ...base,
        portrait: {
          introduction: "Intro.",
          chapters: [],
          axes: keys.map((key, i) => ({
            key,
            explanation: "Observed.",
            sides: [
              {
                pole: code[i] === first[i] ? ("first" as const) : ("second" as const),
                context: "reviews",
                sessions: 2,
                evidence: [],
              },
            ],
          })),
        },
      }
      const before = JSON.stringify(p)
      expect(contentIn(p, "en").archetype.name).toBe(name)
      const zh = contentIn(p, "zh-TW").archetype.name
      expect(zh).toMatch(/[\u3400-\u9fff]/u)
      translatedNames.add(zh)
      expect(JSON.stringify(p)).toBe(before)
    }
    expect(translatedNames.size).toBe(16)
  })

  it("shows recurring episode sequences as moves with context and independent spread", async () => {
    const p = await sample()
    const { DateTime } = await import("effect")
    const episodes = ["one", "two", "three"].map((session, i) => ({
      id: `E${i + 1}`,
      session,
      sessionTurns: 2,
      split: false,
      taskType: "review" as const,
      task: "Review a fictional patch",
      turns: [
        {
          promptId: `${session}:1`,
          quote: "Inspect the patch",
          role: "ask" as const,
          turn: 1,
          time: DateTime.makeUnsafe(0),
        },
        {
          promptId: `${session}:2`,
          quote: "Check the boundary case",
          role: "verify" as const,
          turn: 2,
          time: DateTime.makeUnsafe(1),
        },
      ],
      ending: { kind: "unknown" as const, promptId: null },
    }))
    const input = {
      ...p,
      languages: ["en"] as const,
      translations: {},
      episodes,
      patterns: [
        {
          claim: "Inspect, then check boundaries",
          episodeIds: ["E1", "E2"],
          counterEpisodeIds: ["E3"],
          support: { sessions: 2, weeks: 1 },
          taskTypes: ["review" as const],
        },
      ],
    }
    const out = renderHtml(input)
    const moves = out.slice(
      out.indexOf('<section class="identity-moves"'),
      out.indexOf("</section>", out.indexOf('<section class="identity-moves"')),
    )
    expect(moves).toContain("Inspect, then check boundaries")
    expect(moves).toContain("Review a fictional patch")
    expect(moves).toContain("Check the boundary case")
    expect(moves).toContain("2 conversations")
    expect(moves.match(/<article>/gu)).toHaveLength(2)
    const hidden = renderHtml(input, { look: "classic", cardHide: [], exclude: ["quotes"] })
    expect(hidden).not.toContain("Check the boundary case")
  })

  describe("preferences with more than one way of working", () => {
    const quote = (n: number) => ({ promptId: `claude-code:s${n}:1`, quote: `QUOTE_${n}` })
    const withAxes = async () => {
      const base = await sample()
      return {
        ...base,
        languages: ["en"] as const,
        translations: {},
        portrait: {
          introduction: "Intro.",
          chapters: [{ title: "Chapter", body: "Body.", evidence: [quote(1)] }],
          axes: [
            {
              key: "pacing" as const,
              explanation: "Step by step when learning, whole batches for repairs.",
              sides: [
                {
                  pole: "first" as const,
                  context: "when learning a new library",
                  evidence: [quote(1), quote(2)],
                  sessions: 2,
                },
                {
                  pole: "second" as const,
                  context: "batches of small repairs",
                  evidence: [quote(3), quote(4), quote(5)],
                  sessions: 3,
                },
              ],
            },
            {
              key: "control" as const,
              explanation: "Seen once.",
              sides: [
                {
                  pole: "first" as const,
                  context: "a migration",
                  evidence: [quote(6)],
                  sessions: 1,
                },
              ],
            },
          ],
        },
      }
    }
    const overview = (html: string) =>
      html.slice(
        html.indexOf('class="preference-map'),
        html.indexOf("</article>", html.indexOf('class="preference-map')),
      )

    it("shows both ways of working, each in its context, without calling either a counterexample", async () => {
      const out = renderHtml(await withAxes())
      const map = overview(out)
      expect(map).toContain("Step by step</b> · when learning a new library")
      expect(map).toContain("Whole task</b> · batches of small repairs")
      expect(map).toContain('class="preference-rail both"')
      expect(out).not.toMatch(/[Cc]ontrary evidence|[Cc]ounter-?evidence|Mixed \/ insufficient/)
    })

    it("does not call a way seen in one conversation characteristic", async () => {
      const out = renderHtml(await withAxes())
      expect(overview(out)).not.toContain("a migration")
      expect(overview(out)).toContain("Not seen in two or more conversations yet")
      // the facts page still lists it, as seen once, with its quote
      const facts = out.slice(out.indexOf('class="preference-evidence"'))
      expect(facts).toContain("Direct · a migration · seen in one conversation only")
      expect(facts).toContain("Whole task · batches of small repairs · in 3 conversations")
      expect(facts).toContain("QUOTE_6")
    })
  })
})
