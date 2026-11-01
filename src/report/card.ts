import { AVATAR_PALETTE, avatarFor, type avatarSvg } from "./avatar.ts"
import { cardRadar } from "./card-radar.ts"
import { Effect } from "effect"
import { Resvg, initWasm } from "@resvg/resvg-wasm"
import satori from "satori"
import { createRequire } from "node:module"
import { readAsset } from "../platform/index.ts"
import type { Profile, Language } from "../domain/index.ts"
import type { FontData } from "./fonts.ts"
import { graphicSvg, svgDataUrl } from "./graphic.ts"
import { DEFAULT_RENDER_OPTIONS, type RenderOptions } from "./looks.ts"
import { lookOf, type CardTokens, type Theme } from "./theme.ts"
import { contentIn, signatureNames } from "./content.ts"
import { cardPeriod, cardSummary } from "./card-summary.ts"
import { makeScrub, scrubIdentity, visibilityOf } from "./visibility.ts"
import { isLimitedEvidence, limitedView } from "./evidence.ts"
import { AVATAR_MESSAGES, CARD_MESSAGES } from "./messages.ts"

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

/** Width of a title in ems per character, roughly: CJK glyphs are about twice a Latin one. */
const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60]/u

/**
 * The title size that fits `name` in two lines of `width` pixels, never above the theme's step
 * (a Latin glyph is about 0.55em of display type; word wrapping wastes about 15%).
 */
