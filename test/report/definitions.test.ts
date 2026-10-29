import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"))
const sample = async (): Promise<Profile> => ({
  ...(await Effect.runPromise(decodeProfile(fixture("profile.sample.json")))),
  portrait: fixture("portrait.sample.json"),
})
const english = (p: Profile): Profile => ({ ...p, languages: ["en"], translations: {} })

/** The text a reader sees before opening any ⓘ: no folded definitions, styles or attributes. */
const visible = (html: string) =>
  html
    .replace(/<details class="def">[\s\S]*?<\/details>/g, "")
    .replace(/<style>[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
/** The definition directly after a heading or label containing `text`. */
const definitionOf = (html: string, text: string) => {
  const at = html.indexOf(text)
  expect(at, `"${text}" is in the report`).toBeGreaterThan(-1)
  const def = /<details class="def">([\s\S]*?)<\/details>/.exec(html.slice(at, at + 1500))
  return def?.[1] ?? ""
}

describe("measurement definitions", () => {
  it("are folded behind an ⓘ: closed by default, with a label for screen readers", async () => {
    const out = renderHtml(english(await sample()))
    expect(out).toContain('<details class="def"><summary aria-label="What this means">')
    expect(out).not.toContain('<details class="def" open')
  })

  it("define every headline number on the facts page", async () => {
    const out = renderHtml(english(await sample()))
    for (const [label, words] of [
      ["at night", "22:00 and 04:59"],
      ["typical prompt", "Median length"],
      ["conversations where they redirected the AI", "follow-up prompts"],
      ["prompts per session", "divided by the conversations"],
    ] as const)
      expect(definitionOf(out, label)).toContain(words)
    expect(out).not.toMatch(/class="sig tip/)
  })

  it("define each measured chart and section, with its source or denominator", async () => {
    const out = renderHtml(english(await sample()))
    for (const [heading, words] of [
      ["Data period", "--since"],
      ["Analyzed", "sampled"],
      ["Every day", "active day"],
      ["Weekly rhythm", "weekday and hour"],
      ["Prompt language", "classified by script"],
      ["Where you prompt", "client"],
      ["Habits", "90th percentile"],
      ["How they steer the AI", "single request"],
      ["How conversations unfolded", "Only the user’s prompts are recorded"],
      ["Evidence for each preference", "two or more conversations"],
      ["Usage during this period", "not what was paid"],
    ] as const)
      expect(definitionOf(out, `>${heading}`)).toContain(words)
  })

  it("keep method notes out of the visible page", async () => {
    const out = visible(renderHtml(english(await sample())))
    for (const note of [
      "Source: local tool records",
      "Weekday × hour",
      "Only the user’s prompts are recorded",
      "a judgement, not an exact count",
      "Tokens by kind",
      "Not a psychological assessment",
    ])
      expect(out).not.toContain(note)
    // the numbers themselves stay visible
    expect(out).toContain("41 of 196")
    expect(out).toContain("1,980 prompts on 141 days")
  })

  it("are written in every report language", async () => {
    const out = renderHtml({ ...(await sample()), languages: ["zh-TW"] })
    expect(out).toContain('<summary aria-label="這是什麼意思">')
    expect(definitionOf(out, "語言")).toContain("依文字判斷")
  })

  it("are printed open", async () => {
    const out = renderHtml(english(await sample()))
    expect(out).toMatch(
      /@media print\{\.def>summary\{display:none\}\.def::details-content\{content-visibility:visible/,
    )
  })
})
