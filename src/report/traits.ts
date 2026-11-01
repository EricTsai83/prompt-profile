import { sourceLabel } from "./evidence-origin.ts"
import type { DimensionKey, Evidence, Profile, Trait } from "../domain/index.ts"
import { defined, definition, defText } from "./definition.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import type { Scrub, Visibility } from "./visibility.ts"

/** Verbatim text (quotes, rewrites): as written, or per language with project names replaced. */
export type Verbatim = (text: string, promptId?: string) => Raw | string

export const makeVerbatim =
  (loc: Loc, v: Visibility, scrub: Scrub): Verbatim =>
  (text) =>
    v.projects && v.customNames ? text : loc.text((_m, _c, l) => scrub(text, l))

/** Quotes keep their original wording; recorded provenance is added beside the excerpt. */
export const makeCitedVerbatim = (p: Profile, loc: Loc, v: Visibility, scrub: Scrub): Verbatim => {
  const say = makeVerbatim(loc, v, scrub)
  return (text, promptId) => html`${say(text)}${promptId ? sourceLabel(p, promptId, loc, v) : null}`
}

export const quotes = (evidence: ReadonlyArray<Evidence>, say: Verbatim): Raw =>
  html`<ul class="evidence">
    ${evidence.map((e) => html`<li><blockquote>${say(e.quote, e.promptId)}</blockquote></li>`)}
  </ul>`

const CONFIDENCE_RANK = { high: 0, medium: 1, low: 2 } as const
const CONFIDENCE_LEVEL = { high: 3, medium: 2, low: 1 } as const

const meter = (t: Trait, loc: Loc): Raw =>
  html`<span class="meter ${t.confidence}"
    >${[1, 2, 3].map((n) => html`<i class="${n <= CONFIDENCE_LEVEL[t.confidence] ? "on" : ""}"></i>`)}<span
      class="meter-label"
      >${loc.text((m) => m.confidence[t.confidence])}</span
    ></span
  >`

const knownSupport = (t: Trait): boolean => {
  if (t.support === null) return false
  const prompts = new Set(t.evidence.map((e) => e.promptId)).size
  return (
    t.support.sessions > 0 &&
    t.support.weeks > 0 &&
    t.support.sessions <= prompts &&
    t.support.weeks <= prompts
  )
}

const supportLine = (t: Trait, loc: Loc): Raw =>
  !knownSupport(t)
    ? html`<p class="support">${loc.text((m) => m.supportUnknown)}</p>`
    : html`<p class="support">
        ${loc.text((m) => m.support(t.support!.sessions, t.support!.weeks, t.evidence.length))}
      </p>`

/** A signature trait: one quote shown in the private report, the rest one click away. */
const signatureTrait = (p: Profile, i: number, loc: Loc, v: Visibility, scrub: Scrub): Raw => {
  const t = p.traits[i]!
  return html`<article class="trait">
    <header>
      <h3>${loc.text((_m, c, l) => scrub(c.trait(i).name, l))}</h3>
      ${!knownSupport(t) ? meter(t, loc) : ""}
    </header>
    <p>${loc.text((_m, c, l) => scrub(c.trait(i).description, l))}</p>
    ${v.quotes && t.evidence[0] ? html`<blockquote class="lead-quote">${makeCitedVerbatim(p, loc, v, scrub)(t.evidence[0].quote, t.evidence[0].promptId)}</blockquote>` : ""}
    ${supportLine(t, loc)}
    ${
      v.quotes && t.evidence.length > 1
        ? html`<details open>
            <summary>${loc.text((m) => m.showEvidence(t.evidence.length))}</summary>
            ${quotes(t.evidence.slice(1), makeCitedVerbatim(p, loc, v, scrub))}
          </details>`
        : ""
    }
  </article>`
}

const minorTrait = (p: Profile, i: number, loc: Loc, v: Visibility, scrub: Scrub): Raw => {
  const t = p.traits[i]!
  return html`<li class="minor">
    <div class="minor-head">
      <b>${loc.text((_m, c, l) => scrub(c.trait(i).name, l))}</b>${!knownSupport(t) ? meter(t, loc) : ""}
    </div>
    <p>${loc.text((_m, c, l) => scrub(c.trait(i).description, l))}</p>
    ${supportLine(t, loc)}
    ${
      v.quotes && t.evidence.length > 0
        ? html`<details open>
            <summary>${loc.text((m) => m.showEvidence(t.evidence.length))}</summary>
            ${quotes(t.evidence, makeCitedVerbatim(p, loc, v, scrub))}
          </details>`
        : ""
    }
  </li>`
}

const dimensionRow = (
  p: Profile,
  key: DimensionKey,
  loc: Loc,
  v: Visibility,
  scrub: Scrub,
): Raw => {
  const d = p.dimensions.find((x) => x.key === key)!
  const head = html`<span class="dim-name">${loc.text((m) => m.dimensionNames[key])}</span>
    <span class="dim-main">
      <span class="dim-title">${loc.text((_m, c, l) => scrub(c.dimension(key).title, l))}</span>
      <span class="dim-summary">${loc.text((_m, c, l) => scrub(c.dimension(key).summary, l))}</span>
    </span>
    ${
      d.evidence.length === 0
        ? html`<span class="badge warn">${loc.text((m) => m.noEvidence)}</span>`
        : html`<span class="badge">${loc.text((m) => m.evidenceCount(d.evidence.length))}</span>`
    }`
  if (!v.quotes) return html`<div class="dimension static">${head}</div>`
  return html`<details open class="dimension">
    <summary>${head}</summary>
    <div class="dim-body">
      ${
        d.evidence.length === 0
          ? html`<p class="warning">${loc.text((m) => m.insufficientEvidence)}</p>`
          : quotes(d.evidence, makeCitedVerbatim(p, loc, v, scrub))
      }
    </div>
  </details>`
}

/** The traits: the three most confident in full, the others folded below. */
export const traitsSection = (profile: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw => {
  const def = defText(loc)
  const order = profile.traits
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.evidence.some((e) => e.quote.trim().length > 0))
    .toSorted((a, b) => CONFIDENCE_RANK[a.t.confidence] - CONFIDENCE_RANK[b.t.confidence])
    .map((x) => x.i)
  const signature = order.slice(0, 3)
  const minor = order.slice(3)
  return html`<section>
            ${defined(
              html`<h2>${loc.text((m) => m.traits)}</h2>`,
              definition(
                loc,
                def((m) => m.traits),
              ),
            )}
            <div class="traits">
              ${signature.map((i) => signatureTrait(profile, i, loc, v, scrub))}
            </div>
            ${
              minor.length > 0
                ? html`<h3 class="sub-h">${loc.text((m) => m.moreTraits)}</h3>
                    <ul class="minors">
                      ${minor.map((i) => minorTrait(profile, i, loc, v, scrub))}
                    </ul>`
                : ""
            }
          </section>`
}

/** One row per collaboration dimension, its evidence one click away. */
export const dimensionsSection = (profile: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw => {
  const def = defText(loc)
  return html`<section>
            ${defined(
              html`<h2>${loc.text((m) => m.dimensions)}</h2>`,
              definition(
                loc,
                def((m) => m.dimensions),
              ),
            )}
            <div class="dims">
              ${profile.dimensions.filter((d) => d.evidence.some((e) => e.quote.trim().length > 0)).map((d) => dimensionRow(profile, d.key, loc, v, scrub))}
            </div>
          </section>`
}
