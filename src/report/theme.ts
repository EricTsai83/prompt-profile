/**
 * Every style decision of a look, for the report (CSS custom properties and `data-*` layout
 * choices, see `themeCss` in theme-css.ts) and the card (numbers satori can read). The report
 * and the card read the same theme, so they stay related by construction.
 *
 * Values (colors, fonts, sizes, radii, spacing) are tokens; structural choices are short closed
 * unions (`LayoutChoices`, `CardComposition`). Component CSS reads tokens and keys variants on
 * the `data-*` attributes, never on a look id.
 *
 * To add a look: add its id to `LOOK_IDS` (looks.ts), add a theme entry to `THEMES` reusing
 * existing variants, then run `scripts/template-gallery.ts`, `scripts/template-qa.mjs` (layout,
 * computed styles, axe-core and motion checks) and `scripts/card-qa.ts`. Adding a variant is a
 * code change in the CSS and card trees. Colors must pass WCAG AA contrast
 * (`test/report/contrast.test.ts`).
 */
import type { LookId } from "./looks.ts"

/** The activity graphic drawn from the 24-hour histogram. */
export type GraphicKind = "bars" | "orbit" | "fold"

/** Report colors (CSS custom properties of the base stylesheet). */
export interface ReportTokens {
  readonly bg: string
  readonly fg: string
  readonly muted: string
  readonly card: string
  readonly border: string
  readonly accent: string
  readonly accentSoft: string
  readonly warn: string
  readonly empty: string
}

/** Report colors plus the details components used to hard-code. */
export interface ColorTokens extends ReportTokens {
  /** Text on an accent background (the selected language button). */
  readonly onAccent: string
  /** A change for the better. */
  readonly positive: string
  /** Tooltip shadow. */
  readonly shadow: string
  /** Categorical colors for up to six projects, then "other". */
  readonly projects: readonly [string, string, string, string, string, string]
  readonly projectOther: string
}

/** The colors a printed report uses, whatever the screen scheme. */
export type PrintTokens = Pick<
  ReportTokens,
  "bg" | "card" | "fg" | "muted" | "border" | "accent" | "accentSoft"
>

/** The identity surface shared by the card and the report's first section. */
export interface Identity {
  readonly background: string
  /** A solid block on the right third (Studio), or none. */
  readonly split: string | null
  readonly text: string
  readonly muted: string
  readonly chipBorder: string
  readonly chipBackground: string
  readonly graphic: GraphicKind
  readonly graphicColor: string
  /** Second graphic color (the lines inside Studio's fold). */
  readonly graphicDetail: string
  /** The faint rings behind the orbit graphic. */
  readonly graphicRing: string
}

/** An embedded display face (shipped in fonts/, also loaded by the card). */
export interface DisplayFace {
  readonly family: string
  /** CSS stack, the face first. */
  readonly stack: string
  readonly weight: 400 | 700 | 800
}

export interface TypeTokens {
  /** CSS font stack of the report body. */
  readonly body: string
  /** Face of h1, section titles and signature numbers; null keeps the body face. */
  readonly display: DisplayFace | null
  /** The hero title. */
  readonly title: {
    readonly family: string
    readonly weight: number
    readonly size: string
    readonly tracking: string
    readonly measure: string
  }
  /** Long-form prose of the reading layout (portrait introduction). */
  readonly prose: { readonly family: string; readonly introSize: string }
  /**
   * Text sizes of the report's screen styles, `--text-<step>`, smallest first: chart axes and
   * eyebrow labels (`2xs`), notes, legends and badges (`xs`), secondary text, tables and
   * controls (`sm`), card body (`md`), body (`base`), card titles (`lg`), section titles (`xl`),
   * view titles and signature numbers (`2xl`). The hero title has its own `title.size`.
   */
  readonly scale: Readonly<
    Record<"2xs" | "xs" | "sm" | "md" | "base" | "lg" | "xl" | "2xl", string>
  >
  /** Card font families (satori names); each must be an embedded font (fonts.ts). */
  readonly card: { readonly body: string; readonly display: string }
}

