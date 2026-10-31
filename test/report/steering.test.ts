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
const OPTIONS = { look: "classic", cardHide: [], exclude: [] } as const
const facts = (html: string) => html.slice(html.indexOf('<section id="detail"'))
const section = (html: string) => {
  const start = html.indexOf('<section class="steering"')
  return start === -1 ? "" : html.slice(start, html.indexOf("</section>", start))
}

describe("steering in the report", () => {
  it("replaces '1 in N prompts' with conversations where the AI was redirected", async () => {
    const out = facts(renderHtml(english(await sample())))
    expect(out).toContain("41 of 196")
    expect(out).toContain("conversations where you redirected the AI")
    expect(out).not.toContain("prompts corrects the AI")
  })

  it("explains the denominator, keeps repairs separate and shows verified examples", async () => {
    const s = section(renderHtml(english(await sample())))
    expect(s).toContain(
      "196 of the 280 analysed conversations have follow-up prompts. The other 84 were a single request, with nothing to steer.",
    )
    expect(s).toContain("Redirected the AI’s approach")
    expect(s).toContain("41 conversations · 58 prompts")
    expect(s).toContain("Asked the AI to fix a broken result")
    expect(s).toContain("27 conversations · 39 prompts")
    expect(s).toContain("no, keep the old API")
    expect(s).toContain("a judgement, not an exact count")
    expect(s).toContain("3 labels were rejected")
  })

  it("is written in Traditional Chinese too", async () => {
    const zh: Profile = { ...(await sample()), languages: ["zh-TW"] }
    const out = renderHtml(zh)
    expect(facts(out)).toContain("196 段中 41 段")
    expect(section(out)).toContain("改變 AI 的做法")
  })

  it("leaves the examples out with --exclude quotes and counts them otherwise", async () => {
    const p = english(await sample())
    expect(section(renderHtml(p, { ...OPTIONS, exclude: ["quotes"] }))).not.toContain(
      "no, keep the old API",
    )
    const without: Profile = { ...p, steering: null }
    expect(reportContents(p, OPTIONS).quotes - reportContents(without, OPTIONS).quotes).toBe(3)
  })

  it("falls back to the rule-based rate for profiles from before steering", async () => {
    const out = renderHtml({ ...english(await sample()), steering: null })
    expect(facts(out)).toContain("prompts corrects the AI")
    expect(section(out)).toBe("")
  })
})

describe("coaching signals", () => {
  it("drops the keyword-based correction signal once steering is measured", async () => {
    const p = english(await sample())
    expect(renderHtml(p)).not.toContain("prompts corrects the AI")
    expect(renderHtml({ ...p, steering: null })).toContain("1 in 8 prompts corrects the AI")
  })
})
