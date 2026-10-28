import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { cardTree } from "../../src/report/card.ts"
import { embeddedFonts } from "../../src/report/fonts.ts"
import { renderHtml, writeReport } from "../../src/report/index.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)
const sample = () => decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))
const englishOnly = (p: Profile): Profile => ({ ...p, languages: ["en"], translations: {} })
const evidenceTotal = (p: Profile) =>
  [...p.traits, ...p.dimensions, ...p.improvements].reduce((n, x) => n + x.evidence.length, 0)

const texts = (node: unknown): Array<string> => {
  if (typeof node === "string") return [node]
  if (Array.isArray(node)) return node.flatMap(texts)
  if (node && typeof node === "object" && "props" in node)
    return texts((node as { props: { children?: unknown } }).props.children)
  return []
}

describe("report languages", () => {
  it.effect("a bilingual report has a switch, both texts and each quote once", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const out = renderHtml(p)
      expect(out).toMatch(/<input[^>]*id="lang-en"[^>]*checked/)
      expect(out).toContain('id="lang-zh-TW"')
      expect(out).toContain('label for="lang-zh-TW"')
      expect(out).toContain('<span data-l="zh-TW" lang="zh-Hant-TW">午夜架構師</span>')
      expect(out).toContain('<span data-l="en" lang="en">The Midnight Architect</span>')
      expect(out).toContain("證據不足")
      expect(out).toContain("Insufficient evidence")
      expect(out.match(/<blockquote[ >]/g)?.length).toBe(evidenceTotal(p))
      expect(out).not.toContain("<script")
    }),
  )

  it.effect("the default language is the first one", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const out = renderHtml({ ...p, languages: ["zh-TW", "en"] })
      expect(out).toMatch(/<input[^>]*id="lang-zh-TW"[^>]*checked/)
      expect(out).toContain('<html lang="zh-Hant-TW"')
    }),
  )

  it.effect("one language: no switch and plain text", () =>
    Effect.gen(function* () {
      const out = renderHtml(englishOnly(yield* sample()))
      expect(out).not.toContain('name="lang"')
      expect(out).not.toContain("data-l=")
      expect(out).toContain("<h1>The Midnight Architect</h1>")
    }),
  )

  it.effect("the title has no eyebrow line, and the charts are drawn from stats", () =>
    Effect.gen(function* () {
      const out = renderHtml(englishOnly(yield* sample()))
      expect(out).not.toContain("My AI collaboration profile")
      expect(out).toContain('class="clock"')
      expect(out).toContain('class="heat"')
      expect(out).toContain('class="heat-top')
      expect(out).toContain('class="cal"')
      expect(out).toContain('class="chapters"')
      expect(out).toContain('class="donut"')
      expect(out).toMatch(/<details open class="dimension">/)
    }),
  )

  it.effect("the card uses the language's text", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      expect(texts(cardTree(p, undefined, "zh-TW")).join("\n")).toContain("午夜架構師")
      expect(texts(cardTree(p, undefined, "en")).join("\n")).toContain("The Midnight Architect")
    }),
  )

  it.effect("one card per language; a missing CJK font skips only that card", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const dir = join(mkdtempSync(join(tmpdir(), "pp-lang-")), "out")
      const noFont = yield* writeReport(p, dir)
      expect(noFont.cards.map((c) => [c.language, c.file !== null])).toEqual([
        ["en", true],
        ["zh-TW", false],
      ])
      expect(noFont.cards[1]!.error).toContain("CJK")
      expect(existsSync(join(dir, "card.zh-TW.png"))).toBe(false)

      const stand = Effect.succeed(embeddedFonts().map((f) => ({ ...f, name: "Noto Sans TC" })))
      const files = yield* writeReport(p, dir, undefined, null, stand)
      expect(files.cards.map((c) => c.file)).toEqual([
        join(dir, "card.png"),
        join(dir, "card.zh-TW.png"),
      ])
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("hovering a chart cell names the time, the count and the main projects", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const out = renderHtml(p)
      // Friday 23:00 in both languages
      const n = p.stats.activityGrid[4]![23]!
      expect(out).toContain(`data-tip-en="Fri 23:00 · ${n} prompts`)
      expect(out).toContain(`data-tip-zh-TW="週五 23:00 · ${n} 個 prompt`)
      const day = p.stats.activity.days[0]!
      expect(out).toMatch(new RegExp(`data-tip-en="[^"]*· ${day.count} prompts?`))
      expect(out).toContain("content:attr(data-tip-zh-TW)")
      expect(out).toContain("drawstuff")
    }),
  )

  it.effect("without project activity (an older profile) the project charts are left out", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const old = {
        ...p,
        stats: { ...p.stats, activity: { projects: [], days: [], gridByProject: [] } },
      }
      const out = renderHtml(old)
      expect(out).not.toContain('class="cal"')
      expect(out).not.toContain('class="ranks"')
      expect(out).toContain('class="heat"')
    }),
  )

  it.effect("the client mix names clients, not whether a prompt was typed", () =>
    Effect.gen(function* () {
      const out = renderHtml(englishOnly(yield* sample()))
      expect(out).toContain("Desktop app / SDK")
      expect(out).toContain("Terminal")
      expect(out).not.toContain(">Typed<")
      expect(out).toContain("Other folders")
    }),
  )
})