export interface ShapeTokens {
  /** The hero's border, its top and bottom edges (CSS border values) and corner radius. */
  readonly hero: {
    readonly border: string
    readonly top: string
    readonly bottom: string
    readonly radius: string
  }
  /** Rule under the top bar (a CSS border value). */
  readonly topbar: string
  /**
   * Corner radii of surfaces, largest first: cards (`xl`), grouped lists and the view switch
   * (`lg`), list items (`md`), controls (`sm`) and tooltips (`xs`). Pills, circles and chart
   * marks keep fixed shapes.
   */
  readonly radius: Readonly<Record<"xs" | "sm" | "md" | "lg" | "xl", string>>
}

/** Hover, focus and view transitions; `prefers-reduced-motion` turns them all off. */
export interface MotionTokens {
  /** Color, border and opacity changes on hover and focus. */
  readonly fast: string
  /** Content appearing: tooltips and a newly selected view. */
  readonly base: string
  /** Ease-out curve: quick start, gentle stop. */
  readonly easing: string
}

export interface SpaceTokens {
  /** Page max width. */
  readonly page: string
  /** Spacing scale: `--space-<step>`. */
  readonly scale: Readonly<Record<1 | 2 | 3 | 4 | 6 | 8 | 12, string>>
  /** Reading measure of prose and notes. */
  readonly reading: string
  readonly gutter: string
  /** Column width of the reading layout's portrait story and ledger signatures. */
  readonly column: string
  /** Top padding of an open panel. */
  readonly panelTop: string
  /** Grid columns of the overview charts (wide screens). */
  readonly overview: string
}

/** Structural choices; component CSS keys them on `<html data-…>`. */
export interface LayoutChoices {
  /** `showcase`: identity hero first; `document`: quiet product document. */
  readonly composition: "showcase" | "document"
  readonly hero: "clock" | "identity" | "panel" | "split" | "editorial"
  readonly signatures: "none" | "columns" | "stacked" | "ledger"
  /** `reading`: the identity view's portrait story uses the column width and the prose font. */
  readonly storyWidth: "full" | "reading"
}

export type CardComposition = "classic" | "identity" | "product"

/** Card layout in pixels: satori reads no CSS variables, `clamp()` or selectors. */
export interface CardTokens {
  readonly composition: CardComposition
  /** Which color tokens a classic or product card uses (identity cards use `identity`). */
  readonly scheme: "light" | "dark"
  /** Font of the archetype name. */
  readonly titleFont: "body" | "display"
  readonly padding: { readonly y: number; readonly x: number }
  /** Accent rule along the top edge; 0 for none. */
  readonly accentRule: number
  readonly size: {
    /** The project name; the header line of identity and product cards. */
    readonly brand: number
    readonly header: number
    /** Archetype name: short, medium and long names. */
    readonly title: readonly [number, number, number]
    readonly headline: number
    readonly chip: number
    readonly metric: number
    readonly label: number
    readonly footer: number
  }
  readonly title: { readonly lineHeight: number; readonly tracking: number }
  readonly headline: { readonly lineHeight: number; readonly gap: number }
  readonly chips: {
    readonly gap: number
    readonly top: number
    readonly padding: string
    readonly border: number
  }
  readonly metrics: { readonly count: number; readonly gap: number }
  /** Where the activity graphic sits (identity cards), from the right and top edges. */
  readonly graphic: { readonly right: number; readonly top: number; readonly width: number }
  /** The product card's activity column. */
  readonly support: {
    readonly align: "center" | "end"
    readonly padding: number
    readonly surface: "bg" | "card"
  }
}

export interface Theme {
  readonly id: LookId
  /** Bumped when the look's rendered design changes (recorded in `render.json`). */
  readonly version: number
  readonly color: {
    readonly light: ColorTokens
    readonly dark: ColorTokens
    readonly print: PrintTokens
  }
  readonly identity: Identity
  readonly type: TypeTokens
  readonly shape: ShapeTokens
  readonly motion: MotionTokens
  readonly space: SpaceTokens
  readonly layout: LayoutChoices
  readonly card: CardTokens
}

