import { type Profile, PROMPT_TECHNIQUES, TOOL_TECHNIQUES } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { viewMessages } from "./messages.ts"
import { defined, definition } from "./definition.ts"

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
.overview-charts h2{font-size:var(--text-xl)}.overview-charts .note{margin-top:12px;line-height:1.7;font-size:var(--text-sm);color:var(--muted)}
.overview-bars{list-style:none;margin:24px 0 0;padding:0;display:grid;gap:16px}
.overview-bars li{display:grid;grid-template-columns:minmax(80px,1fr) minmax(40px,1fr) minmax(44px,max-content);gap:12px;align-items:center;font-size:var(--text-sm)}
.overview-bars small{display:block;font-size:var(--text-2xs);font-weight:400;color:var(--muted);white-space:nowrap}.overview-bars b{text-align:right;font-variant-numeric:tabular-nums}
.overview-bar-track{height:8px;border-radius:999px;background:var(--accent-soft);overflow:hidden}.overview-bar-track i{display:block;height:100%;background:var(--accent);border-radius:999px}
.page-turn{margin:var(--space-6) 0;padding:var(--space-2) var(--space-4);border:1px solid var(--border)}
.report-view details[open]>summary{margin-bottom:14px}.report-view blockquote{line-height:1.85}
@media(max-width:640px){.overview-charts{grid-template-columns:1fr}.view-nav{width:100%}.view-nav label{flex:1;text-align:center;padding:var(--space-2)}.overview-bars li{gap:8px}}
@media print{.view-nav,.page-turn,.switch{display:none!important}.report-view{display:block!important;animation:none}.report-view-detail{break-before:page}.panel,.portrait-chapter,.preference-row{break-inside:avoid}.page{max-width:none;padding:0}}
`
