/**
 * Render-only choices: a look (report + card design), the card parts to hide and the report
 * parts to leave out. They never change the profile, the analysis or its cache; see
 * plans 12 and 18 (deleted when done; in git history).
 */

export const LOOK_IDS = ["classic", "signal", "afterhours", "studio"] as const
export type LookId = (typeof LOOK_IDS)[number]

/** Card parts a user may leave out of the card (`--card-hide`). */
export const CARD_PARTS = ["traits", "stats", "graphic"] as const
export type CardPart = (typeof CARD_PARTS)[number]

/**
 * Report parts a user may leave out (`--exclude`), in display order. An extensible data list;
 * `personal` (see EXCLUDE_GROUPS) is all of them.
 */
export const REPORT_PARTS = [
  "quotes",
  "projects",
  "dates",
  "coaching",
  "funfacts",
  "custom-names",
] as const
export type ReportPart = (typeof REPORT_PARTS)[number]

/** Shorthands accepted by `--exclude`. */
export const EXCLUDE_GROUPS: Readonly<Record<string, ReadonlyArray<ReportPart>>> = {
  personal: REPORT_PARTS,
}

export interface RenderOptions {
  readonly look: LookId
  readonly cardHide: ReadonlyArray<CardPart>
  /** Report parts left out; none when absent. */
  readonly exclude?: ReadonlyArray<ReportPart>
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = { look: "classic", cardHide: [], exclude: [] }

/** Version of the companion `render.json` written next to a non-default render. */
export const RENDER_MANIFEST_VERSION = 2

/** Excluded parts in REPORT_PARTS order, without duplicates. */
export const excludedParts = (o: RenderOptions): Array<ReportPart> =>
  REPORT_PARTS.filter((p) => o.exclude?.includes(p) ?? false)

export const isDefaultRender = (o: RenderOptions): boolean =>
  o.look === DEFAULT_RENDER_OPTIONS.look && o.cardHide.length === 0 && excludedParts(o).length === 0

/** Hidden parts in CARD_PARTS order, without duplicates. */
export const hiddenParts = (o: RenderOptions): Array<CardPart> =>
  CARD_PARTS.filter((p) => o.cardHide.includes(p))

/**
 * Folder name of a variant: `signal`, `studio-no-stats-graphic`, `classic-without-quotes-dates`,
 * `classic-without-personal` (every part).
 */
export const variantName = (o: RenderOptions): string => {
  const excluded = excludedParts(o)
  const named = excluded.length === REPORT_PARTS.length ? ["personal"] : excluded
  return [
    o.look,
    ...hiddenParts(o).map((p, i) => (i === 0 ? `no-${p}` : p)),
    ...named.map((p, i) => (i === 0 ? `without-${p}` : p)),
  ].join("-")
}

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
}

export interface Look {
  readonly id: Exclude<LookId, "classic">
  readonly version: number
  readonly light: ReportTokens
  readonly dark: ReportTokens
  readonly identity: Identity
}

/** The share-first looks from plan 11. `classic` is today's report and card, unchanged. */
export const LOOKS: ReadonlyArray<Look> = [
  {
    id: "signal",
    version: 3,
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
    },
    identity: {
      background: "#3155f5",
      split: null,
      text: "#ffffff",
      muted: "#dfe5ff",
      chipBorder: "rgba(255,255,255,0.4)",
      chipBackground: "rgba(255,255,255,0)",
      graphic: "bars",
      graphicColor: "#e0f59a",
      graphicDetail: "#e0f59a",
    },
  },
  {
    id: "afterhours",
    version: 3,
    light: {
      bg: "#eef3f8",
      fg: "#10243a",
      muted: "#55697b",
      card: "#ffffff",
      border: "#d3dfe8",
      accent: "#496c97",
      accentSoft: "#e1eaf3",
      warn: "#8a5300",
      empty: "#e3ebf2",
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
    },
  },
  {
    id: "studio",
    version: 3,
    light: {
      bg: "#fff7f4",
      fg: "#252323",
      muted: "#6f5d58",
      card: "#ffffff",
      border: "#ecded9",
      accent: "#c73d27",
      accentSoft: "#ffe9e4",
      warn: "#8a5300",
      empty: "#f6e9e5",
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
    },
  },
]

/** The look's data, or null for `classic`. */
export const lookOf = (id: LookId): Look | null => LOOKS.find((l) => l.id === id) ?? null

/** Colors of the classic report (no look); the classic card uses the dark ones. */
export const CLASSIC_TOKENS: { readonly light: ReportTokens; readonly dark: ReportTokens } = {
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
  },
}
