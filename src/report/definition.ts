import type { Language } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { DEFINITION_MESSAGES } from "./messages.ts"

/**
 * A measurement's definition, folded away so the report stays uncluttered: an ⓘ that opens on
 * hover or focus; click, tap or Enter pins it open (native `<details>`, no JavaScript). Printed open.
 */
export const definition = (loc: Loc, ...paragraphs: ReadonlyArray<Raw>): Raw =>
  html`<details class="def"><summary><span aria-hidden="true">i</span><span class="def-label">${loc.text((_m, _c, l) => DEFINITION_MESSAGES[l].label)}</span></summary><div class="def-body" role="note">${paragraphs.map((p) => html`<p>${p}</p>`)}</div></details>`

/** Definition text in every report language. */
export const defText =
  (loc: Loc) =>
  (pick: (m: (typeof DEFINITION_MESSAGES)[Language], l: Language) => string): Raw =>
    loc.text((_m, _c, l) => pick(DEFINITION_MESSAGES[l], l))

/** A heading (or label) with its definition beside it. */
export const defined = (heading: Raw, def: Raw): Raw =>
  html`<div class="def-head">${heading}${def}</div>`

export const definitionStyle = `
.def-head{position:relative;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.def-head>h2,.def-head>h3{margin:0}
.def{display:inline-block;vertical-align:middle;font-weight:400}
.def>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:4px 2px;border:0;background:none;color:var(--muted);font:600 var(--text-xs)/1.4 var(--font-body);user-select:none}
.def-label{font-style:normal}
.def>summary::-webkit-details-marker{display:none}
.def>summary:hover{color:var(--accent);text-decoration:underline}
.def[open]>summary{color:var(--accent);text-decoration:underline}
.def:hover::details-content,.def:focus-within::details-content{content-visibility:visible;display:block}
.def:not([open])>.def-body{display:none}
.def:hover>.def-body,.def:focus-within>.def-body{display:block}
.def[open]>.def-body{position:static;width:auto;max-width:100%;margin-top:6px;box-shadow:none}
.def>summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.def-body{position:absolute;z-index:30;left:0;top:calc(100% + 6px);width:max-content;max-width:min(420px,86vw);padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--card);color:var(--fg);font-size:var(--text-xs);font-weight:400;letter-spacing:0;line-height:1.55;text-align:left;white-space:normal;box-shadow:0 6px 18px var(--shadow)}
.def-body p{margin:0}.def-body p+p{margin-top:6px}
.hero .def-body,.report-facts .def-body{position:static;width:auto;margin-top:6px;box-shadow:none}
@media print{.def>summary{display:none}.def::details-content{content-visibility:visible;display:block}.def:not([open])>.def-body{display:block}.def-body{position:static;width:auto;max-width:none;padding:4px 0 0;border:0;box-shadow:none;color:var(--muted)}}
`

/** Native disclosures keep optional depth available without scripts or hidden print evidence. */
export const disclosureStyle = `
details:not(.def)>summary{cursor:pointer;min-height:44px;padding:8px 0;border:0;border-radius:0;background:none;color:var(--muted)}
details:not(.def)>summary:hover{color:var(--accent);text-decoration:underline}
details[open]:not(.def)>summary{color:var(--accent);text-decoration:underline}
@media print{details::details-content{content-visibility:visible;display:block}details:not(.def)>summary{border:0;background:none;list-style:none}}
`
