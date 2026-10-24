import { Effect } from "effect"
import { Resvg, initWasm } from "@resvg/resvg-wasm"
import satori from "satori"
import { createRequire } from "node:module"
import { readAsset } from "../platform/assets.ts"
import type { Profile } from "../domain/Profile.ts"
import { DISPLAY_FONT, type FontData } from "./fonts.ts"
import { clockSvg, graphicSvg, svgDataUrl } from "./graphic.ts"
import {
  CLASSIC_TOKENS,
  DEFAULT_RENDER_OPTIONS,
  lookOf,
  type Look,
  type RenderOptions,
} from "./looks.ts"
import { contentIn } from "./content.ts"
import { chronotype, nightShare } from "./derive.ts"
import { makeScrub, scrubIdentity, visibilityOf } from "./visibility.ts"
import { MESSAGES } from "./messages.ts"
import type { Language } from "../domain/Profile.ts"

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

/** satori element tree without JSX (one less dependency). */
interface Node {
  readonly type: string
  readonly props: {
    readonly style?: Record<string, unknown>
    readonly children?: unknown
    readonly src?: string
    readonly width?: number
    readonly height?: number
  }
}
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
})

/** How far back a cut may move to end at a word boundary (longer words are cut hard). */
const MAX_WORD_BACKOFF = 20
/** Part of a space-separated word: Latin letters (accented too), digits, underscore. */
const WORD_CHAR = /[\p{Script=Latin}\p{N}_]/u

/**
 * At most `max` characters, ending with "…" when shortened. A cut inside a Latin word moves
 * back to the previous space; CJK text has no spaces and is cut anywhere.
 */
export const clip = (s: string, max: number): string => {
  const chars = Array.from(s)
  if (chars.length <= max) return s
  let end = max - 1
  if (WORD_CHAR.test(chars[end - 1] ?? "") && WORD_CHAR.test(chars[end] ?? "")) {
    const space = chars.lastIndexOf(" ", end - 1)
    if (space > 0 && end - space <= MAX_WORD_BACKOFF) end = space
  }
  return `${chars.slice(0, end).join("").trimEnd()}…`
}

/**
 * The card's numbers, as on the report's signature: the busiest four hours, the night share
 * and the longest streak (the first `n`). Never prompt text.
 */
const cardMetrics = (profile: Profile, lang: Language, n: number): Array<[string, string]> => {
  const t = MESSAGES[lang]
  const s = profile.stats
  const window = chronotype(s)
  const hh = (hour: number) => `${String(hour).padStart(2, "0")}:00`
  return (
    [
      [t.cardActive, window === null ? t.none : `${hh(window.start)}–${hh(window.end)}`],
      [t.nightShare, `${Math.round(nightShare(s) * 100)}%`],
      [t.cardStreak, t.days(s.longestStreakDays)],
    ] as Array<[string, string]>
  ).slice(0, n)
}

/** Clock size on the classic card; the report's 260 × 260 drawing is scaled to it. */
const CARD_CLOCK = 300

/**
 * The classic card: the classic report's hero on its page, in its dark colors, with the same
 * hour clock. The hour labels are text nodes over the drawing (SVG images get no fonts).
 */
