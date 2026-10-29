import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { cardTree, renderCard } from "../../src/report/card.ts"
import { embeddedFonts } from "../../src/report/fonts.ts"
import { renderHtml } from "../../src/report/html.ts"
import { LOOK_IDS, type LookId } from "../../src/report/looks.ts"
import { themeCss } from "../../src/report/theme-css.ts"
import { lookOf, THEMES, type Theme } from "../../src/report/theme.ts"

const sample = () =>
  decodeProfile(
    JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
  )

/** Pills, circles, flat corners and chart marks up to 5px keep fixed radii. */
const FIXED_RADIUS = /^(0|50%|999px|[1-5]px|var\(--[a-z-]+\))$/

const styleOf = (page: string): string => /<style>([\s\S]*?)<\/style>/.exec(page)![1]!

const pngSize = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

/** A look that is not registered: new colors on a mix of existing variants. */
const EIGHTH: Theme = {
  ...lookOf("folio"),
  id: "eighth" as LookId,
  version: 1,
  color: {
    ...lookOf("folio").color,
    light: { ...lookOf("folio").color.light, accent: "#0a7f3f", bg: "#f2fbf5" },
  },
  space: { ...lookOf("folio").space, page: "1010px" },
  layout: { composition: "document", hero: "panel", signatures: "ledger", storyWidth: "full" },
  card: { ...lookOf("slate").card, size: { ...lookOf("slate").card.size, footer: 17 } },
}

describe("theme registry", () => {
  it("has exactly one theme per look, classic included", () => {
    expect(THEMES.map((t) => t.id).toSorted()).toEqual([...LOOK_IDS].toSorted())
    for (const id of LOOK_IDS) expect(lookOf(id).id).toBe(id)
  })

  it("names only fonts the card and report can load", () => {
    const loaded = embeddedFonts().map((f) => `${f.name} ${f.weight}`)
    // The card draws body text at 400 and 700 and the display face at 800; the report embeds
    // its display face.
    const needed = THEMES.flatMap((t) => [
      `${t.type.card.body} 400`,
      `${t.type.card.body} 700`,
      `${t.type.card.display} 800`,
      ...(t.type.display === null ? [] : [`${t.type.display.family} ${t.type.display.weight}`]),
    ])
    expect(loaded).toEqual(expect.arrayContaining(needed))
  })
})

describe("generated stylesheet", () => {
  it.effect("only the theme block holds colors; nothing selects a look id", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const scans = LOOK_IDS.map((id) => {
        const style = styleOf(renderHtml(p, { look: id, cardHide: [] })).trimStart()
        const block = themeCss(lookOf(id))
        const components = style.slice(block.length)
        return {
          id,
          themeFirst: style.startsWith(block),
          lookSelectors: components.match(/data-look[^{]*/g) ?? [],
          colors: components.match(/#[0-9a-f]{3,8}(?![\w-])|rgba?\([^)]*\)/gi) ?? [],
          // Surfaces read the radius scale; only pills, circles and small chart marks are fixed.
          radii: [...components.matchAll(/border-radius:([^;}!]+)/g)]
            .map((m) => m[1]!.trim())
            .filter((v) => !v.split(/\s+/).every((part) => FIXED_RADIUS.test(part))),
          // Every transition and animation takes its timing from the motion tokens.
          durations: components.match(/(?<![\w.-])\d*\.?\d+m?s(?![\w-])/g) ?? [],
        }
      })
      expect(scans).toEqual(
        LOOK_IDS.map((id) => ({
          id,
          themeFirst: true,
          lookSelectors: [],
          colors: [],
          radii: [],
          durations: [],
        })),
      )
    }),
  )

  it.effect("screen text sizes come from the type scale tokens, in every look", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      for (const look of LOOK_IDS) {
        const theme = lookOf(look)
        const css = styleOf(renderHtml(p, { look, cardHide: [], exclude: [] }))
        for (const step of ["2xs", "xs", "sm", "md", "base", "lg", "xl", "2xl"])
          expect(themeCss(theme)).toContain(`--text-${step}:${theme.type.scale[step as "sm"]}`)
        // print rules use points; tiny SVG chart labels keep fixed sizes below the scale
        const screen = css.replace(/@media print\{(?:[^{}]|\{[^{}]*\})*\}/g, "")
        const raw = [...screen.matchAll(/font-size:\s*([\d.]+px)/g)]
          .map((m) => m[1]!)
          .filter((size) => Number.parseFloat(size) >= 11)
        expect({ look, raw }).toEqual({ look, raw: [] })
      }
    }),
  )

  it.effect("animates hover, tooltips and views, and stops for reduced motion", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      for (const id of LOOK_IDS) {
        const style = styleOf(renderHtml(p, { look: id, cardHide: [] }))
        expect(style).toContain("--motion-fast:150ms")
        expect(style).toMatch(/\.sig\{[^}]*transition:[^}]*var\(--motion-fast\)/)
        expect(style).toMatch(/\.tip:hover::after[^{]*\{[^}]*animation:[^}]*var\(--motion-base\)/)
        expect(style).toMatch(/\.report-view\{[^}]*animation:[^}]*var\(--motion-base\)/)
        const reduced = /@media \(prefers-reduced-motion:reduce\)\{([^{]*\{[^}]*\})\}/.exec(style)
        expect(reduced?.[1]).toMatch(/animation:none!important/)
        expect(reduced?.[1]).toMatch(/transition:none!important/)
      }
    }),
  )
})

describe("an unregistered eighth look", () => {
  it.effect("needs only a theme to render a report", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const out = renderHtml(p, { look: EIGHTH.id, cardHide: [] }, EIGHTH)
      expect(out).toContain('data-look="eighth"')
      expect(out).toContain('data-hero="panel" data-signatures="ledger"')
      expect(out).toContain("--accent:#0a7f3f")
      expect(out).toContain("--page:1010px")
      expect(out).toContain('class="identity-signatures"')
      expect(out).not.toContain(lookOf("folio").color.light.accent)
    }),
  )

  it.effect("needs only a theme to render a card", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const tree = JSON.stringify(cardTree(p, { look: EIGHTH.id, cardHide: [] }, "en", EIGHTH))
      expect(tree).toContain("#0a7f3f")
      expect(tree).toContain('"fontSize":17')
      // Tokens reach every part they size, also when a look makes them differ.
      const uneven: Theme = {
        ...EIGHTH,
        card: {
          ...EIGHTH.card,
          padding: { y: 40, x: 64 },
          size: { ...EIGHTH.card.size, metric: 21, label: 15 },
        },
      }
      const root = cardTree(p, { look: EIGHTH.id, cardHide: [] }, "en", uneven)
      expect(root.props.style).toMatchObject({ padding: "40px 64px" })
      const text = JSON.stringify(root)
      expect(text).toContain('"width":1072')
      expect(text).toContain('"left":64')
      expect(text).toMatch(/"color":"[^"]+","fontSize":21/)
      const png = yield* renderCard(
        p,
        embeddedFonts(),
        { look: EIGHTH.id, cardHide: [] },
        "en",
        EIGHTH,
      )
      expect(pngSize(png)).toEqual({ width: 1200, height: 630 })
    }),
  )
})
