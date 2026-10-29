/**
 * Render-only choices: a look (report + card design), the card parts to hide and the report
 * parts to leave out. They never change the profile, the analysis or its cache; see
 * plans 12 and 18 (deleted when done; in git history).
 */

export const LOOK_IDS = [
  "classic",
  "signal",
  "afterhours",
  "studio",
  "prism",
  "slate",
  "folio",
] as const
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

/** The published product templates (public examples and QA scripts). */
export const PRODUCT_LOOK_IDS = ["prism", "slate", "folio"] as const
