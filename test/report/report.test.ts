import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, PlatformError } from "effect"
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { cardTree, clip, renderCard } from "../../src/report/card.ts"
import { embeddedFonts } from "../../src/report/fonts.ts"
import { escapeHtml, html, raw } from "../../src/report/html-template.ts"
import { renderHtml, writeReport } from "../../src/report/index.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)
const sample = () => decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))

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
  it.effect("matches snapshot", () =>
    Effect.gen(function* () {
      const out = renderHtml(yield* sample())
      expect(out).toMatchSnapshot()
    }),
  )

  it.effect("escapes quotes and makes no external requests", () =>
    Effect.gen(function* () {
      const out = renderHtml(yield* sample())
      expect(out).not.toContain("<script>alert")
      expect(out).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;")
      expect(out).not.toMatch(/<link[^>]+href="https?:/)
      expect(out).not.toMatch(/<script[^>]+src=/)
      expect(out).not.toMatch(/url\(\s*["']?https?:/)
      expect(out).not.toMatch(/<img[^>]+src="https?:/)
    }),
  )

  it.effect("states the data period, its length and when the report was generated", () =>
    Effect.gen(function* () {
      const out = renderHtml(yield* sample())
      const facts = /<dl class="report-facts">([\s\S]*?)<\/dl>/.exec(out)?.[1] ?? ""
      for (const part of [
        "Data period",
        "Apr 25, 2026 – Oct 23, 2026",
        "182 days",
        "Generated",
        "Oct 24, 2026",
        "資料區間",
        "2026年4月25日 – 2026年10月23日",
        "182 天",
        "產生時間",
      ])
        expect({ part, found: facts.includes(part) }).toEqual({ part, found: true })
    }),
  )

  it.effect("flags dimensions without evidence and shows coverage", () =>
    Effect.gen(function* () {
      const out = renderHtml(yield* sample())
      expect(out).toContain("Insufficient evidence")
      expect(out).toContain("1 chunk failed and was skipped")
      expect(out).toContain(
        "41 pieces of evidence verified (3 invalid or duplicate quotes removed)",
      )
    }),
  )
})

describe("card", () => {
  it.effect("renders a 1200×630 PNG with the embedded font", () =>
    Effect.gen(function* () {
      const profile = yield* sample()
      const png = yield* renderCard(profile, embeddedFonts())
      expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      expect(pngSize(png)).toEqual({ width: 1200, height: 630 })
    }),
  )

  it.effect("never contains prompt quotes", () =>
    Effect.gen(function* () {
      const profile = yield* sample()
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
  it.effect("writes the three files with private permissions, without any network request", () =>
    Effect.gen(function* () {
      const outDir = join(mkdtempSync(join(tmpdir(), "pp-report-")), "out")
      const files = yield* writeReport(yield* sample(), outDir).pipe(
        Effect.provide(NodeServices.layer),
      )
      expect(files.cardError).toBeNull()
      for (const f of [files.html, files.profileJson, files.card!]) {
        expect(statSync(f).mode & 0o777).toBe(0o600)
      }
      expect(JSON.parse(readFileSync(files.profileJson, "utf8"))).toEqual(
        JSON.parse(readFileSync(SAMPLE, "utf8")),
      )
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

it.effect("removes an old card before updating the report, even if rendering fails", () =>
  Effect.gen(function* () {
    const outDir = mkdtempSync(join(tmpdir(), "pp-stale-card-"))
    const card = join(outDir, "card.png")
    writeFileSync(card, "previous person's card")
    const fs = yield* FileSystem.FileSystem
    const files = yield* writeReport(yield* sample(), outDir).pipe(
      Effect.provideService(FileSystem.FileSystem, {
        ...fs,
        writeFile: (file, data, options) =>
          file.startsWith(card)
            ? Effect.fail(
                PlatformError.systemError({
                  _tag: "PermissionDenied",
                  module: "FileSystem",
                  method: "writeFile",
                }),
              )
            : fs.writeFile(file, data, options),
      }),
    )
    expect(files.card).toBeNull()
    expect(files.cardError).not.toBeNull()
    expect(existsSync(card)).toBe(false)
    expect(existsSync(files.html)).toBe(true)
  }).pipe(Effect.provide(NodeServices.layer)),
)

it.effect("does not update the report if the stale card cannot be removed", () =>
  Effect.gen(function* () {
    const outDir = mkdtempSync(join(tmpdir(), "pp-card-removal-"))
    const htmlPath = join(outDir, "report.html")
    writeFileSync(htmlPath, "previous report")
    const fs = yield* FileSystem.FileSystem
    const result = yield* Effect.result(
      writeReport(yield* sample(), outDir).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          remove: () =>
            Effect.fail(
              PlatformError.systemError({
                _tag: "PermissionDenied",
                module: "FileSystem",
                method: "remove",
              }),
            ),
        }),
      ),
    )
    expect(result._tag).toBe("Failure")
    expect(readFileSync(htmlPath, "utf8")).toBe("previous report")
  }).pipe(Effect.provide(NodeServices.layer)),
)
