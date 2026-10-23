import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { cardNeedsCjk, cardTree, clip, renderCard } from "../../src/report/card.ts"
import { embeddedLatinFonts } from "../../src/report/fonts.ts"
import { escapeHtml, html, raw } from "../../src/report/html-template.ts"
import { renderHtml, writeReport } from "../../src/report/index.ts"

const sample = (lang: "zh-TW" | "en") =>
  decodeProfile(
    JSON.parse(
      readFileSync(new URL(`../fixtures/profile.sample.${lang}.json`, import.meta.url), "utf8"),
    ),
  )

const pngSize = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

describe("html template", () => {
  it("escapes interpolations unless raw", () => {
    expect(html`<p>${"<script>alert(1)</script>"}</p>`.value).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    )
    expect(html`<p>${raw("<b>ok</b>")}</p>`.value).toBe("<p><b>ok</b></p>")
    expect(html`<a title="${'"x"'}"></a>`.value).toBe('<a title="&quot;x&quot;"></a>')
    expect(html`${["<a>", html`<b></b>`]}`.value).toBe("&lt;a&gt;<b></b>")
    expect(escapeHtml("'&")).toBe("&#39;&amp;")
  })
})

describe("renderHtml", () => {
  it.effect.each(["zh-TW", "en"] as const)("%s matches snapshot", (lang) =>
    Effect.gen(function* () {
      const out = renderHtml(yield* sample(lang))
      expect(out).toMatchSnapshot()
    }),
  )

  it.effect("escapes quotes and makes no external requests", () =>
    Effect.gen(function* () {
      const out = renderHtml(yield* sample("zh-TW"))
      expect(out).not.toContain("<script>alert")
      expect(out).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;")
      expect(out).not.toMatch(/<link[^>]+href="https?:/)
      expect(out).not.toMatch(/<script[^>]+src=/)
      expect(out).not.toMatch(/url\(\s*["']?https?:/)
      expect(out).not.toMatch(/<img[^>]+src="https?:/)
    }),
  )

  it.effect("flags dimensions without evidence and shows coverage", () =>
    Effect.gen(function* () {
      const out = renderHtml(yield* sample("en"))
      expect(out).toContain("Insufficient evidence")
      expect(out).toContain("1 chunk failed and was skipped")
      expect(out).toContain("41 pieces of evidence verified (3 unverifiable quotes removed)")
    }),
  )
})

describe("card", () => {
  it.effect("renders a 1200×630 PNG with embedded fonts (English)", () =>
    Effect.gen(function* () {
      const profile = yield* sample("en")
      expect(cardNeedsCjk(profile)).toBe(false)
      const png = yield* renderCard(profile, embeddedLatinFonts())
      expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(pngSize(png)).toEqual({ width: 1200, height: 630 })
    }),
  )

  it.effect("never contains prompt quotes", () =>
    Effect.gen(function* () {
      const profile = yield* sample("zh-TW")
      const tree = JSON.stringify(cardTree(profile))
      for (const quote of [...profile.traits, ...profile.dimensions].flatMap((x) =>
        x.evidence.map((e) => e.quote),
      )) {
        expect(tree).not.toContain(quote)
      }
    }),
  )
})

describe("writeReport", () => {
  const run = (
    profile: Profile,
    fetcher: (url: string, signal: AbortSignal) => Promise<Uint8Array>,
  ) => {
    const outDir = join(mkdtempSync(join(tmpdir(), "pp-report-")), "out")
    const cacheDir = mkdtempSync(join(tmpdir(), "pp-cache-"))
    return writeReport(profile, { outDir, cacheDir, fetcher }).pipe(
      Effect.provide(NodeServices.layer),
    )
  }

  it.effect("writes the three files with private permissions (English, no download)", () =>
    Effect.gen(function* () {
      let downloads = 0
      const files = yield* run(yield* sample("en"), async () => {
        downloads++
        return new Uint8Array()
      })
      expect(downloads).toBe(0)
      expect(files.cardError).toBeNull()
      for (const f of [files.html, files.profileJson, files.card!]) {
        expect(statSync(f).mode & 0o777).toBe(0o600)
      }
      expect(JSON.parse(readFileSync(files.profileJson, "utf8"))).toEqual(
        JSON.parse(
          readFileSync(new URL("../fixtures/profile.sample.en.json", import.meta.url), "utf8"),
        ),
      )
    }),
  )

  it.effect("a font checksum mismatch skips the card but keeps the report", () =>
    Effect.gen(function* () {
      const files = yield* run(yield* sample("zh-TW"), async () =>
        new TextEncoder().encode("not a font"),
      )
      expect(files.card).toBeNull()
      expect(files.cardError).toMatch(/checksum mismatch/)
      expect(existsSync(files.html)).toBe(true)
    }),
  )

  it.effect("downloads the CJK fonts concurrently", () =>
    Effect.gen(function* () {
      let inFlight = 0
      let maxInFlight = 0
      yield* run(yield* sample("zh-TW"), async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 20))
        inFlight--
        return new TextEncoder().encode("not a font")
      })
      expect(maxInFlight).toBe(2)
    }),
  )

  it.effect("a failed download aborts the other one", () =>
    Effect.gen(function* () {
      let aborted = false
      const files = yield* run(yield* sample("zh-TW"), (url, signal) =>
        url.includes("Regular")
          ? // fail once the other download is in flight
            new Promise((_resolve, reject) => setTimeout(() => reject(new Error("offline")), 20))
          : new Promise((_resolve, reject) => {
              signal.addEventListener("abort", () => {
                aborted = true
                reject(new Error("aborted"))
              })
            }),
      )
      expect(files.cardError).toMatch(/download failed/)
      expect(aborted).toBe(true)
    }),
  )

  it.effect("a failed download skips the card", () =>
    Effect.gen(function* () {
      const files = yield* run(yield* sample("zh-TW"), async () => {
        throw new Error("offline")
      })
      expect(files.cardError).toMatch(/download failed/)
    }),
  )
})

describe("clip (card text)", () => {
  it.each([
    ["fits", "short headline", 20, "short headline"],
    [
      "cuts English at a word boundary",
      "you keep asking about every result",
      30,
      "you keep asking about every…",
    ],
    ["cuts CJK anywhere", "你習慣在深夜把一長串計畫交給 AI 執行", 10, "你習慣在深夜把一長…"],
    ["a single long word is cut hard", "supercalifragilisticexpialidocious", 12, "supercalifr…"],
    ["accented letters are part of a word", "try caféine today", 8, "try…"],
    ["accented letter right after the cut", "try cafée today", 8, "try…"],
  ] as const)("%s", (_name, text, max, expected) => {
    const out = clip(text, max)
    expect(out).toBe(expected)
    expect(Array.from(out).length).toBeLessThanOrEqual(max)
  })
})
