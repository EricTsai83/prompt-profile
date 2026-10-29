import { Effect } from "effect"
import { Resvg, initWasm } from "@resvg/resvg-wasm"
import satori from "satori"
import { createRequire } from "node:module"
import { readAsset } from "../platform/assets.ts"
import type { Profile } from "../domain/Profile.ts"
import type { FontData } from "./fonts.ts"
import { clockSvg, graphicSvg, svgDataUrl } from "./graphic.ts"
import { DEFAULT_RENDER_OPTIONS, type RenderOptions } from "./looks.ts"
import { lookOf, type CardTokens, type Theme } from "./theme.ts"
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

/** Archetype size steps: long names get smaller type instead of overflowing. */
const titleSize = (card: CardTokens, name: string) =>
  card.size.title[name.length > 44 ? 2 : name.length > 26 ? 1 : 0]

/** The card's font families, from the theme. */
const fontsOf = (theme: Theme) => {
  const { body, display } = theme.type.card
  return { body, display, title: theme.card.titleFont === "display" ? display : body }
}

/** Color tokens of a classic or product card. */
const schemeOf = (theme: Theme) => theme.color[theme.card.scheme]

/** The archetype name, headline and trait chips of a classic or identity card. */
const identityCopy = (
  profile: Profile,
  theme: Theme,
  hide: RenderOptions["cardHide"],
  lang: Language,
  showGraphic: boolean,
  colors: { readonly muted: string; readonly chip: Record<string, unknown> },
): Node => {
  const c = contentIn(profile, lang)
  const card = theme.card
  const font = fontsOf(theme)
  const name = clip(c.archetype.name, 56)
  return h(
    "div",
    { display: "flex", flexDirection: "column", maxWidth: showGraphic ? 700 : 1000 },
    [
      h(
        "div",
        {
          fontFamily: font.title,
          fontWeight: 800,
          fontSize: titleSize(card, name),
          lineHeight: card.title.lineHeight,
          letterSpacing: card.title.tracking,
        },
        name,
      ),
      h(
        "div",
        {
          fontSize: card.size.headline,
          lineHeight: card.headline.lineHeight,
          marginTop: card.headline.gap,
          color: colors.muted,
        },
        clip(c.headline, 120),
      ),
      hide.includes("traits")
        ? null
        : h(
            "div",
            { display: "flex", gap: card.chips.gap, flexWrap: "wrap", marginTop: card.chips.top },
            profile.traits.slice(0, 3).map((_tr, i) =>
              h(
                "div",
                {
                  display: "flex",
                  fontSize: card.size.chip,
                  padding: card.chips.padding,
                  borderRadius: 999,
                  ...colors.chip,
                },
                clip(c.trait(i).name, 32),
              ),
            ),
          ),
    ],
  )
}

/** The card's numbers in a row (classic and identity cards). */
const metricRow = (
  profile: Profile,
  theme: Theme,
  hide: RenderOptions["cardHide"],
  lang: Language,
  muted: string,
): Node =>
  h(
    "div",
    { display: "flex", gap: theme.card.metrics.gap },
    (hide.includes("stats") ? [] : cardMetrics(profile, lang, theme.card.metrics.count)).map(
      ([label, value]) =>
        h("div", { display: "flex", flexDirection: "column" }, [
          h(
            "div",
            {
              fontFamily: fontsOf(theme).display,
              fontWeight: 800,
              fontSize: theme.card.size.metric,
            },
            value,
          ),
          h("div", { fontSize: theme.card.size.label, color: muted }, label),
        ]),
    ),
  )

/** The full-card text layer, painted over the background layers. */
const copyLayer = (theme: Theme, children: Array<Node | null>): Node =>
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
      padding: `${theme.card.padding.y}px ${theme.card.padding.x}px`,
      boxSizing: "border-box",
    },
    children,
  )

/**
 * The classic card: the classic report's hero edge to edge, like the looks, in its dark colors,
 * with the same hour clock (`card.graphic`: its size and distance from the right edge). The hour
 * labels are text nodes over the drawing (SVG images get no fonts).
 */