// ---- shared values ------------------------------------------------------------------------

const BODY_STACK = `-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`
const SERIF_STACK = `Georgia,"Songti TC",serif`
const BRICOLAGE: DisplayFace = {
  family: "Bricolage",
  stack: `Bricolage,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC",sans-serif`,
  weight: 800,
}
const CARD_FONTS = { body: "Inter", display: "Bricolage" } as const

const PROJECTS = ["#4f7cff", "#f2994a", "#27ae60", "#eb5757", "#9b51e0", "#2bb3c0"] as const

/** Details shared by every look's light and dark colors. */
const LIGHT_DETAILS = {
  onAccent: "#fff",
  positive: "#187c43",
  shadow: "rgba(0,0,0,.18)",
  projects: PROJECTS,
  projectOther: "#d3d6dc",
}
const DARK_DETAILS = {
  ...LIGHT_DETAILS,
  onAccent: "#0b0d12",
  positive: "#35a766",
  projectOther: "#454952",
}

const PRINT: PrintTokens = {
  bg: "#fff",
  card: "#fff",
  fg: "#17212b",
  muted: "#46515b",
  border: "#bdc5cc",
  accent: "#304d6a",
  accentSoft: "#e6ebef",
}

const SPACE: SpaceTokens = {
  page: "1080px",
  scale: { 1: "4px", 2: "8px", 3: "12px", 4: "16px", 6: "24px", 8: "32px", 12: "48px" },
  reading: "65ch",
  gutter: "clamp(20px,4vw,48px)",
  column: "740px",
  panelTop: "24px",
  overview: "minmax(0,1.35fr) minmax(0,1fr)",
}

const SHOWCASE_TITLE = { size: "clamp(32px,5.6vw,58px)", tracking: "-.02em", measure: "none" }
const DOCUMENT_TITLE = {
  family: "Inter,system-ui,sans-serif",
  weight: 800,
  size: "clamp(28px,4vw,44px)",
  tracking: "-.045em",
  measure: "850px",
}
const BODY_PROSE = { family: BODY_STACK, introSize: "20px" }
/** One text scale for every look: looks differ in faces and the hero, not in reading sizes. */
const TYPE_SCALE: TypeTokens["scale"] = {
  "2xs": "11px",
  xs: "12px",
  sm: "13px",
  md: "14px",
  base: "15px",
  lg: "17px",
  xl: "20px",
  "2xl": "26px",
}

/** Type of the share-first looks: Bricolage for titles and numbers. */
const SHOWCASE_TYPE: TypeTokens = {
  body: BODY_STACK,
  display: BRICOLAGE,
  title: { family: BRICOLAGE.stack, weight: BRICOLAGE.weight, ...SHOWCASE_TITLE },
  prose: BODY_PROSE,
  scale: TYPE_SCALE,
  card: CARD_FONTS,
}
const DOCUMENT_TYPE: TypeTokens = { ...SHOWCASE_TYPE, title: DOCUMENT_TITLE }

const BORDER = "1px solid var(--border)"
const RADII: ShapeTokens["radius"] = { xs: "8px", sm: "10px", md: "12px", lg: "14px", xl: "18px" }
const MOTION: MotionTokens = { fast: "150ms", base: "200ms", easing: "cubic-bezier(.2,0,0,1)" }
const IDENTITY_SHAPE: ShapeTokens = {
  hero: { border: "0", top: "0", bottom: "0", radius: "24px" },
  topbar: "none",
  radius: RADII,
}
const PANEL_SHAPE: ShapeTokens = {
  hero: { border: BORDER, top: BORDER, bottom: BORDER, radius: "12px" },
  topbar: "none",
  radius: RADII,
}

const SHOWCASE_LAYOUT: LayoutChoices = {
  composition: "showcase",
  hero: "identity",
  signatures: "none",
  storyWidth: "full",
}

