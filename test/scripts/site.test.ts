import { Effect } from "effect"
import { existsSync } from "node:fs"
import { beforeAll, describe, expect, it } from "vitest"
import { siteFiles } from "../../scripts/site.ts"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { LOOK_IDS, PRODUCT_LOOK_IDS } from "../../src/report/looks.ts"

const PNG = [0x89, 0x50, 0x4e, 0x47]
const QUOTE = "舊的連結要繼續能用"

describe("siteFiles", () => {
  let files: ReadonlyMap<string, string | Uint8Array>
  const text = (name: string): string => {
    const data = files.get(name)
    if (typeof data !== "string") throw new Error(`${name} is not a text file`)
    return data
  }
  const isPng = (name: string): boolean => {
    const data = files.get(name)
    return data instanceof Uint8Array && PNG.every((b, i) => data[i] === b)
  }

  beforeAll(async () => {
    files = await siteFiles()
  }, 60_000)

  it("renders a report and a card for every look", () => {
    for (const look of LOOK_IDS) {
      const folder = look === "classic" ? "full" : look
      expect(text(`demo/${folder}/report.html`)).toMatch(/^<!doctype html>/i)
      expect(isPng(`demo/${folder}/card.png`)).toBe(true)
    }
  })

  it("demonstrates recurring user-side moves with outcomes left unknown", () => {
    const report = text("demo/full/report.html")
    expect(report).toContain("Say what should stay")
    expect(report).toContain("No supported benefit or cost claim here")
    expect(report).toContain(QUOTE)
  })

  it("keeps the sample report, card and profile at their published paths", async () => {
    expect(text("sample-report.html")).toContain(QUOTE)
    expect(isPng("sample-card.png")).toBe(true)
    const profile = await Effect.runPromise(decodeProfile(JSON.parse(text("sample-profile.json"))))
    expect(profile.archetype.name).toBe("A collaboration example")
    expect(profile.stats.analyzedPrompts).toBe(8)
    expect(profile.episodes).toHaveLength(4)
    const quotes = new Set(profile.episodes.flatMap((e) => e.turns.map((t) => t.quote)))
    for (const chapter of profile.portrait!.chapters)
      for (const evidence of chapter.evidence) expect(quotes.has(evidence.quote)).toBe(true)
    expect(profile.episodes.every((e) => e.ending.kind === "unknown")).toBe(true)
    expect(profile.translations["zh-TW"]?.headline).toBe("先說需求，看到草稿再調整。")
    expect(text("sample-report.html")).toContain(profile.headline)
    expect(text("sample-report.html")).toContain("先說需求，看到草稿再調整。")
    expect(text("sample-report.html")).not.toContain("perfectionist")
  })

  it("renders the shareable report without prompt quotes", () => {
    expect(text("demo/full/report.html")).toContain(QUOTE)
    expect(text("demo/without-personal/report.html")).not.toContain(QUOTE)
  })

  it("links every product template from the gallery", () => {
    const gallery = text("demo/templates/index.html")
    for (const look of PRODUCT_LOOK_IDS) expect(gallery).toContain(`href="../${look}/report.html"`)
  })

  it("has a home page at the site root, whose every link points to a published file", () => {
    const home = text("index.html")
    expect(home).toMatch(/^<!doctype html>/i)
    expect(home).toContain('<img src="sample-card.png"')
    const links = [...home.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1]!)
    expect(links).toEqual(
      expect.arrayContaining([
        "sample-report.html",
        "demo/without-personal/report.html",
        "demo/templates/index.html",
        "sample-profile.json",
      ]),
    )
    // generated here, or copied from the hand-written docs/
    const missing = links
      .map((link) => (link.endsWith("/") ? `${link}index.html` : link))
      .filter((path) => !files.has(path) && !existsSync(`docs/${path}`))
    expect(missing).toEqual([])
    for (const look of LOOK_IDS)
      expect(home).toContain(`href="demo/${look === "classic" ? "full" : look}/report.html"`)
  })
})
