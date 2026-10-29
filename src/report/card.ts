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
import { cardPeriod, cardSummary } from "./card-summary.ts"
import { makeScrub, scrubIdentity, visibilityOf } from "./visibility.ts"
import { isLimitedEvidence, limitedView } from "./evidence.ts"
import { CARD_MESSAGES, MESSAGES } from "./messages.ts"
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
          maxHeight: titleSize(card, name) * card.title.lineHeight * 2,
          overflow: "hidden",
          lineClamp: 2,
          wordBreak: "normal",
          flexShrink: 0,
          lineHeight: card.title.lineHeight,
          letterSpacing: card.title.tracking,
        },
        name,
      ),
      h(
        "div",
        {
          fontSize: card.size.headline,
          maxHeight: card.size.headline * card.headline.lineHeight * 2,
          overflow: "hidden",
          lineClamp: 2,
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
            { display: "flex", gap: card.chips.gap, flexWrap: "nowrap", marginTop: card.chips.top },
            profile.traits
              .map((t, i) => ({ t, i }))
              .filter(({ t }) => t.confidence !== "low" && t.evidence.length > 0)
              .slice(0, 2)
              .map(({ i }) =>
                h(
                  "div",
                  {
                    display: "flex",
                    fontSize: card.size.chip,
                    padding: card.chips.padding,
                    maxWidth: 320,
                    maxHeight: 40,
                    overflow: "hidden",
                    lineClamp: 1,
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
  showUsage: boolean,
): Node =>
  h(
    "div",
    { display: "flex", gap: 24, width: CARD_WIDTH - 2 * theme.card.padding.x },
    (hide.includes("stats") ? [] : cardSummary(profile, lang, showUsage).metrics).map(
      ([label, value]) =>
        h("div", { display: "flex", flexDirection: "column", flex: 1 }, [
          h(
            "div",
            {
              fontFamily: fontsOf(theme).display,
              fontWeight: 800,
              fontSize:
                value.length > 10 ? Math.min(26, theme.card.size.metric) : theme.card.size.metric,
            },
            value,
          ),
          h("div", { fontSize: theme.card.size.label, color: muted }, label),
        ]),
    ),
  )

const cardFooter = (
  p: Profile,
  theme: Theme,
  hide: RenderOptions["cardHide"],
  lang: Language,
  muted: string,
  showUsage: boolean,
  exactDates: boolean,
): Node =>
  h(
    "div",
    {
      display: "flex",
      justifyContent: "space-between",
      width: CARD_WIDTH - 2 * theme.card.padding.x,
      fontSize: theme.card.size.footer,
      color: muted,
    },
    [
      h(
        "div",
        { maxWidth: 740, flex: 1, marginRight: 20 },
        hide.includes("stats") ? "" : cardSummary(p, lang, showUsage, exactDates).note,
      ),
      h("div", { flexShrink: 0 }, CARD_MESSAGES[lang].attribution),
    ],
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
  showUsage: boolean,
  exactDates: boolean,
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
        h("div", { display: "flex", justifyContent: "space-between", alignItems: "center" }, [
          h("div", { fontSize: card.size.brand, fontWeight: 700 }, t.project),
          hide.includes("stats")
            ? null
            : h(
                "div",
                { fontSize: card.size.header, color: k.muted },
                cardPeriod(profile, lang, exactDates),
              ),
        ]),
        identityCopy(profile, theme, hide, lang, showGraphic, {
          muted: k.muted,
          chip: { color: k.accent, backgroundColor: k.accentSoft },
        }),
        h("div", { display: "flex", flexDirection: "column", gap: 18 }, [
          metricRow(profile, theme, hide, lang, k.muted, showUsage),
          cardFooter(profile, theme, hide, lang, k.muted, showUsage, exactDates),
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
  showUsage: boolean,
  exactDates: boolean,
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
          hide.includes("stats")
            ? null
            : h("div", { color: id.muted }, cardPeriod(profile, lang, exactDates)),
        ]),
        identityCopy(profile, theme, hide, lang, showGraphic, {
          muted: id.muted,
          chip: {
            border: `${card.chips.border}px solid ${id.chipBorder}`,
            backgroundColor: id.chipBackground,
          },
        }),
        h("div", { display: "flex", flexDirection: "column", gap: 18 }, [
          metricRow(profile, theme, hide, lang, id.muted, showUsage),
          cardFooter(profile, theme, hide, lang, id.muted, showUsage, exactDates),
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
  showUsage: boolean,
  exactDates: boolean,
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
        [
          h("div", {}, MESSAGES[lang].project),
          h(
            "div",
            {},
            hide.includes("stats") ? theme.id.toUpperCase() : cardPeriod(p, lang, exactDates),
          ),
        ],
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
                  wordBreak: "normal",
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
                  wordBreak: "normal",
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
                          wordBreak: "normal",
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
                      height: 100,
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
                      marginTop: 18,
                    },
                    cardSummary(p, lang, showUsage, exactDates).metrics.map(([label, value]) =>
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
        cardFooter(p, theme, hide, lang, k.muted, showUsage, exactDates),
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
  // Limited evidence: the limits instead of a role, and no trait chips (plan 24).
  const shown = limitedView(profile)
  const p = v.projects ? shown : scrubIdentity(shown, makeScrub(shown, v), lang)
  const hide: RenderOptions["cardHide"] = isLimitedEvidence(profile)
    ? [...new Set([...options.cardHide, "traits" as const])]
    : options.cardHide
  return TREES[theme.card.composition](p, theme, hide, lang, v.usage, v.dates)
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