const TITLE_STEPS = [96, 72, 58] as const
const IDENTITY_CARD: CardTokens = {
  composition: "identity",
  scheme: "light",
  titleFont: "display",
  padding: { y: 52, x: 60 },
  accentRule: 0,
  size: {
    brand: 24,
    header: 18,
    title: TITLE_STEPS,
    headline: 24,
    chip: 18,
    metric: 40,
    label: 16,
    footer: 18,
  },
  title: { lineHeight: 0.98, tracking: -2 },
  headline: { lineHeight: 1.4, gap: 20 },
  chips: { gap: 10, top: 20, padding: "6px 16px", border: 1.5 },
  metrics: { count: 2, gap: 44 },
  graphic: { right: 56, top: 168, width: 340 },
  support: { align: "center", padding: 0, surface: "bg" },
}
const PRODUCT_CARD: CardTokens = {
  composition: "product",
  scheme: "light",
  titleFont: "body",
  padding: { y: 48, x: 48 },
  accentRule: 8,
  size: {
    brand: 18,
    header: 18,
    title: [48, 48, 48],
    headline: 23,
    chip: 18,
    metric: 28,
    label: 18,
    footer: 15,
  },
  title: { lineHeight: 1.12, tracking: -1.5 },
  headline: { lineHeight: 1.5, gap: 18 },
  chips: { gap: 12, top: 28, padding: "10px 0 0", border: 1 },
  metrics: { count: 2, gap: 14 },
  graphic: { right: 0, top: 0, width: 260 },
  support: { align: "center", padding: 0, surface: "bg" },
}

/** Colors of a product look: an identity surface that follows its light tokens. */
const productIdentity = (light: ReportTokens): Identity => ({
  background: light.bg,
  split: null,
  text: light.fg,
  muted: light.muted,
  chipBorder: light.border,
  chipBackground: light.card,
  graphic: "bars",
  graphicColor: light.accent,
  graphicDetail: light.accent,
  graphicRing: light.border,
})

/** Light colors of the product looks; their identity surface follows them. */
const productLight = (
  bg: string,
  fg: string,
  accent: string,
  accentSoft: string,
): ReportTokens => ({
  bg,
  fg,
  muted: "#626d78",
  card: "#ffffff",
  border: "#dfe3e7",
  accent,
  accentSoft,
  warn: "#8a5300",
  empty: "#edf0f2",
})
const PRISM_LIGHT = productLight("#f8fafc", "#172338", "#5062d2", "#edf0ff")
const SLATE_LIGHT = productLight("#f4f5f6", "#20272c", "#32746f", "#e6f1ef")
const FOLIO_LIGHT = productLight("#faf9f5", "#302e2a", "#8f5b39", "#f1e8dd")

/** The dark colors the three product looks share (only the background differs). */
const productDark = (bg: string): ColorTokens => ({
  bg,
  fg: "#edf0f3",
  muted: "#aab5be",
  card: "#242c32",
  border: "#3c464f",
  accent: "#b3c7e8",
  accentSoft: "#354250",
  warn: "#ffd98a",
  empty: "#303942",
  ...DARK_DETAILS,
})

// ---- the themes ---------------------------------------------------------------------------

const CLASSIC: Theme = {
  id: "classic",
  version: 11,
  color: {
    light: {
      bg: "#f6f6f3",
      fg: "#1d1d1f",
      muted: "#6b6b70",
      card: "#ffffff",
      border: "#e6e6e1",
      accent: "#5b5bd6",
      accentSoft: "#ececfb",
      warn: "#9a5800",
      empty: "#ececea",
      ...LIGHT_DETAILS,
    },
    dark: {
      bg: "#121214",
      fg: "#ececee",
      muted: "#9a9aa2",
      card: "#1c1c20",
      border: "#2c2c33",
      accent: "#9d9dff",
      accentSoft: "#25254a",
      warn: "#f0b35a",
      empty: "#26262c",
      ...DARK_DETAILS,
    },
    print: PRINT,
  },
  // Today's colors on a card, with the hour clock.
  identity: {
    background: "var(--card)",
    split: null,
    text: "var(--fg)",
    muted: "var(--muted)",
    chipBorder: "var(--border)",
    chipBackground: "transparent",
    graphic: "bars",
    graphicColor: "#5b5bd6",
    graphicDetail: "#5b5bd6",
    graphicRing: "#5b5bd6",
  },
  type: {
    body: BODY_STACK,
    display: null,
    title: { family: BODY_STACK, weight: 700, ...SHOWCASE_TITLE },
    prose: BODY_PROSE,
    scale: TYPE_SCALE,
    card: CARD_FONTS,
  },
  shape: {
    hero: { border: BORDER, top: BORDER, bottom: BORDER, radius: "24px" },
    topbar: "none",
    radius: RADII,
  },
  motion: MOTION,
  space: SPACE,
  layout: { ...SHOWCASE_LAYOUT, hero: "clock" },
  card: {
    ...IDENTITY_CARD,
    composition: "classic",
    scheme: "dark",
    size: { ...IDENTITY_CARD.size, brand: 20, metric: 36 },
    headline: { lineHeight: 1.4, gap: 18 },
    chips: { ...IDENTITY_CARD.chips, border: 0 },
    metrics: { count: 3, gap: 44 },
    // The hour clock: its size, and its distance from the right edge.
    graphic: { right: 60, top: 0, width: 300 },
  },
}

