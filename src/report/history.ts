import { DateTime } from "effect"
import type { Profile } from "../domain/Profile.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { HISTORY_MESSAGES, PORTRAIT_MESSAGES } from "./messages.ts"
import type { Scrub, Visibility } from "./visibility.ts"
import { defined, definition } from "./definition.ts"
import { sourceLabel } from "./evidence-origin.ts"

export const historySection = (p: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw | null => {
  const h = p.historyComparison
  if (!h?.changes.length) return null
  const window = (which: "previousWindow" | "currentWindow") =>
    loc.text((m) => {
      const format = (t: DateTime.Utc) =>
        new Intl.DateTimeFormat(m.locale, {
          timeZone: p.stats.timezone,
          year: "numeric",
          month: "short",
          ...(v.dates ? { day: "numeric" as const } : {}),
        }).format(DateTime.toEpochMillis(t))
      return `${format(h[which].since)} → ${format(h[which].until)}`
    })
  return html`<section class="history-comparison">
    ${defined(
      html`<h2>${loc.text((_m, _c, l) => HISTORY_MESSAGES[l].title)}</h2>`,
      definition(
        loc,
        loc.text((_m, _c, l) => HISTORY_MESSAGES[l].note),
      ),
    )}
    <p>${loc.text((_m, _c, l) => HISTORY_MESSAGES[l].earlier)}: ${window("previousWindow")}</p><p>${loc.text((_m, _c, l) => HISTORY_MESSAGES[l].current)}: ${window("currentWindow")}</p>
    ${h.changes.map(
      (c) => html`<article><h3>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[c.key][0])}</h3>
      <p>${loc.text((_m, _c, l) => (c.before === "both" ? PORTRAIT_MESSAGES[l].both : PORTRAIT_MESSAGES[l].axes[c.key][c.before === "first" ? 1 : 2]))} → ${loc.text((_m, _c, l) => (c.after === "both" ? PORTRAIT_MESSAGES[l].both : PORTRAIT_MESSAGES[l].axes[c.key][c.after === "first" ? 1 : 2]))}</p>
      <h4>${loc.text((_m, _c, l) => HISTORY_MESSAGES[l].earlier)}</h4><p>${loc.text((_m, _c, l) => scrub(c.previousContexts.join(" · "), l))}</p>
      ${v.quotes ? c.previousEvidence.map((e) => html`<blockquote>${loc.text((_m, _c, l) => scrub(e.quote, l))}${sourceLabel(p, e.promptId, loc, v, c.previousSources)}</blockquote>`) : ""}
      <h4>${loc.text((_m, _c, l) => HISTORY_MESSAGES[l].current)}</h4><p>${loc.text((_m, _c, l) => scrub(c.contexts.join(" · "), l))}</p>
      ${v.quotes ? c.evidence.map((e) => html`<blockquote>${loc.text((_m, _c, l) => scrub(e.quote, l))}${sourceLabel(p, e.promptId, loc, v)}</blockquote>`) : ""}
    </article>`,
    )}
  </section>`
}
export const historyStyle = `.history-comparison{margin:36px 0}.history-comparison h2{font-size:var(--text-xl)}.history-comparison article{padding:20px 0;border-top:1px solid var(--border)}.history-comparison h3{font-size:var(--text-lg);margin-bottom:12px}.history-comparison h4{margin-top:20px}.history-comparison p{line-height:1.8}.history-comparison blockquote{margin:12px 0;padding-left:16px;border-left:2px solid var(--accent);line-height:1.8;overflow-wrap:anywhere}.quote-source{display:block;margin-top:8px;font-size:var(--text-xs);color:var(--muted)}`
