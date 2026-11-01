import type { Profile } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import type { Visibility, Scrub } from "./visibility.ts"
import { INSTRUCTION_MESSAGES } from "./messages.ts"
import { makeVerbatim } from "./traits.ts"

/** Provenance is visible independently of the generated interpretation. */
export const instructionsSection = (
  p: Profile,
  loc: Loc,
  v: Visibility,
  scrub: Scrub,
): Raw | null => {
  if (!p.instructionContexts.length || !v.customNames) return null
  const say = makeVerbatim(loc, v, scrub)
  return html`<section class="instruction-contexts"><h2>${loc.text((_m, _c, l) => INSTRUCTION_MESSAGES[l].title)}</h2>
  <p class="note">${loc.text((_m, _c, l) => INSTRUCTION_MESSAGES[l].note)}</p>
  ${p.instructionContexts.map(
    (c) => html`<article><h3>${loc.text((_m, _c, l) => scrub(c.name, l))}</h3>
  <p>${loc.text((_m, _c, l) => INSTRUCTION_MESSAGES[l].selection[c.selection])} · ${loc.text((_m, _c, l) => INSTRUCTION_MESSAGES[l].status[c.contentStatus])}</p>
  ${v.quotes && c.selectionEvidence ? html`<blockquote>${say(c.selectionEvidence)}</blockquote>` : ""}
  ${c.description ? html`<p>${loc.text((_m, _c, l) => INSTRUCTION_MESSAGES[l].purpose)}: ${say(c.description)}</p>` : ""}
  ${v.quotes && c.content !== null ? html`<details><summary>${loc.text((_m, _c, l) => INSTRUCTION_MESSAGES[l].status[c.contentStatus])}</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${say(c.content)}</pre></details>` : ""}
  </article>`,
  )}
  </section>`
}