/** Every look, `classic` (the default) first; the share-first looks are from plan 11. */
export const THEMES: ReadonlyArray<Theme> = [
  CLASSIC,
  {
    id: "signal",
    version: 17,
    color: {
      light: {
        bg: "#f5f7ff",
        fg: "#14204c",
        muted: "#5d6888",
        card: "#ffffff",
        border: "#dce2f1",
        accent: "#3155f5",
        accentSoft: "#e6ebff",
        warn: "#8a5300",
        empty: "#e8ecf8",
        ...LIGHT_DETAILS,
      },
      dark: {
        bg: "#0c1330",
        fg: "#eef1ff",
        muted: "#a5afd3",
        card: "#141d42",
        border: "#2a3566",
        accent: "#9fb2ff",
        accentSoft: "#1f2b63",
        warn: "#ffd98a",
        empty: "#1a2350",
        ...DARK_DETAILS,
      },
      print: PRINT,
    },
    identity: {
      background: "#3155f5",
      split: null,
      text: "#ffffff",
      muted: "#e3e8ff",
      chipBorder: "rgba(255,255,255,0.4)",
      chipBackground: "rgba(255,255,255,0)",
      graphic: "bars",
      graphicColor: "#e0f59a",
      graphicDetail: "#e0f59a",
      graphicRing: "#e0f59a",
    },
    type: SHOWCASE_TYPE,
    shape: IDENTITY_SHAPE,
    motion: MOTION,
    space: SPACE,
    layout: SHOWCASE_LAYOUT,
    card: IDENTITY_CARD,
  },
  {
    id: "afterhours",
    version: 17,
    color: {
      light: {
        bg: "#eef3f8",
        fg: "#10243a",
        muted: "#55697b",
        card: "#ffffff",
        border: "#d3dfe8",
        accent: "#476992",
        accentSoft: "#e1eaf3",
        warn: "#8a5300",
        empty: "#e3ebf2",
        ...LIGHT_DETAILS,
      },
      dark: {
        bg: "#08131f",
        fg: "#eaf4fb",
        muted: "#9fb6c7",
        card: "#0f2133",
        border: "#21384d",
        accent: "#bcebff",
        accentSoft: "#173049",
        warn: "#ffd98a",
        empty: "#132a3f",
        ...DARK_DETAILS,
      },
      print: PRINT,
    },
    identity: {
      background: "#10243a",
      split: null,
      text: "#eaf4fb",
      muted: "#c7dce9",
      chipBorder: "rgba(140,168,188,0.45)",
      chipBackground: "rgba(255,255,255,0)",
      graphic: "orbit",
      graphicColor: "#b9b3ff",
      graphicDetail: "#bcebff",
      graphicRing: "#8ca8bc",
    },
    type: SHOWCASE_TYPE,
    shape: IDENTITY_SHAPE,
    motion: MOTION,
    space: SPACE,
    layout: SHOWCASE_LAYOUT,
    card: { ...IDENTITY_CARD, graphic: { right: 56, top: 110, width: 370 } },
  },
  {
    id: "studio",
    version: 17,
    color: {
      light: {
        bg: "#fff7f4",
        fg: "#252323",
        muted: "#6f5d58",
        card: "#ffffff",
        border: "#ecded9",
        accent: "#bf3b25",
        accentSoft: "#ffe9e4",
        warn: "#8a5300",
        empty: "#f6e9e5",
        ...LIGHT_DETAILS,
      },
      dark: {
        bg: "#1c1716",
        fg: "#fbefec",
        muted: "#c3aaa4",
        card: "#272020",
        border: "#3d3230",
        accent: "#ff8c76",
        accentSoft: "#3d2622",
        warn: "#ffd98a",
        empty: "#30292a",
        ...DARK_DETAILS,
      },
      print: PRINT,
    },
    identity: {
      background: "#ffffff",
      split: "#ff654b",
      text: "#252323",
      muted: "#4a4341",
      chipBorder: "#ecb0b8",
      chipBackground: "#fff0ed",
      graphic: "fold",
      graphicColor: "#ffd5dd",
      graphicDetail: "#ff654b",
      graphicRing: "#ff654b",
    },
    type: SHOWCASE_TYPE,
    shape: IDENTITY_SHAPE,
    motion: MOTION,
    space: SPACE,
    layout: SHOWCASE_LAYOUT,
    card: { ...IDENTITY_CARD, graphic: { right: 70, top: 190, width: 290 } },
  },
  {
    id: "prism",
    version: 17,
    color: {
      light: { ...PRISM_LIGHT, ...LIGHT_DETAILS },
      dark: productDark("#101827"),
      print: PRINT,
    },
    identity: productIdentity(PRISM_LIGHT),
    type: DOCUMENT_TYPE,
    shape: {
      ...PANEL_SHAPE,
      hero: { ...PANEL_SHAPE.hero, top: "3px solid var(--accent)" },
    },
    motion: MOTION,
    space: { ...SPACE, page: "1160px" },
    layout: { composition: "document", hero: "panel", signatures: "columns", storyWidth: "full" },
    card: PRODUCT_CARD,
  },
  {
    id: "slate",
    version: 17,
    color: {
      light: { ...SLATE_LIGHT, ...LIGHT_DETAILS },
      dark: productDark("#141b20"),
      print: PRINT,
    },
    identity: productIdentity(SLATE_LIGHT),
    type: DOCUMENT_TYPE,
    shape: { ...PANEL_SHAPE, topbar: BORDER },
    motion: MOTION,
    space: { ...SPACE, page: "1240px", panelTop: "16px" },
    layout: { composition: "document", hero: "split", signatures: "stacked", storyWidth: "full" },
    card: { ...PRODUCT_CARD, support: { align: "center", padding: 20, surface: "card" } },
  },
  {
    id: "folio",
    version: 17,
    color: {
      light: { ...FOLIO_LIGHT, ...LIGHT_DETAILS },
      dark: productDark("#201f1c"),
      print: PRINT,
    },
    identity: productIdentity(FOLIO_LIGHT),
    type: {
      ...DOCUMENT_TYPE,
      title: {
        family: SERIF_STACK,
        weight: 400,
        size: "clamp(36px,5vw,58px)",
        tracking: "-.035em",
        measure: "850px",
      },
      prose: { family: SERIF_STACK, introSize: "24px" },
    },
    shape: {
      hero: { border: "0", top: "0", bottom: BORDER, radius: "0" },
      topbar: "none",
      radius: RADII,
    },
    motion: MOTION,
    space: { ...SPACE, page: "960px", overview: "minmax(0,1fr) minmax(0,1.3fr)" },
    layout: {
      composition: "document",
      hero: "editorial",
      signatures: "ledger",
      storyWidth: "reading",
    },
    card: {
      ...PRODUCT_CARD,
      titleFont: "display",
      support: { align: "end", padding: 0, surface: "bg" },
    },
  },
]

/** A look's theme. */
export const lookOf = (id: LookId): Theme => THEMES.find((t) => t.id === id) ?? CLASSIC
