import type { Profile } from "../domain/Profile.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import type { Scrub } from "./visibility.ts"

/** Only verified, higher-confidence observations become first-screen signatures. */
export const identitySignatures = (p: Profile, loc: Loc, scrub: Scrub): Raw => {
  const selected = p.traits
    .map((t, i) => ({ t, i }))
    .filter(
      ({ t }, i, all) =>
        t.confidence !== "low" &&
        t.evidence.length > 0 &&
        all.findIndex((x) => x.t.description === t.description) === i,
    )
    .slice(0, 3)
  return html`<div class="identity-signatures">${selected.map(({ i }) => html`<article><h2>${loc.text((_m, c, l) => scrub(c.trait(i).name, l))}</h2><p>${loc.text((_m, c, l) => scrub(c.trait(i).description, l))}</p></article>`)}</div>`
}

/** Layout rules deliberately differ in hierarchy, reading measure and density. */
export const productStyle = `
html[data-look] .identity-signatures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin:28px 0 8px}
.identity-signatures article{border-top:2px solid var(--accent);padding:18px 0}.identity-signatures h2{font-size:16px;line-height:1.5}.identity-signatures p{font-size:13px;line-height:1.8;color:var(--muted);margin-top:8px}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .hero{background:var(--card);color:var(--fg);border:1px solid var(--border);border-radius:12px;padding:32px;overflow:visible}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .hero .copy{max-width:none}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .hero h1{font-family:Inter,system-ui,sans-serif;font-size:clamp(28px,4vw,44px);letter-spacing:-.045em;max-width:850px}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .hero .tagline{color:var(--fg);max-width:760px;font-size:20px;line-height:1.6}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .hero .desc{color:var(--muted);max-width:760px;line-height:1.8}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .hero .graphic,:is([data-look=prism],[data-look=slate],[data-look=folio]) .hero .chrono{display:none}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .hero .report-facts{border-top:1px solid var(--border);padding-top:16px;margin-top:22px;color:var(--muted);font-size:11px}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .hero .report-facts dt{color:var(--muted);font-size:10px}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .panel{border-radius:10px;box-shadow:none}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .view-heading{margin:26px 0 18px}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .view-heading h2{font-size:22px}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .view-heading p{font-size:13px;margin-top:6px}
:is([data-look=prism],[data-look=slate],[data-look=folio]) .sig{border-radius:8px;padding:20px}.preference-row:has(.unclear) .preference-rail,.preference-row:has(.unclear) .preference-ends{display:none}
[data-look=prism] .page{max-width:1160px;padding-top:28px}[data-look=prism] .hero{border-top:3px solid var(--accent)}
[data-look=slate] .page{max-width:1240px}[data-look=slate] .topbar{border-bottom:1px solid var(--border);padding-bottom:18px}[data-look=slate] .hero{display:grid;grid-template-columns:1.2fr 1fr;gap:32px;padding:26px}html[data-look=slate] .identity-signatures{display:grid!important;grid-template-columns:1fr;gap:0;margin:0}html[data-look=slate] .identity-signatures article{padding:12px 0;border-top:1px solid var(--border)}html[data-look=slate] .identity-signatures article:first-child{border-top:0}html[data-look=slate] .identity-signatures p{margin-top:4px}[data-look=slate] .panel{padding:22px}[data-look=slate] .sigs{gap:1px;background:var(--border);border:1px solid var(--border);border-radius:8px;overflow:hidden}[data-look=slate] .sig{border:0;border-radius:0;background:var(--card)}[data-look=slate] .overview-bars{gap:12px}
[data-look=folio] .page{max-width:960px}[data-look=folio] .hero{background:transparent;border:0;border-bottom:1px solid var(--border);padding:32px 0;border-radius:0}[data-look=folio] .hero h1{font-family:Georgia,"Songti TC",serif;font-weight:400;font-size:clamp(36px,5vw,58px);letter-spacing:-.035em}html[data-look=folio] .identity-signatures{grid-template-columns:1fr;gap:0;max-width:740px}html[data-look=folio] .identity-signatures article{display:grid;grid-template-columns:200px 1fr;gap:24px;border-top:1px solid var(--border);padding:16px 0}html[data-look=folio] .identity-signatures p{margin:0}[data-look=folio] .report-view-detail{max-width:740px;margin:auto}[data-look=folio] .portrait-intro{font-family:Georgia,"Songti TC",serif;font-size:24px}[data-look=folio] .traits{grid-template-columns:1fr}[data-look=folio] .portrait-chapter{border-top:1px solid var(--border);padding-top:28px}[data-look=folio] .overview-charts{gap:24px}
.counter-evidence{border-left:2px dashed var(--warn);padding-left:16px}
@media(max-width:700px){html[data-look] .identity-signatures{grid-template-columns:1fr;gap:0}[data-look=slate] .hero{display:block}:is([data-look=prism],[data-look=slate]) .hero{padding:22px}html[data-look=folio] .identity-signatures article{grid-template-columns:1fr;gap:6px}html[data-look] .hero h1{overflow-wrap:anywhere}html[data-look] .report-facts{display:grid;gap:12px}}
@media print{html[data-look] .hero{break-inside:avoid}html[data-look] .identity-signatures{break-inside:avoid}}
`
