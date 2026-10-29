import { Effect } from "effect"
import { existsSync } from "node:fs"
import { beforeAll, describe, expect, it } from "vitest"
import { siteFiles } from "../../scripts/site.ts"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { LOOK_IDS, PRODUCT_LOOK_IDS } from "../../src/report/looks.ts"

const PNG = [0x89, 0x50, 0x4e, 0x47]
const QUOTE = "break the plan into small steps"

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

  it("keeps the sample report, card and profile at their published paths", async () => {
    expect(text("sample-report.html")).toContain(QUOTE)
    expect(isPng("sample-card.png")).toBe(true)
    const profile = await Effect.runPromise(decodeProfile(JSON.parse(text("sample-profile.json"))))
    expect(profile.archetype.name).toBe("The Midnight Architect")
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
    for (const link of links) {
      const path = link.endsWith("/") ? `${link}index.html` : link
      // generated here, or copied from the hand-written docs/
      expect(files.has(path) || existsSync(`docs/${path}`), path).toBe(true)
    }
    for (const look of LOOK_IDS)
      expect(home).toContain(`href="demo/${look === "classic" ? "full" : look}/report.html"`)
  })
})
