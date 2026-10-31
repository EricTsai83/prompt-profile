import { axisState, INTERACTION_AXES, MIN_SIDE_SESSIONS } from "../domain/Interaction.ts"
import type { Profile } from "../domain/Profile.ts"
import { PROMPT_TECHNIQUES, TOOL_TECHNIQUES } from "../domain/Techniques.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { PORTRAIT_MESSAGES, viewMessages } from "./messages.ts"
import type { Scrub } from "./visibility.ts"
import { defined, definition } from "./definition.ts"

/** Categorical preferences: marker positions are not numerical personality scores. */
export const preferenceMap = (p: Profile, loc: Loc, scrub: Scrub): Raw => {
  if (!p.portrait)
    return html`<p class="note">${loc.text((_m, _c, l) => viewMessages(l, p.voice).noPortrait)}</p>`
  return html`<article class="preference-map panel">
    ${defined(
      html`<h2>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].preferences)}</h2>`,
      definition(
        loc,
        loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].note),
        loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].rule),
      ),
    )}
    <div class="preference-rows">${INTERACTION_AXES.map(({ key }) => {
      const index = p.portrait!.axes.findIndex((a) => a.key === key)
      const axis = p.portrait!.axes[index]
      const state = axis ? axisState(axis) : "none"
      // Each characteristic way of working, in its own context: both may show.
      const sides = (axis?.sides ?? []).flatMap((side, i) =>
        side.sessions >= MIN_SIDE_SESSIONS ? [{ side, i }] : [],
      )
      return html`<div class="preference-row">
        <h3>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[key][0])}</h3>
        <div class="preference-rail ${state === "none" ? "unclear" : state}" aria-hidden="true">${state === "first" || state === "both" ? html`<i class="at-first"></i>` : ""}${state === "second" || state === "both" ? html`<i class="at-second"></i>` : ""}</div>
        <div class="preference-ends"><span>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[key][1])}</span><span>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[key][2])}</span></div>
        ${
          sides.length === 0
            ? html`<p class="preference-status">${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].notObserved)}</p>`
            : html`<ul class="preference-sides">${sides.map(
                ({ side, i }) =>
                  html`<li><b>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[key][side.pole === "first" ? 1 : 2])}</b>${loc.text(
                    (_m, _c, l) => {
                      const context =
                        p.translations[l]?.portrait?.axes[index]?.sides[i]?.context ?? side.context
                      return context ? ` · ${scrub(context, l)}` : ""
                    },
                  )}</li>`,
              )}</ul>`
        }
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
    <article class="panel">${defined(
      html`<h2>${loc.text((_m, _c, l) => viewMessages(l, p.voice).tools)}</h2>`,
      definition(
        loc,
        loc.text((_m, _c, l) => viewMessages(l, p.voice).toolsNote),
        ...(t && t.coveredSessions > 0
          ? [
              loc.text((_m, _c, l) =>
                viewMessages(l, p.voice).toolCoverage(t.coveredSessions, p.stats.totalSessions),
              ),
            ]
          : []),
      ),
    )}
      ${
        !t || t.coveredSessions === 0
          ? html`<p class="empty">${loc.text((_m, _c, l) => (!t ? viewMessages(l, p.voice).missingTechniques : viewMessages(l, p.voice).noTools))}</p>`
          : html`<ul class="overview-bars">${TOOL_TECHNIQUES.toSorted(
              (a, b) => t.tools[b].sessions - t.tools[a].sessions,
            ).map((key) => {
              const share = Math.min(1, t.tools[key].sessions / t.coveredSessions)
              return bar(
                loc.text((m) => m.toolNames[key][0]),
                share,
                html`${Math.round(100 * share)}%<small>${t.tools[key].sessions} / ${t.coveredSessions}</small>`,
              )
            })}</ul>`
      }
    </article>
    ${
      t
        ? html`<article class="panel">${defined(
            html`<h2>${loc.text((_m, _c, l) => viewMessages(l, p.voice).promptTechniques)}</h2>`,
            definition(
              loc,
              loc.text((_m, _c, l) => viewMessages(l, p.voice).promptsNote),
              ...(p.stats.analyzedPrompts > 0
                ? [
                    loc.text((_m, _c, l) =>
                      viewMessages(l, p.voice).promptCoverage(p.stats.analyzedPrompts),
                    ),
                  ]
                : []),
            ),
          )}
      ${
        p.stats.analyzedPrompts === 0
          ? html`<p class="empty">${loc.text((_m, _c, l) => viewMessages(l, p.voice).noPrompts)}</p>`
          : html`<ul class="overview-bars">${PROMPT_TECHNIQUES.toSorted(
              (a, b) => t.prompts[b] - t.prompts[a],
            ).map((key) =>
              bar(
                loc.text((m) => m.promptNames[key][0]),
                t.prompts[key],
                html`${Math.round(100 * t.prompts[key])}%`,
              ),
            )}</ul>`
      }
    </article>`
        : ""
    }
  </div>`
}

export const viewStyle = `
.view-input{position:absolute;width:1px;height:1px;padding:0;margin:-1px;clip-path:inset(50%);overflow:hidden;white-space:nowrap}
.view-nav{display:flex;gap:2px;margin:var(--space-1) auto var(--space-6);padding:3px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-lg);width:fit-content}
.view-nav label,.page-turn{cursor:pointer;border-radius:var(--radius-sm);padding:var(--space-1) var(--space-3);font-size:var(--text-sm);font-weight:600;color:var(--muted);display:inline-block;transition:background-color var(--motion-fast) var(--ease-out),color var(--motion-fast) var(--ease-out)}
.view-nav label:hover,.page-turn:hover{color:var(--fg);background:var(--accent-soft)}
#report-overview:checked~.page label[for="report-overview"],#report-detail:checked~.page label[for="report-detail"]{background:var(--accent-soft);color:var(--fg)}
#report-overview:focus-visible~.page .view-nav label[for="report-overview"],#report-detail:focus-visible~.page .view-nav label[for="report-detail"]{outline:3px solid var(--accent);outline-offset:3px}
#report-overview:checked~.page .report-view-detail,#report-detail:checked~.page .report-view-overview{display:none}
.report-view{animation:view-in var(--motion-base) var(--ease-out)}
.view-heading{margin:var(--space-8) 0 var(--space-6)}.view-heading h2{font-size:clamp(var(--text-xl),4vw,var(--text-2xl));letter-spacing:-.02em}.view-heading p{margin-top:var(--space-2);max-width:var(--reading);color:var(--muted)}
.overview-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:24px 0 36px}
.overview-charts h2,.preference-map h2{font-size:var(--text-xl)}.overview-charts .note,.preference-map>.note{margin-top:12px;line-height:1.7;font-size:var(--text-sm);color:var(--muted)}
.overview-bars{list-style:none;margin:24px 0 0;padding:0;display:grid;gap:16px}
.overview-bars li{display:grid;grid-template-columns:minmax(80px,1fr) minmax(40px,1fr) minmax(44px,max-content);gap:12px;align-items:center;font-size:var(--text-sm)}
.overview-bars small{display:block;font-size:var(--text-2xs);font-weight:400;color:var(--muted);white-space:nowrap}.overview-bars b{text-align:right;font-variant-numeric:tabular-nums}
.overview-bar-track{height:8px;border-radius:999px;background:var(--accent-soft);overflow:hidden}.overview-bar-track i{display:block;height:100%;background:var(--accent);border-radius:999px}
.preference-map{margin:28px 0}.preference-rows{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 44px;margin-top:28px}
.preference-row h3{font-size:var(--text-md)}.preference-rail{height:6px;background:linear-gradient(90deg,var(--accent-soft),var(--border),var(--accent-soft));border-radius:999px;position:relative;margin:22px 8px 14px}
.preference-rail i{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:15px;height:15px;border-radius:50%;background:var(--card);border:2px dashed var(--muted)}
.preference-rail.unclear{background:var(--border)}.preference-rail i.at-first{left:0;border:2px solid var(--accent);background:var(--accent)}.preference-rail i.at-second{left:100%;border:2px solid var(--accent);background:var(--accent)}
.preference-sides{list-style:none;margin:10px 0 0;padding:0;font-size:var(--text-xs);color:var(--muted);line-height:1.6}.preference-sides b{color:var(--fg);font-weight:600}
.preference-ends{display:flex;justify-content:space-between;font-size:var(--text-sm);color:var(--muted)}.preference-status{font-size:var(--text-xs);margin-top:10px;color:var(--muted)}
.page-turn{margin:var(--space-6) 0;padding:var(--space-2) var(--space-4);border:1px solid var(--border)}
.report-view details[open]>summary{margin-bottom:14px}.report-view blockquote{line-height:1.85}
@media(max-width:640px){.overview-charts,.preference-rows{grid-template-columns:1fr}.view-nav{width:100%}.view-nav label{flex:1;text-align:center;padding:var(--space-2)}.overview-bars li{gap:8px}}
@media print{.view-nav,.page-turn,.switch{display:none!important}.report-view{display:block!important;animation:none}.report-view-detail{break-before:page}.panel,.portrait-chapter,.preference-row{break-inside:avoid}.page{max-width:none;padding:0}}
`
