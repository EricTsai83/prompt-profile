import { fontDataUrl } from "./fonts.ts"
import type { ColorTokens, PrintTokens, Theme } from "./theme.ts"

const colors = (t: ColorTokens) =>
  `${printColors(t)};--warn:${t.warn};--empty:${t.empty};${t.projects.map((c, i) => `--p${i}:${c}`).join(";")};--po:${t.projectOther};--on-accent:${t.onAccent};--positive:${t.positive};--shadow:${t.shadow}`

const printColors = (t: PrintTokens) =>
  `--bg:${t.bg};--fg:${t.fg};--muted:${t.muted};--card:${t.card};--border:${t.border};--accent:${t.accent};--accent-soft:${t.accentSoft}`

/** Type, shape, motion and space tokens; the same in every color scheme. */
const metrics = ({ type, shape, motion, space }: Theme) =>
  [
    `--font-body:${type.body}`,
    `--title-font:${type.title.family}`,
    `--title-weight:${type.title.weight}`,
    `--title-size:${type.title.size}`,
    `--title-tracking:${type.title.tracking}`,
    `--title-measure:${type.title.measure}`,
    `--prose-font:${type.prose.family}`,
    `--prose-intro:${type.prose.introSize}`,
    ...(type.display === null
      ? []
      : [`--font-display:${type.display.stack}`, `--display-weight:${type.display.weight}`]),
    `--hero-border:${shape.hero.border}`,
    `--hero-top:${shape.hero.top}`,
    `--hero-bottom:${shape.hero.bottom}`,
    `--hero-radius:${shape.hero.radius}`,
    `--topbar-rule:${shape.topbar}`,
    ...Object.entries(shape.radius).map(([step, value]) => `--radius-${step}:${value}`),
    `--motion-fast:${motion.fast}`,
    `--motion-base:${motion.base}`,
    `--ease-out:${motion.easing}`,
    `--page:${space.page}`,
    ...Object.entries(space.scale).map(([step, value]) => `--space-${step}:${value}`),
    `--reading:${space.reading}`,
    `--gutter:${space.gutter}`,
    `--column:${space.column}`,
    `--panel-top:${space.panelTop}`,
    `--overview-columns:${space.overview}`,
  ].join(";")

/**
 * The generated theme block: the display face, every token as a custom property (light, dark
 * and print colors) and the hero's identity surface. The only place a stylesheet holds raw
 * color values; it comes first, so component rules only read variables.
 */
export const themeCss = (theme: Theme): string => {
  const { color, identity: id, type } = theme
  const face =
    type.display === null
      ? ""
      : `@font-face{font-family:${type.display.family};src:url(${fontDataUrl(type.display.family, type.display.weight)}) format("woff");font-weight:${type.display.weight}}\n`
  return `${face}:root{color-scheme:light dark;${colors(color.light)};${metrics(theme)}}
@media (prefers-color-scheme:dark){:root{${colors(color.dark)}}}
@media print{html:root{${printColors(color.print)};color-scheme:light}}
.hero{--id-bg:${id.background};--id-fg:${id.text};--id-muted:${id.muted};--id-split:${id.split ?? "transparent"}}
`
}

/** Titles, section headings and signature numbers in the display face, when there is one. */
export const displayStyle = (theme: Theme): string =>
  theme.type.display === null
    ? ""
    : "h1,section>h2,.sig b{font-family:var(--font-display);font-weight:var(--display-weight)}"

/** `<html>` attributes: the look (compatibility and debugging only) and its layout choices. */
export const themeAttributes = ({ id, layout }: Theme): string =>
  `data-look="${id}" data-composition="${layout.composition}" data-hero="${layout.hero}" data-signatures="${layout.signatures}" data-detail-width="${layout.detailWidth}"`
