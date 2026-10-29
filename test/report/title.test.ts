import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"

const sample = () =>
  Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )
const OPTIONS = { look: "classic", cardHide: [], exclude: [] } as const
const brand = (html: string) =>
  html.slice(html.indexOf('<header class="topbar">'), html.indexOf("</header>"))

describe("report title", () => {
  it("names the person when --name is given, in every report language", async () => {
    const out = renderHtml(await sample(), { ...OPTIONS, name: "Eric" })
    expect(brand(out)).toContain("Eric’s prompt profile")
    expect(brand(out)).toContain("Eric 的 prompt profile")
    expect(out).toMatch(/<title>[^<]*· Eric’s prompt profile<\/title>/)
  })

  it("says prompt profile, without the dash, when no name is given", async () => {
    const p: Profile = { ...(await sample()), languages: ["en"], translations: {} }
    const out = renderHtml(p)
    expect(brand(out)).toContain(">prompt profile<")
    expect(brand(out)).not.toContain("prompt-profile")
  })

  it("escapes the name", async () => {
    const out = renderHtml(await sample(), { ...OPTIONS, name: "<b>Eve</b>" })
    expect(out).not.toContain("<b>Eve</b>")
    expect(out).toContain("&lt;b&gt;Eve&lt;/b&gt;’s prompt profile")
  })
})
