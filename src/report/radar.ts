import type { Profile, TraitFrequency } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { RADAR_MESSAGES } from "./messages.ts"
import type { Scrub, Visibility } from "./visibility.ts"

/** Fewest measured traits a radar needs; fewer stay in the trait list only. */
export const MIN_RADAR_TRAITS = 3
/** Fewest analysed conversations a project needs for its own radar. */
export const MIN_PROJECT_SESSIONS = 5
/** Most project radars shown, busiest first. */
export const MAX_PROJECT_RADARS = 3

type Measured = { readonly index: number; readonly frequency: TraitFrequency }

const share = (sessions: number, of: number) => (of === 0 ? 0 : Math.round((sessions / of) * 100))

/** The traits with a measured frequency, or none when fewer than MIN_RADAR_TRAITS have one. */
const measuredTraits = (p: Profile): ReadonlyArray<Measured> => {
  const measured = p.traits.flatMap((t, index) =>
    t.frequency && t.frequency.analysedSessions > 0 ? [{ index, frequency: t.frequency }] : [],
  )
  return measured.length >= MIN_RADAR_TRAITS ? measured : []
}

/** The grid, the shape and its points; axis labels only on the large radar. */
const radarSvg = (
  values: ReadonlyArray<number>,
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
    <polygon class="radar-shape" points="${shape(values)}" />
    ${values.map((v, i) => {
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

/**
 * How often each trait shows, as a radar: one axis per measured trait, 0% at the center and
 * 100% at the edge. Each trait is a share of the analysed conversations on its own, so several
 * may reach 100%. Projects with enough conversations get their own small radar on the same
 * axes, unless project names are excluded.
 */
export const traitRadar = (p: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw | null => {
  const traits = measuredTraits(p)
  if (traits.length === 0) return null
  const name = (i: number) => (l: Parameters<Scrub>[1]) =>
    scrub(p.translations[l]?.traits[traits[i]!.index]?.name ?? p.traits[traits[i]!.index]!.name, l)
  const overall = traits.map((t) => share(t.frequency.sessions, t.frequency.analysedSessions))
  const projects = v.projects
    ? (traits[0]!.frequency.byProject ?? [])
        .filter((pr) => pr.analysedSessions >= MIN_PROJECT_SESSIONS)
        .toSorted((a, b) => b.analysedSessions - a.analysedSessions)
        .slice(0, MAX_PROJECT_RADARS)
        .map((pr) => pr.project)
    : []
  const inProject = (project: string) =>
    traits.map((t) => {
      const pr = t.frequency.byProject.find((x) => x.project === project)
      return pr ? share(pr.sessions, pr.analysedSessions) : 0
    })
  return html`<section class="trait-radar">
    <h2>${loc.text((_m, _c, l) => RADAR_MESSAGES[l].title)}</h2>
    <p class="note">${loc.text((_m, _c, l) => RADAR_MESSAGES[l].note)}</p>
    <div class="radar-main">${radarSvg(
      overall,
      (i, attrs) => loc.svgText(attrs, (_m, _c, l) => `${name(i)(l)} ${overall[i]}%`),
      (i) => loc.attr((_m, _c, l) => `${name(i)(l)}: ${overall[i]}%`),
      { r: 130, padX: 130, padY: 26 },
    )}</div>
    <ul class="radar-values">${traits.map(
      (t, i) =>
        html`<li><b>${loc.text((_m, _c, l) => name(i)(l))}</b> <span>${overall[i]}%</span> <small>${loc.text((_m, _c, l) => RADAR_MESSAGES[l].of(t.frequency.sessions, t.frequency.analysedSessions))}</small></li>`,
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
        traits[0]!.frequency.byProject.find((x) => x.project === project)?.analysedSessions ?? 0
      return html`<figure><figcaption>${project} <small>${loc.text((_m, _c, l) => RADAR_MESSAGES[l].conversations(analysed))}</small></figcaption>${radarSvg(
        values,
        () => null,
        (i) => loc.attr((_m, _c, l) => `${project} · ${name(i)(l)}: ${values[i]}%`),
        { r: 60, padX: 10, padY: 10 },
      )}</figure>`
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
@media print{.trait-radar,.trait-radar-projects{break-inside:avoid}}
`
