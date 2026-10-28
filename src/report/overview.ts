import { INTERACTION_AXES } from "../domain/Interaction.ts"
import type { Profile } from "../domain/Profile.ts"
import { PROMPT_TECHNIQUES, TOOL_TECHNIQUES } from "../domain/Techniques.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { PORTRAIT_MESSAGES, VIEW_MESSAGES } from "./messages.ts"

/** Categorical preferences: marker positions are not numerical personality scores. */
export const preferenceMap = (p: Profile, loc: Loc): Raw => {
  if (!p.portrait)
    return html`<p class="note">${loc.text((_m, _c, l) => VIEW_MESSAGES[l].noPortrait)}</p>`
  return html`<article class="preference-map panel">
    <h2>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].preferences)}</h2>
    <p class="note">${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].note)}</p>
    <div class="preference-rows">${INTERACTION_AXES.map(({ key }) => {
      const pole = p.portrait!.axes.find((a) => a.key === key)?.pole ?? "unclear"
      return html`<div class="preference-row">
        <h3>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[key][0])}</h3>
        <div class="preference-rail ${pole}" aria-hidden="true"><i></i></div>
        <div class="preference-ends"><span>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[key][1])}</span><span>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[key][2])}</span></div>
        <p class="preference-status">${loc.text((_m, _c, l) => (pole === "unclear" ? VIEW_MESSAGES[l].mixed : PORTRAIT_MESSAGES[l].axes[key][pole === "first" ? 1 : 2]))}</p>
      </div>`
    })}</div>
  </article>`
}

const bar = (name: Raw, share: number, value: Raw): Raw => html`<li>
  <span class="overview-bar-name">${name}</span>
  <span class="overview-bar-track" aria-hidden="true"><i style="width:${Math.round(share * 100)}%"></i></span>
  <b>${value}</b>
</li>`

export const workflowCharts = (p: Profile, loc: Loc): Raw => {
  const t = p.stats.techniques
  return html`<div class="overview-charts">
    <article class="panel"><h2>${loc.text((_m, _c, l) => VIEW_MESSAGES[l].tools)}</h2>
      <p class="note">${loc.text((_m, _c, l) => VIEW_MESSAGES[l].toolsNote)}</p>
      ${
        !t || t.coveredSessions === 0
          ? html`<p class="empty">${loc.text((_m, _c, l) => VIEW_MESSAGES[l].noTools)}</p>`
          : html`<ul class="overview-bars">${TOOL_TECHNIQUES.toSorted(
              (a, b) => t.tools[b].sessions - t.tools[a].sessions,
            ).map((key) => {
              const share = Math.min(1, t.tools[key].sessions / t.coveredSessions)
              return bar(
                loc.text((m) => m.toolNames[key][0]),
                share,
                html`${Math.round(100 * share)}%`,
              )
            })}</ul>`
      }
    </article>
    ${
      t
        ? html`<article class="panel"><h2>${loc.text((_m, _c, l) => VIEW_MESSAGES[l].promptTechniques)}</h2>
      <p class="note">${loc.text((_m, _c, l) => VIEW_MESSAGES[l].promptsNote)}</p>
      <ul class="overview-bars">${PROMPT_TECHNIQUES.toSorted(
        (a, b) => t.prompts[b] - t.prompts[a],
      ).map((key) =>
        bar(
          loc.text((m) => m.promptNames[key][0]),
          t.prompts[key],
          html`${Math.round(100 * t.prompts[key])}%`,
        ),
      )}</ul>
    </article>`
        : ""
    }
  </div>`
}

export const viewStyle = `
.view-input{position:absolute;width:1px;height:1px;padding:0;margin:-1px;clip-path:inset(50%);overflow:hidden;white-space:nowrap}
.view-nav{display:flex;gap:6px;margin:4px 0 24px;padding:5px;background:var(--card);border:1px solid var(--border);border-radius:14px;width:fit-content}
.view-nav label,.page-turn{cursor:pointer;border-radius:10px;padding:10px 20px;font-weight:650;color:var(--muted);display:inline-block}
.view-nav label:hover,.page-turn:hover{color:var(--fg);background:var(--accent-soft)}
#report-overview:checked~.page label[for="report-overview"],#report-detail:checked~.page label[for="report-detail"]{background:var(--accent-soft);color:var(--fg)}
#report-overview:focus-visible~.page .view-nav label[for="report-overview"],#report-detail:focus-visible~.page .view-nav label[for="report-detail"]{outline:3px solid var(--accent);outline-offset:3px}
#report-overview:checked~.page .report-view-detail,#report-detail:checked~.page .report-view-overview{display:none}
.view-heading{margin:32px 0 24px}.view-heading h2{font-size:clamp(24px,4vw,34px);letter-spacing:-.03em}.view-heading p{margin-top:12px;max-width:680px;color:var(--muted)}
.overview-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:24px 0 36px}
.overview-charts h2,.preference-map h2{font-size:20px}.overview-charts .note,.preference-map>.note{margin-top:12px;line-height:1.7;font-size:13px;color:var(--muted)}
.overview-bars{list-style:none;margin:24px 0 0;padding:0;display:grid;gap:16px}
.overview-bars li{display:grid;grid-template-columns:minmax(80px,1fr) minmax(40px,1fr) 44px;gap:12px;align-items:center;font-size:13px}
.overview-bars b{text-align:right;font-variant-numeric:tabular-nums}
.overview-bar-track{height:8px;border-radius:8px;background:var(--accent-soft);overflow:hidden}.overview-bar-track i{display:block;height:100%;background:var(--accent);border-radius:8px}
.preference-map{margin:28px 0}.preference-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 44px;margin-top:28px}
.preference-row h3{font-size:14px}.preference-rail{height:6px;background:linear-gradient(90deg,var(--accent-soft),var(--border),var(--accent-soft));border-radius:8px;position:relative;margin:22px 8px 14px}
.preference-rail i{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:15px;height:15px;border-radius:50%;background:var(--card);border:2px dashed var(--muted)}
.preference-rail.first i{left:0;border:2px solid var(--accent);background:var(--accent)}.preference-rail.second i{left:100%;border:2px solid var(--accent);background:var(--accent)}
.preference-ends{display:flex;justify-content:space-between;font-size:13px;color:var(--muted)}.preference-status{font-size:12px;margin-top:10px;color:var(--muted)}
.page-turn{margin:28px 0;border:1px solid var(--border)}
.report-view-detail .portrait{margin-top:32px}.report-view-detail details[open]>summary{margin-bottom:14px}.report-view-detail blockquote{line-height:1.85}
@media(max-width:640px){.overview-charts,.preference-rows{grid-template-columns:1fr}.view-nav{width:100%}.view-nav label{flex:1;text-align:center;padding:10px 8px;font-size:14px}.overview-bars li{gap:8px}}
@media print{.view-nav,.page-turn,.switch{display:none!important}.report-view{display:block!important}.report-view-detail{break-before:page}.panel,.portrait-chapter,.preference-row{break-inside:avoid}.page{max-width:none;padding:0}}
`
