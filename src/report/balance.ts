import { MIN_BALANCE_CONVERSATIONS, type Profile } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { BALANCE_MESSAGES, PORTRAIT_MESSAGES } from "./messages.ts"

/**
 * One scale per axis: the share of conversations that show each way of working. Axes with
 * fewer than MIN_BALANCE_CONVERSATIONS conversations behind them are left out; nothing is
 * shown for a profile without a measurement.
 */
export const axisBalanceSection = (p: Profile, loc: Loc): Raw | null => {
  const axes = (p.axisBalance?.axes ?? []).filter(
    (a) => a.first + a.second >= MIN_BALANCE_CONVERSATIONS,
  )
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
@media print{.balance-axis{break-inside:avoid}}
`