const classicTree = (
  profile: Profile,
  theme: Theme,
  hide: RenderOptions["cardHide"],
  lang: Language,
): Node => {
  const t = MESSAGES[lang]
  const k = schemeOf(theme)
  const card = theme.card
  const size = card.graphic.width
  const showGraphic = !hide.includes("graphic")
  const clock = clockSvg(profile.stats.hourHistogram, k.accent)
  const left = CARD_WIDTH - card.graphic.right - size
  const top = (CARD_HEIGHT - size) / 2
  const scale = size / clock.width
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
      backgroundColor: k.card,
      color: k.fg,
      fontFamily: fontsOf(theme).body,
    },
    [
      ...(showGraphic
        ? [
            {
              type: "img",
              props: {
                src: svgDataUrl(clock.svg),
                width: size,
                height: size,
                style: { position: "absolute", left, top },
              },
            },
            ...ticks,
          ]
        : []),
      copyLayer(theme, [
        h("div", { fontSize: card.size.brand, fontWeight: 700 }, t.project),
        identityCopy(profile, theme, hide, lang, showGraphic, {
          muted: k.muted,
          chip: { color: k.accent, backgroundColor: k.accentSoft },
        }),
        h("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end" }, [
          metricRow(profile, theme, hide, lang, k.muted),
          h("div", { fontSize: card.size.footer, color: k.muted }, "npx prompt-profile"),
        ]),
      ]),
    ],
  )
}

/** A share-first look: identity colors, display type and the activity graphic. */
const identityTree = (
  profile: Profile,
  theme: Theme,
  hide: RenderOptions["cardHide"],
  lang: Language,
): Node => {
  const t = MESSAGES[lang]
  const id = theme.identity
  const card = theme.card
  const showGraphic = !hide.includes("graphic")
  const graphic = graphicSvg(id.graphic, profile.stats.hourHistogram, id)
  const { right, top, width } = card.graphic
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
      fontFamily: fontsOf(theme).body,
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
      copyLayer(theme, [
        h("div", { display: "flex", justifyContent: "space-between", fontSize: card.size.header }, [
          h(
            "div",
            { fontFamily: fontsOf(theme).display, fontWeight: 800, fontSize: card.size.brand },
            t.project,
          ),
          h("div", { color: id.muted }, t.madeFrom),
        ]),
        identityCopy(profile, theme, hide, lang, showGraphic, {
          muted: id.muted,
          chip: {
            border: `${card.chips.border}px solid ${id.chipBorder}`,
            backgroundColor: id.chipBackground,
          },
        }),
        h("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end" }, [
          metricRow(profile, theme, hide, lang, id.muted),
          h(
            "div",
            { fontSize: card.size.footer, color: id.split ? id.text : id.muted },
            "npx prompt-profile",
          ),
        ]),
      ]),
    ].filter((x) => x !== null),
  )
}

