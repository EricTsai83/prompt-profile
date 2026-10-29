import type { Profile } from "../domain/Profile.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { VIEW_MESSAGES } from "./messages.ts"
import type { Scrub } from "./visibility.ts"

/** Only verified, higher-confidence observations introduce the person: trait indexes, at most 3. */
const signatureTraits = (p: Profile): ReadonlyArray<number> =>
  p.traits
    .map((t, i) => ({ t, i }))
    .filter(
      ({ t }, i, all) =>
        t.confidence !== "low" &&
        t.evidence.length > 0 &&
        all.findIndex((x) => x.t.description === t.description) === i,
    )
    .slice(0, 3)
    .map(({ i }) => i)

/** First-screen signatures in the hero of document looks. */
export const identitySignatures = (p: Profile, loc: Loc, scrub: Scrub): Raw =>
  html`<div class="identity-signatures">${signatureTraits(p).map((i) => html`<article><h2>${loc.text((_m, c, l) => scrub(c.trait(i).name, l))}</h2><p>${loc.text((_m, c, l) => scrub(c.trait(i).description, l))}</p></article>`)}</div>`

/**
 * The identity view's signature habits: the same traits as the hero signatures, each with one of
 * the person's own prompts. `describe` adds the description when the hero does not show it;
 * `quote` is null when quotes are excluded.
 */
export const identityMoves = (
  p: Profile,
  loc: Loc,
  scrub: Scrub,
  describe: boolean,
  quote: ((text: string) => Raw | string) | null,
): Raw => {
  const selected = signatureTraits(p)
  return html`<section class="identity-moves">
    <h2>${loc.text((_m, _c, l) => VIEW_MESSAGES[l].moves)}</h2>
    <p class="note">${loc.text((_m, _c, l) => (selected.length === 0 ? VIEW_MESSAGES[l].noMoves : VIEW_MESSAGES[l].movesNote))}</p>
    ${
      selected.length === 0
        ? ""
        : html`<ol>${selected.map(
            (i) => html`<li>
        <h3>${loc.text((_m, c, l) => scrub(c.trait(i).name, l))}</h3>
        ${describe ? html`<p>${loc.text((_m, c, l) => scrub(c.trait(i).description, l))}</p>` : ""}
        ${quote ? html`<blockquote>${quote(p.traits[i]!.evidence[0]!.quote)}</blockquote>` : ""}
      </li>`,
          )}</ol>`
    }
  </section>`
}

const D = "[data-composition=document]"

/**
 * Variant rules: structure keyed on the `<html data-…>` layout choices of the theme, values read
 * from its tokens. The numbers left here define a variant; numbers a look tunes are tokens.
 * `:where()` keeps rules that used to be unscoped at their old specificity.
 */
export const variantStyle = `
.identity-moves{margin:var(--space-8) 0}.identity-moves>.note{margin-top:var(--space-2);max-width:var(--reading);color:var(--muted);font-size:var(--text-sm)}
.identity-moves ol{list-style:none;margin:var(--space-6) 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-6)}
.identity-moves li{border-top:2px solid var(--accent);padding-top:var(--space-4)}.identity-moves h3{font-size:var(--text-lg)}
.identity-moves li>p{margin-top:var(--space-2);color:var(--muted);font-size:var(--text-md)}.identity-moves blockquote{margin-top:var(--space-4);font-size:var(--text-md);line-height:1.7}
html${D} .identity-signatures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin:28px 0 8px}
.identity-signatures article{border-top:2px solid var(--accent);padding:18px 0}.identity-signatures h2{font-size:var(--text-base);line-height:1.5}.identity-signatures p{font-size:var(--text-sm);line-height:1.8;color:var(--muted);margin-top:8px}
${D} .hero{background:var(--card);color:var(--fg);overflow:visible}
${D} .hero .copy{max-width:none}
${D} .hero .tagline{color:var(--fg);max-width:760px;font-size:var(--text-xl);line-height:1.6}
${D} .hero .desc{color:var(--muted);max-width:760px;line-height:1.8}
${D} .hero .graphic,${D} .hero .chrono{display:none}
${D} .hero .report-facts{border-top:1px solid var(--border);padding-top:var(--space-4);margin-top:var(--space-6);color:var(--muted);font-size:var(--text-xs)}
${D} .hero .report-facts dt{color:var(--muted);font-size:10px}
${D} .view-heading h2{font-size:var(--text-xl)}
${D} .view-heading p{font-size:var(--text-sm)}
:where(${D}) .preference-row:has(.unclear) .preference-rail,:where(${D}) .preference-row:has(.unclear) .preference-ends{display:none}
[data-hero=split] .hero{display:grid;grid-template-columns:1.2fr 1fr;gap:32px}html[data-signatures=stacked] .identity-signatures{display:grid!important;grid-template-columns:1fr;gap:0;margin:0}html[data-signatures=stacked] .identity-signatures article{padding:12px 0;border-top:1px solid var(--border)}html[data-signatures=stacked] .identity-signatures article:first-child{border-top:0}html[data-signatures=stacked] .identity-signatures p{margin-top:4px}
[data-hero=editorial] .hero{background:transparent}html[data-signatures=ledger] .identity-signatures{grid-template-columns:1fr;gap:0;max-width:var(--column)}html[data-signatures=ledger] .identity-signatures article{display:grid;grid-template-columns:200px 1fr;gap:24px;border-top:1px solid var(--border);padding:16px 0}html[data-signatures=ledger] .identity-signatures p{margin:0}[data-story-width=reading] .portrait{max-width:var(--column)}[data-story-width=reading] .portrait-intro{font-family:var(--prose-font);font-size:var(--prose-intro)}[data-story-width=reading] .portrait-chapter{border-top:1px solid var(--border);padding-top:28px}
:where(${D}) .counter-evidence{border-left:2px dashed var(--warn);padding-left:16px}
@media(max-width:700px){html${D} .identity-signatures{grid-template-columns:1fr;gap:0}[data-hero=split] .hero{display:block}html[data-signatures=ledger] .identity-signatures article{grid-template-columns:1fr;gap:6px}html${D} .hero h1{overflow-wrap:anywhere}html${D} .report-facts{display:grid;gap:12px}}
@media print{html${D} .hero{break-inside:avoid}html${D} .identity-signatures{break-inside:avoid}}
`