const fittedTitleSize = (card: CardTokens, name: string, width: number) => {
  const units = Array.from(name).reduce((n, ch) => n + (WIDE.test(ch) ? 1.8 : 1), 0)
  return Math.floor(Math.min(titleSize(card, name), (width * 2 * 0.85) / (units * 0.55)))
}

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
  badge: Node | null = null,
  width?: number,
  period: string | null = null,
): Node => {
  const c = contentIn(profile, lang)
  const card = theme.card
  const font = fontsOf(theme)
  const name = clip(c.archetype.name, 56)
  const size = width === undefined ? titleSize(card, name) : fittedTitleSize(card, name, width)
  return h(
    "div",
    { display: "flex", flexDirection: "column", maxWidth: width ?? (showGraphic ? 700 : 1000) },
    [
      badge,
      h(
        "div",
        {
          fontFamily: font.title,
          fontWeight: 800,
          fontSize: size,
          maxHeight: size * card.title.lineHeight * 2,
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
      period === null
        ? null
        : h(
            "div",
            {
              fontSize: card.size.header,
              color: colors.muted,
              marginTop: card.headline.gap,
              flexShrink: 0,
            },
            period,
          ),
      hide.includes("traits")
        ? null
        : h(
            "div",
            { display: "flex", gap: card.chips.gap, flexWrap: "nowrap", marginTop: card.chips.top },
            signatureNames(profile, lang).map((chipName) =>
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
                clip(chipName, 32),
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
  extra: string | null = null,
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
        [hide.includes("stats") ? "" : cardSummary(p, lang, showUsage, exactDates).note, extra]
          .filter((x) => x)
          .join(" · "),
      ),
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

/** The role symbol as a round badge with what it stands for (the card's illustration). */
const roleBadge = (
  avatar: ReturnType<typeof avatarSvg>,
  lang: Language,
  colors: { readonly fg: string; readonly border: string },
): Node =>
  h("div", { display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }, [
    h(
      "div",
      {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 92,
        height: 92,
        borderRadius: 999,
        backgroundColor: AVATAR_PALETTE.paper,
        border: `3px solid ${AVATAR_PALETTE.ink}`,
        boxShadow: `6px 6px 0 ${AVATAR_PALETTE.warm}`,
        flexShrink: 0,
      },
      [{ type: "img", props: { src: svgDataUrl(avatar.svg), width: 74, height: 74 } }],
    ),
    h(
      "div",
      {
        display: "flex",
        fontSize: 17,
        fontWeight: 600,
        color: colors.fg,
        border: `1.5px solid ${colors.border}`,
        borderRadius: 999,
        padding: "5px 14px",
      },
      AVATAR_MESSAGES[lang].badge[avatar.kind],
    ),
  ])

/** Where the classic card's radar sits: the right half, between the header and the numbers. */
const CLASSIC_RADAR = { cx: 905, cy: 275, r: 120 } as const

/**
 * The classic card: the classic report's hero edge to edge, in its dark colors. The right half
 * is always the trait radar (`--card-hide graphic` leaves it out); the role symbol is a badge
 * above the name, and the traits live on the radar instead of chips.
 */
const classicTree = (
  profile: Profile,
  theme: Theme,
  hide: RenderOptions["cardHide"],
  lang: Language,
  showUsage: boolean,
  exactDates: boolean,
  avatar: ReturnType<typeof avatarSvg> | null,
): Node => {
  const k = schemeOf(theme)
  const showGraphic = !hide.includes("graphic")
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
        ? cardRadar(
            profile,
            lang,
            CLASSIC_RADAR,
            {
              line: k.border,
              fg: k.fg,
              muted: k.muted,
              value: k.accent,
              card: k.card,
            },
            !hide.includes("traits"),
          )
        : []),
      copyLayer(theme, [
        h("div", { display: "flex", flex: 1, alignItems: "center" }, [
          identityCopy(
            profile,
            theme,
            // the traits are on the radar; without it they stay chips
            showGraphic ? [...hide, "traits"] : hide,
            lang,
            showGraphic,
            { muted: k.muted, chip: { color: k.accent, backgroundColor: k.accentSoft } },
            avatar && showGraphic ? roleBadge(avatar, lang, { fg: k.fg, border: k.border }) : null,
            showGraphic ? 520 : undefined,
            hide.includes("stats") ? null : cardPeriod(profile, lang, exactDates),
          ),
        ]),
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
  avatar: ReturnType<typeof avatarSvg> | null,
): Node => {
  const id = theme.identity
  const card = theme.card
  const showGraphic = !hide.includes("graphic")
  const graphic = avatar ?? graphicSvg(id.graphic, profile.stats.hourHistogram, id)
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
        h("div", { display: "flex", justifyContent: "flex-end", fontSize: card.size.header }, [
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
  avatar: ReturnType<typeof avatarSvg> | null,
): Node => {
  const c = contentIn(p, lang)
  const k = schemeOf(theme)
  const card = theme.card
  const pad = card.padding.x
  const inner = CARD_WIDTH - 2 * pad
  const support = card.support
  const graphic = avatar ?? graphicSvg("bars", p.stats.hourHistogram, theme.identity)
  const traits = signatureNames(p, lang)
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
          justifyContent: "flex-end",
          fontSize: card.size.header,
          color: k.muted,
        },
        [
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
                    traits.map((name) =>
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
                        clip(name.replace(/\s+/g, " "), 48),
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
                      width: avatar ? 160 : card.graphic.width,
                      height: avatar ? 160 : 100,
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
  const tree = TREES[theme.card.composition](
    p,
    theme,
    hide,
    lang,
    v.usage,
    v.dates,
    avatarFor(profile, options.avatar),
  )
  const attribution = theme.card.attribution
  const muted = theme.card.composition === "identity" ? theme.identity.muted : schemeOf(theme).muted
  return {
    ...tree,
    props: {
      ...tree.props,
      children: [
        ...(Array.isArray(tree.props.children) ? tree.props.children : [tree.props.children]),
        h(
          "div",
          {
            position: "absolute",
            right: attribution.right,
            bottom: attribution.bottom,
            fontSize: attribution.size,
            color: muted,
          },
          CARD_MESSAGES[lang].attribution,
        ),
      ],
    },
  }
}

declare const __BUNDLED_WASM__: boolean

let wasmReady: Promise<void> | null = null
const ensureWasm = (): Promise<void> => {
  if (wasmReady === null) {
    const require = createRequire(import.meta.url)
    wasmReady = initWasm(
      readAsset("index_bg.wasm", () =>
        typeof __BUNDLED_WASM__ !== "undefined" && __BUNDLED_WASM__
          ? new URL("./index_bg.wasm", import.meta.url)
          : require.resolve("@resvg/resvg-wasm/index_bg.wasm"),
      ),
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
