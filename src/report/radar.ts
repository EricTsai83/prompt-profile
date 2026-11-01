import { makeVerbatim, quotes } from "./traits.ts"
import { MIN_PROJECT_CONVERSATIONS, type Profile } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { RADAR_MESSAGES, ABILITY_MESSAGES } from "./messages.ts"
import type { Scrub, Visibility } from "./visibility.ts"

/** Label font size on the large radar (`.radar-label`), and the room a label needs beside it. */
const LABEL_FONT = 12
const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60]/u

/** Side margin for the longest label (CJK glyphs about 1em, others about 0.6em), at least 80. */
const labelRoom = (labels: ReadonlyArray<string>): number =>
  Math.max(
    80,
    Math.ceil(
      Math.max(
        ...labels.map((t) =>
          Array.from(t).reduce((w, ch) => w + (WIDE.test(ch) ? 1 : 0.6) * LABEL_FONT, 0),
        ),
      ) + 18,
    ),
  )

/** Fewest measured traits a radar needs; fewer stay in the trait list only. */
export const MIN_RADAR_TRAITS = 3
/** Most project radars shown, busiest first. */
export const MAX_PROJECT_RADARS = 3

/** The grid, the shape and its points; axis labels only on the large radar. */
const radarSvg = (
  values: ReadonlyArray<number | null>,
  label: (i: number, attrs: string) => Raw | null,
  title: (i: number) => string,
  size: { readonly r: number; readonly padX: number; readonly padY: number },
): Raw => {
  const { r, padX, padY } = size
  const n = values.length
  // labels sit beside the shape: wide side margins, short top and bottom ones
  const width = 2 * (r + padX)
  const height = 2 * (r + padY)
  const cx = r + padX
  const cy = r + padY
  const at = (i: number, value: number, radius = r) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [
      cx + Math.cos(angle) * radius * (value / 100),
      cy + Math.sin(angle) * radius * (value / 100),
    ] as const
  }
  const shape = (vs: ReadonlyArray<number>) => vs.map((v, i) => at(i, v).join(",")).join(" ")
  return html`<svg viewBox="0 0 ${width} ${height}" width="${width}" role="img">
    ${[25, 50, 75, 100].map((g) => html`<polygon class="radar-grid" points="${shape(Array(n).fill(g))}" />`)}
    ${values.map((_, i) => {
      const [x, y] = at(i, 100)
      return html`<line class="radar-grid" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" />`
    })}
    ${values.every((v) => v !== null) ? html`<polygon class="radar-shape" points="${shape(values.map((v) => v ?? 0))}" />` : ""}
    ${values.map((v, i) => {
      if (v === null) return ""
      const [x, y] = at(i, v)
      return html`<circle class="radar-point" cx="${x}" cy="${y}" r="4.5"><title>${title(i)}</title></circle>`
    })}
    ${values.map((_, i) => {
      const [x, y] = at(i, 100, r + 14)
      const anchor = Math.abs(x - cx) < 4 ? "middle" : x > cx ? "start" : "end"
      return label(i, `class="radar-label" x="${x}" y="${y + 4}" text-anchor="${anchor}"`) ?? ""
    })}
  </svg>`
}

/** Six ability scores; missing scores have labeled spokes but no point or filled shape. */
export const traitRadar = (p: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw | null => {
  const traits = p.abilities
  if (traits.length === 0) return null
  const name = (i: number) => (l: Parameters<Scrub>[1]) =>
    scrub(ABILITY_MESSAGES[l][traits[i]!.key], l)
  const overall = traits.map((t) => t.score)
  const projects = v.projects
    ? [...new Map(traits.flatMap((t) => t.byProject).map((pr) => [pr.project, pr])).values()]
        .filter((pr) => pr.analysedSessions >= MIN_PROJECT_CONVERSATIONS)
        .toSorted((a, b) => b.analysedSessions - a.analysedSessions)
        .slice(0, MAX_PROJECT_RADARS)
        .map((pr) => pr.project)
    : []
  const inProject = (project: string) =>
    traits.map((t) => t.byProject.find((pr) => pr.project === project)?.score ?? null)
  const value = (score: number | null, l: Parameters<Scrub>[1]) =>
    score === null ? ABILITY_MESSAGES[l].unknown : `${score}%`
  return html`<section class="trait-radar">
    <h2>${loc.text((_m, _c, l) => RADAR_MESSAGES[l].title)}</h2>
    <p class="note">${loc.text((_m, _c, l) => RADAR_MESSAGES[l].note)}</p>
    <div class="radar-main">${radarSvg(
      overall,
      (i, attrs) => loc.svgText(attrs, (_m, _c, l) => `${name(i)(l)} ${value(overall[i]!, l)}`),
      (i) => loc.attr((_m, _c, l) => `${name(i)(l)}: ${value(overall[i]!, l)}`),
      {
        r: 130,
        padX: labelRoom(
          traits
            .map((_, i) => p.languages.map((l) => `${name(i)(l)} ${value(overall[i]!, l)}`))
            .flat(),
        ),
        padY: 26,
      },
    )}</div>
    <ul class="radar-values">${traits.map(
      (t, i) =>
        html`<li><b>${loc.text((_m, _c, l) => name(i)(l))}</b> <span>${loc.text((_m, _c, l) => value(overall[i]!, l))}</span> <small>${loc.text((_m, _c, l) => RADAR_MESSAGES[l].support(t.support.sessions, t.support.weeks))}</small>${v.quotes ? quotes(t.evidence, makeVerbatim(loc, v, scrub)) : ""}</li>`,
    )}</ul>
  </section>${
    projects.length === 0
      ? ""
      : html`<section class="trait-radar-projects">
    <h3>${loc.text((_m, _c, l) => RADAR_MESSAGES[l].byProject)}</h3>
    <p class="note">${loc.text((_m, _c, l) => RADAR_MESSAGES[l].byProjectNote)}</p>
    <div class="radar-grid-list">${projects.map((project) => {
      const values = inProject(project)
      const analysed =
        traits[0]!.byProject.find((x) => x.project === project)?.analysedSessions ?? 0
      return html`<figure><figcaption>${project} <small>${loc.text((_m, _c, l) => RADAR_MESSAGES[l].conversations(analysed))}</small></figcaption>${radarSvg(
        values,
        () => null,
        (i) => loc.attr((_m, _c, l) => `${project} · ${name(i)(l)}: ${value(values[i]!, l)}`),
        { r: 60, padX: 10, padY: 10 },
      )}<ul class="radar-mini-values">${traits.map(
        (_, i) =>
          html`<li><span>${loc.text((_m, _c, l) => name(i)(l))}</span> <b>${loc.text((_m, _c, l) => value(values[i]!, l))}</b></li>`,
      )}</ul></figure>`
    })}</div>
  </section>`
  }`
}

export const radarStyle = `
.trait-radar{margin:48px 0 16px}
.trait-radar>.note,.trait-radar-projects>.note{margin:12px 0 16px;max-width:var(--reading);color:var(--muted);font-size:var(--text-sm)}
.radar-main svg{display:block;margin:0 auto;max-width:100%;height:auto}
.radar-grid{fill:none;stroke:var(--border);stroke-width:1}
.radar-shape{fill:color-mix(in srgb,var(--accent) 20%,transparent);stroke:var(--accent);stroke-width:2;stroke-linejoin:round}
.radar-point{fill:var(--accent);stroke:var(--bg,#fff);stroke-width:2}
.radar-label{font-size:12px;fill:currentColor}
.radar-values{list-style:none;padding:0;margin:8px auto 0;max-width:var(--reading);display:grid;gap:6px;font-size:var(--text-sm)}
.radar-values span{font-variant-numeric:tabular-nums}.radar-values small{color:var(--muted)}
.trait-radar-projects{margin:16px 0 48px}
.radar-grid-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.radar-grid-list figure{margin:0;text-align:center}
.radar-grid-list figcaption{font-size:var(--text-sm);font-weight:600}
.radar-grid-list figcaption small{display:block;font-weight:400;color:var(--muted)}
.radar-grid-list svg{display:block;margin:4px auto 0;max-width:100%;height:auto}
.radar-mini-values{list-style:none;padding:0;margin:6px auto 0;max-width:200px;display:grid;gap:2px;font-size:var(--text-xs);text-align:left}
.radar-mini-values li{display:flex;justify-content:space-between;gap:8px}.radar-mini-values span{color:var(--muted)}
@media print{.trait-radar,.trait-radar-projects{break-inside:avoid}}
`
