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
    ...Object.entries(type.scale).map(([step, value]) => `--text-${step}:${value}`),
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
  `data-look="${id}" data-composition="${layout.composition}" data-hero="${layout.hero}" data-signatures="${layout.signatures}" data-story-width="${layout.storyWidth}"`

/** Operational facts use rows so long model names do not become narrow columns. */
export const generationStyle = `
.generation-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-4);margin:var(--space-6) 0}
.generation-summary>div{padding:var(--space-3);border:1px solid var(--border);border-radius:var(--radius-sm)}
.generation-summary dt{font-size:var(--text-sm);color:var(--muted)}
.generation-summary dd{margin:var(--space-2) 0 0;font-size:var(--text-lg);font-weight:700;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.generation-summary dd.note{font-size:var(--text-sm);font-weight:400}
.generation-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-6)}
.generation-bars,.generation-cost-chart{list-style:none;margin:var(--space-3) 0;padding:0}
.generation-bars li,.generation-cost-chart li{margin:var(--space-3) 0;break-inside:avoid}
.generation-bar-label{display:flex;justify-content:space-between;gap:var(--space-2);font-size:var(--text-sm)}
.generation-bar-label b{font-variant-numeric:tabular-nums;white-space:nowrap}
.generation-track{display:flex;height:var(--space-2);margin:var(--space-2) 0;background:var(--border);overflow:hidden;border-radius:999px}
.generation-bar{display:block;background:var(--accent)}
.generation-estimated{opacity:.55}
.generation-charts small{display:block;color:var(--muted)}
.generation-details{border-top:1px solid var(--border);padding-top:var(--space-3);margin-top:var(--space-4)}
.generation-details summary{cursor:pointer;font-weight:700}
.generation-facts{margin:var(--space-4) 0}
.generation-facts>div{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:var(--space-4);padding:var(--space-2) 0;border-bottom:1px solid var(--border);break-inside:avoid}
.generation-facts dt{color:var(--muted);font-size:var(--text-sm)}
.generation-facts dd{margin:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
.generation-facts dd p{margin:0 0 var(--space-1)}
@media(max-width:600px){.generation-summary,.generation-charts{grid-template-columns:minmax(0,1fr)}.generation-facts>div{grid-template-columns:minmax(0,1fr);gap:var(--space-1)}}
@media print{.generation-details>dl{display:block!important}.generation-charts{grid-template-columns:minmax(0,1fr)}}
`