/** Product cards use a quiet identity column and a separate activity/support surface. */
const productTree = (
  p: Profile,
  theme: Theme,
  hide: RenderOptions["cardHide"],
  lang: Language,
): Node => {
  const c = contentIn(p, lang)
  const k = schemeOf(theme)
  const card = theme.card
  const pad = card.padding.x
  const inner = CARD_WIDTH - 2 * pad
  const support = card.support
  const graphic = graphicSvg("bars", p.stats.hourHistogram, theme.identity)
  const traits = p.traits
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.confidence !== "low" && t.evidence.length > 0)
    .slice(0, 2)
  return h(
    "div",
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      display: "flex",
      flexDirection: "column",
      padding: `${card.padding.y}px ${pad}px`,
      position: "relative",
      boxSizing: "border-box",
      backgroundColor: k.bg,
      color: k.fg,
      fontFamily: fontsOf(theme).body,
      borderTop: `${card.accentRule}px solid ${k.accent}`,
    },
    [
      h(
        "div",
        {
          display: "flex",
          width: inner,
          justifyContent: "space-between",
          fontSize: card.size.header,
          color: k.muted,
        },
        [h("div", {}, MESSAGES[lang].project), h("div", {}, theme.id.toUpperCase())],
      ),
      h(
        "div",
        {
          display: "flex",
          position: "absolute",
          left: pad,
          top: 120,
          width: inner,
          height: 390,
          gap: 40,
        },
        [
          h(
            "div",
            {
              display: "flex",
              flexDirection: "column",
              width: 700,
              flexShrink: 0,
              height: 390,
              overflow: "hidden",
            },
            [
              h(
                "div",
                {
                  fontFamily: fontsOf(theme).title,
                  fontSize: card.size.title[0],
                  fontWeight: 700,
                  lineHeight: card.title.lineHeight,
                  letterSpacing: card.title.tracking,
                  width: 700,
                  maxHeight: 108,
                  flexShrink: 0,
                  lineClamp: 2,
                  overflow: "hidden",
                  wordBreak: "break-all",
                },
                clip(c.archetype.name.replace(/\s+/g, " "), 52),
              ),
              h(
                "div",
                {
                  fontSize: card.size.headline,
                  lineHeight: card.headline.lineHeight,
                  color: k.muted,
                  marginTop: card.headline.gap,
                  width: 700,
                  maxHeight: 70,
                  flexShrink: 0,
                  lineClamp: 2,
                  overflow: "hidden",
                  wordBreak: "break-all",
                },
                clip(c.headline.replace(/\s+/g, " "), 105),
              ),
              hide.includes("traits")
                ? null
                : h(
                    "div",
                    {
                      display: "flex",
                      flexDirection: "column",
                      gap: card.chips.gap,
                      marginTop: card.chips.top,
                      fontSize: card.size.chip,
                    },
                    traits.map(({ i }) =>
                      h(
                        "div",
                        {
                          display: "block",
                          padding: card.chips.padding,
                          borderTop: `${card.chips.border}px solid ${k.border}`,
                          width: 700,
                          maxHeight: 36,
                          flexShrink: 0,
                          lineHeight: 1.3,
                          lineClamp: 1,
                          overflow: "hidden",
                          wordBreak: "break-all",
                        },
                        clip(c.trait(i).name.replace(/\s+/g, " "), 48),
                      ),
                    ),
                  ),
            ],
          ),
          h(
            "div",
            {
              display: "flex",
              flexDirection: "column",
              justifyContent: support.align === "end" ? "flex-end" : "center",
              width: 340,
              padding: support.padding,
              backgroundColor: k[support.surface],
            },
            [
              hide.includes("graphic")
                ? null
                : {
                    type: "img",
                    props: {
                      src: svgDataUrl(graphic.svg),
                      width: card.graphic.width,
                      height: 180,
                    },
                  },
              hide.includes("stats")
                ? null
                : h(
                    "div",
                    {
                      display: "flex",
                      flexDirection: "column",
                      gap: card.metrics.gap,
                      marginTop: 26,
                    },
                    cardMetrics(p, lang, card.metrics.count).map(([label, value]) =>
                      h(
                        "div",
                        {
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: card.size.label,
                          color: k.muted,
                        },
                        [label, h("b", { color: k.fg, fontSize: card.size.metric }, value)],
                      ),
                    ),
                  ),
            ],
          ),
        ],
      ),
      h(
        "div",
        {
          display: "flex",
          position: "absolute",
          left: pad,
          bottom: 30,
          width: inner,
          borderTop: `1px solid ${k.border}`,
          paddingTop: 18,
          fontSize: card.size.footer,
          color: k.muted,
        },
        "npx prompt-profile",
      ),
    ],
  )
}

const TREES = { classic: classicTree, identity: identityTree, product: productTree } as const

/**
 * Card content: archetype, headline, up to 3 trait names and a few numbers.
 * **Never any prompt text** — the card is meant to be shared publicly.
 */
export const cardTree = (
  profile: Profile,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
  lang: Language = profile.languages[0],
  // Every look-specific choice comes from the theme; tests pass one that is not registered.
  theme: Theme = lookOf(options.look),
): Node => {
  // Project visibility is the same user choice for the report and its card.
  const v = visibilityOf(options)
  const p = v.projects ? profile : scrubIdentity(profile, makeScrub(profile, v), lang)
  return TREES[theme.card.composition](p, theme, options.cardHide, lang)
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
  theme: Theme = lookOf(options.look),
): Effect.Effect<Uint8Array, Error> =>
  Effect.tryPromise({
    try: async () => {
      const svg = await satori(cardTree(profile, options, lang, theme) as never, {
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