const classicTree = (profile: Profile, hide: RenderOptions["cardHide"], lang: Language): Node => {
  const t = MESSAGES[lang]
  const c = contentIn(profile, lang)
  const k = CLASSIC_TOKENS.dark
  const name = clip(c.archetype.name, 56)
  const showGraphic = !hide.includes("graphic")
  const clock = clockSvg(profile.stats.hourHistogram, k.accent)
  const left = 1200 - 36 - 56 - CARD_CLOCK
  const top = (CARD_HEIGHT - CARD_CLOCK) / 2
  const scale = CARD_CLOCK / clock.width
  const ticks = [0, 6, 12, 18].map((hour) => {
    const a = (hour / 24) * Math.PI * 2 - Math.PI / 2
    return h(
      "div",
      {
        position: "absolute",
        left: left + (130 + Math.cos(a) * 46) * scale - 20,
        top: top + (130 + Math.sin(a) * 46) * scale - 10,
        width: 40,
        display: "flex",
        justifyContent: "center",
        fontSize: 14,
        color: k.muted,
      },
      String(hour).padStart(2, "0"),
    )
  })
  return h(
    "div",
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      boxSizing: "border-box",
      display: "flex",
      position: "relative",
      backgroundColor: k.bg,
      color: k.fg,
      fontFamily: "Inter",
    },
    [
      h("div", {
        position: "absolute",
        left: 36,
        top: 36,
        width: CARD_WIDTH - 72,
        height: CARD_HEIGHT - 72,
        backgroundColor: k.card,
        border: `1.5px solid ${k.border}`,
        borderRadius: 32,
      }),
      ...(showGraphic
        ? [
            {
              type: "img",
              props: {
                src: svgDataUrl(clock.svg),
                width: CARD_CLOCK,
                height: CARD_CLOCK,
                style: { position: "absolute", left, top },
              },
            },
            ...ticks,
          ]
        : []),
      h(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // Absolute like the layers below it, so it is painted on top of them.
          position: "absolute",
          left: 36,
          top: 36,
          width: CARD_WIDTH - 72,
          height: CARD_HEIGHT - 72,
          padding: "40px 56px",
          boxSizing: "border-box",
        },
        [
          h("div", { fontSize: 20, fontWeight: 700 }, t.project),
          h(
            "div",
            { display: "flex", flexDirection: "column", maxWidth: showGraphic ? 700 : 1000 },
            [
              h(
                "div",
                {
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 800,
                  fontSize: titleSize(name),
                  lineHeight: 0.98,
                  letterSpacing: -2,
                },
                name,
              ),
              h(
                "div",
                { fontSize: 24, lineHeight: 1.4, marginTop: 18, color: k.muted },
                clip(c.headline, 120),
              ),
              hide.includes("traits")
                ? null
                : h(
                    "div",
                    { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 },
                    profile.traits.slice(0, 3).map((_tr, i) =>
                      h(
                        "div",
                        {
                          display: "flex",
                          fontSize: 18,
                          padding: "6px 16px",
                          borderRadius: 999,
                          color: k.accent,
                          backgroundColor: k.accentSoft,
                        },
                        clip(c.trait(i).name, 32),
                      ),
                    ),
                  ),
            ],
          ),
          h("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end" }, [
            h(
              "div",
              { display: "flex", gap: 44 },
              (hide.includes("stats") ? [] : cardMetrics(profile, lang, 3)).map(([label, value]) =>
                h("div", { display: "flex", flexDirection: "column" }, [
                  h("div", { fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 36 }, value),
                  h("div", { fontSize: 16, color: k.muted }, label),
                ]),
              ),
            ),
            h("div", { fontSize: 18, color: k.muted }, "npx prompt-profile"),
          ]),
        ],
      ),
    ],
  )
}

/** Archetype size steps: long names get smaller type instead of overflowing. */
const titleSize = (name: string) => (name.length > 44 ? 58 : name.length > 26 ? 72 : 96)

