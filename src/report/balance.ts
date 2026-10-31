import { MIN_BALANCE_CONVERSATIONS, type Profile } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { BALANCE_MESSAGES, PORTRAIT_MESSAGES } from "./messages.ts"
import type { Scrub, Visibility } from "./visibility.ts"

/**
 * One scale per axis: the share of conversations that show each way of working. Axes with
 * fewer than MIN_BALANCE_CONVERSATIONS conversations behind them are left out; nothing is
 * shown for a profile without a measurement.
 */
/** The axes with enough conversations behind them to show a share. */
export const measuredAxes = (p: Profile) =>
  (p.axisBalance?.axes ?? []).filter((a) => a.first + a.second >= MIN_BALANCE_CONVERSATIONS)

export const axisBalanceSection = (
  p: Profile,
  loc: Loc,
  v: Visibility,
  scrub: Scrub,
): Raw | null => {
  const axes = measuredAxes(p)
  if (axes.length === 0) return null
  return html`<section class="axis-balance">
    <h2>${loc.text((_m, _c, l) => BALANCE_MESSAGES[l].title)}</h2>
    <p class="note">${loc.text((_m, _c, l) => BALANCE_MESSAGES[l].note)}</p>
    ${axes.map((a) => {
      const total = a.first + a.second
      const first = Math.round((a.first / total) * 100)
      const labels = (l: keyof typeof PORTRAIT_MESSAGES) => PORTRAIT_MESSAGES[l].axes[a.key]
      return html`<div class="balance-axis">
      <div class="balance-head"><b>${loc.text((_m, _c, l) => labels(l)[0])}</b><small>${loc.text((_m, _c, l) => BALANCE_MESSAGES[l].conversations(total))}</small></div>
      <div class="balance-bar" role="img" aria-label="${loc.attr((_m, _c, l) => `${labels(l)[1]} ${first}%, ${labels(l)[2]} ${100 - first}%`)}"><span style="width:${first}%"></span></div>
      <div class="balance-legend"><span>${loc.text((_m, _c, l) => `${labels(l)[1]} ${first}%`)}</span><span>${loc.text((_m, _c, l) => `${labels(l)[2]} ${100 - first}%`)}</span></div>
      ${
        v.quotes && (a.examples.first.length > 0 || a.examples.second.length > 0)
          ? html`<div class="balance-examples">${(["first", "second"] as const).map(
              (pole) =>
                html`<div>${a.examples[pole].map((e) => html`<blockquote>${loc.text((_m, _c, l) => scrub(e.quote, l))}</blockquote>`)}</div>`,
            )}</div>`
          : ""
      }
    </div>`
    })}
  </section>`
}

export const balanceStyle = `
.axis-balance{margin:48px 0}
.axis-balance>.note{margin:12px 0 20px;max-width:var(--reading);color:var(--muted);font-size:var(--text-sm)}
.balance-axis{padding:14px 0;border-top:1px solid var(--border)}
.balance-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.balance-head small{color:var(--muted);font-size:var(--text-sm)}
.balance-bar{display:flex;height:10px;margin:10px 0 8px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--accent) 22%,transparent)}
.balance-bar>span{background:var(--accent)}
.balance-legend{display:flex;justify-content:space-between;gap:12px;font-size:var(--text-sm)}
.balance-examples{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px}
.balance-examples>div:last-child{text-align:right}
.balance-examples blockquote{margin:6px 0;font-size:var(--text-sm);color:var(--muted);line-height:1.6;overflow-wrap:anywhere}
@media(max-width:560px){.balance-examples{grid-template-columns:1fr}.balance-examples>div:last-child{text-align:left}}
@media print{.balance-axis{break-inside:avoid}}
`
