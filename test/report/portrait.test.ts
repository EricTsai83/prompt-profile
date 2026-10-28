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
  it("includes a continuous evidence-backed portrait on the detail page and honors quote exclusions", async () => {
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
          {
            key: "framing" as const,
            pole: "first" as const,
            explanation: "They define the outcome first.",
            evidence: [],
            counterEvidence: [],
          },
        ],
      },
    }
    const out = renderHtml(p)
    expect(out).toContain('class="portrait"')
    expect(out.indexOf("Setting a course")).toBeGreaterThan(out.indexOf('class="sigs"'))
    expect(out).toContain("UNIQUE_PRIVATE_QUOTE")
    expect(out).toContain("Observed collaboration preferences")
    expect(renderHtml(p, { look: "classic", cardHide: [], exclude: ["quotes"] })).not.toContain(
      "UNIQUE_PRIVATE_QUOTE",
    )
    const input = translationInput(p)
    expect(input.portrait?.chapters[0]?.body).toBe(p.portrait.chapters[0]!.body)
    expect(JSON.stringify(input)).not.toContain("UNIQUE_PRIVATE_QUOTE")
  })
})
