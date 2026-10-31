import type { Language } from "../domain/Profile.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { DEFINITION_MESSAGES } from "./messages.ts"

/**
 * A measurement's definition, folded away so the report stays uncluttered: an ⓘ that opens on
 * hover or focus; click, tap or Enter pins it open (native `<details>`, no JavaScript). Printed open.
 */
export const definition = (loc: Loc, ...paragraphs: ReadonlyArray<Raw>): Raw =>
  html`<details class="def"><summary aria-label="${loc.attr((_m, _c, l) => DEFINITION_MESSAGES[l].label)}"><span aria-hidden="true">i</span></summary><div class="def-body" role="note">${paragraphs.map((p) => html`<p>${p}</p>`)}</div></details>`

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
.def>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:1px solid var(--border);color:var(--muted);font:italic 600 11px/1 var(--font-body);user-select:none}
.def>summary::-webkit-details-marker{display:none}
.def>summary:hover,.def[open]>summary{color:var(--fg);border-color:var(--muted)}
.def[open]>summary{background:var(--accent);color:var(--card);border-color:var(--accent)}
.def:hover::details-content,.def:focus-within::details-content{content-visibility:visible;display:block}
.def:not([open])>.def-body{display:none}
.def:hover>.def-body,.def:focus-within>.def-body{display:block}
.def>summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.def-body{position:absolute;z-index:30;left:0;top:calc(100% + 6px);width:max-content;max-width:min(420px,86vw);padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--card);color:var(--fg);font-size:var(--text-xs);font-weight:400;letter-spacing:0;line-height:1.55;text-align:left;white-space:normal;box-shadow:0 6px 18px var(--shadow)}
.def-body p{margin:0}.def-body p+p{margin-top:6px}
.hero .def-body,.report-facts .def-body{position:static;width:auto;margin-top:6px;box-shadow:none}
@media print{.def>summary{display:none}.def::details-content{content-visibility:visible;display:block}.def:not([open])>.def-body{display:block}.def-body{position:static;width:auto;max-width:none;padding:4px 0 0;border:0;box-shadow:none;color:var(--muted)}}
`