/** A share-first look: identity colors, display type and the activity graphic. */
const lookTree = (
  profile: Profile,
  look: Look,
  hide: RenderOptions["cardHide"],
  lang: Language,
): Node => {
  const t = MESSAGES[lang]
  const c = contentIn(profile, lang)
  const s = profile.stats
  const id = look.identity
  const name = clip(c.archetype.name, 56)
  const showGraphic = !hide.includes("graphic")
  const graphic = graphicSvg(id.graphic, s.hourHistogram, id)
  const box = { bars: [56, 168, 340], orbit: [56, 110, 370], fold: [70, 190, 290] }[id.graphic]
  const [right, top, width] = box as [number, number, number]
  const metrics = cardMetrics(profile, lang, 2)
  return h(
    "div",
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      boxSizing: "border-box",
      display: "flex",
      position: "relative",
      backgroundColor: id.background,
      color: id.text,
      fontFamily: "Inter",
    },
    [
      id.split
        ? h("div", {
            position: "absolute",
            right: 0,
            top: 0,
            width: Math.round(CARD_WIDTH * 0.34),
            height: CARD_HEIGHT,
            backgroundColor: id.split,
          })
        : null,
      showGraphic
        ? {
            type: "img",
            props: {
              src: svgDataUrl(graphic.svg),
              width,
              height: Math.round((width * graphic.height) / graphic.width),
              style: { position: "absolute", right, top },
            },
          }
        : null,
      h(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // Absolute like the layers below it, so it is painted on top of them.
          position: "absolute",
          left: 0,
          top: 0,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          padding: "52px 60px",
          boxSizing: "border-box",
        },
        [
          h("div", { display: "flex", justifyContent: "space-between", fontSize: 18 }, [
            h("div", { fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 24 }, t.project),
            h("div", { color: id.muted }, t.madeFrom),
          ]),
          h(
            "div",
            { display: "flex", flexDirection: "column", maxWidth: showGraphic ? 700 : 1000 },
            [
              h(
                "div",
                {
                  fontFamily: DISPLAY_FONT,
                  fontWeight: 800,
                  fontSize: titleSize(name),
                  lineHeight: 0.98,
                  letterSpacing: -2,
                },
                name,
              ),
              h(
                "div",
                { fontSize: 24, lineHeight: 1.4, marginTop: 20, color: id.muted },
                clip(c.headline, 120),
              ),
              hide.includes("traits")
                ? null
                : h(
                    "div",
                    { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 },
                    profile.traits.slice(0, 3).map((_tr, i) =>
                      h(
                        "div",
                        {
                          display: "flex",
                          fontSize: 18,
                          padding: "6px 16px",
                          borderRadius: 999,
                          border: `1.5px solid ${id.chipBorder}`,
                          backgroundColor: id.chipBackground,
                        },
                        clip(c.trait(i).name, 32),
                      ),
                    ),
                  ),
            ],
          ),
          h("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end" }, [
            h(
              "div",
              { display: "flex", gap: 44 },
              (hide.includes("stats") ? [] : metrics).map(([label, value]) =>
                h("div", { display: "flex", flexDirection: "column" }, [
                  h("div", { fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 40 }, value),
                  h("div", { fontSize: 16, color: id.muted }, label),
                ]),
              ),
            ),
            h("div", { fontSize: 18, color: id.split ? id.text : id.muted }, "npx prompt-profile"),
          ]),
        ],
      ),
    ].filter((x) => x !== null),
  )
}

/**
 * Card content: archetype, headline, up to 3 trait names and a few numbers.
 * **Never any prompt text** — the card is meant to be shared publicly.
 */
export const cardTree = (
  profile: Profile,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
  lang: Language = profile.languages[0],
): Node => {
  const look = lookOf(options.look)
  const v = visibilityOf(options)
  const p = v.projects ? profile : scrubIdentity(profile, makeScrub(profile, v), lang)
  return look === null
    ? classicTree(p, options.cardHide, lang)
    : lookTree(p, look, options.cardHide, lang)
}

let wasmReady: Promise<void> | null = null
const ensureWasm = (): Promise<void> => {
  if (wasmReady === null) {
    const require = createRequire(import.meta.url)
    wasmReady = initWasm(
      readAsset("index_bg.wasm", () => require.resolve("@resvg/resvg-wasm/index_bg.wasm")),
    )
  }
  return wasmReady
}

/** Render the card to PNG bytes. */
export const renderCard = (
  profile: Profile,
  fonts: ReadonlyArray<FontData>,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
  lang: Language = profile.languages[0],
): Effect.Effect<Uint8Array, Error> =>
  Effect.tryPromise({
    try: async () => {
      const svg = await satori(cardTree(profile, options, lang) as never, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fonts: fonts.map((f) => ({
          name: f.name,
          data: Buffer.from(f.data),
          weight: f.weight,
          style: "normal" as const,
        })),
      })
      await ensureWasm()
      const resvg = new Resvg(svg, { fitTo: { mode: "width", value: CARD_WIDTH } })
      try {
        return resvg.render().asPng()
      } finally {
        resvg.free()
      }
    },
    catch: (e) => (e instanceof Error ? e : new Error(String(e))),
  })
