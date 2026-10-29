import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"
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
