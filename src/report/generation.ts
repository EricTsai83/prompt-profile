import type { Profile } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { GENERATION_MESSAGES } from "./messages.ts"
import type { Visibility } from "./visibility.ts"

/** Secondary operational detail, absent from cards and covered by the usage exclusion. */
export const generationSection = (p: Profile, loc: Loc, v: Visibility): Raw | null => {
  if (!v.usage) return null
  const text = (
    pick: (t: (typeof GENERATION_MESSAGES)[keyof typeof GENERATION_MESSAGES]) => string,
  ) => loc.text((_m, _c, l) => pick(GENERATION_MESSAGES[l]))
  const g = p.generation
  if (!g)
    return html`<section class="panel"><h2>${text((t) => t.title)}</h2><p>${text((t) => t.unavailable)}</p></section>`
  const s = g.summary
  const row = (label: Raw, value: Raw | string | number) =>
    html`<div><dt>${label}</dt><dd>${value}</dd></div>`
  return html`<section class="panel" id="report-generation">
    <h2>${text((t) => t.title)}</h2><p>${text((t) => t.note)}</p>
    <dl class="generation-facts">
      ${row(
        text((t) => t.identity),
        g.executionId,
      )}
      ${row(
        text((t) => t.languages),
        text((t) =>
          g.languages
            .map((l) => `${l.language}: ${l.available ? t.available : t.missing}`)
            .join(" · "),
        ),
      )}
      ${row(
        text((t) => t.outcome),
        text((t) => t.outcomes[g.outcome]),
      )}
      ${row(
        text((t) => t.calls),
        `${s.calls} / ${s.retries}`,
      )}
      ${row(
        text((t) => t.cache),
        s.localCacheHits,
      )}
      ${row(
        text((t) => t.duration),
        `${s.wallDurationMs} / ${s.callDurationMs}`,
      )}
      ${row(
        text((t) => t.tokens),
        s.tokens.total,
      )}
      ${row(
        text((t) => t.input),
        `${s.tokens.subtotal.input} / ${s.tokens.subtotal.output} / ${s.tokens.subtotal.cacheRead}`,
      )}
      ${row(
        text((t) => t.writes),
        `${s.tokens.subtotal.cacheWrite5m} / ${s.tokens.subtotal.cacheWrite1h} / ${s.tokens.subtotal.cacheWriteUnknown}`,
      )}
      ${row(
        text((t) => t.coverage),
        text((t) => `${t.states[s.tokens.state]} / ${s.tokens.unknownAttempts}`),
      )}
      ${row(
        text((t) => t.cost),
        s.cost.usd.toFixed(6),
      )}
      ${row(
        text((t) => t.coverage),
        text((t) => `${t.states[s.cost.state]} / ${s.cost.unknownAttempts}`),
      )}
      ${row(
        text((t) => t.costKinds),
        `${s.cost.reportedAttempts} / ${s.cost.estimatedAttempts} / ${s.cost.unknownAttempts}`,
      )}
      ${row(
        text((t) => t.models),
        html`${g.models.map((m) => html`<p>${m.engine}: ${m.model ?? text((t) => t.unknown)} (${text((t) => (m.source === "reported" ? t.reported : m.source === "requested" ? t.requested : t.unknown))})</p>`)}`,
      )}
    </dl><p>${text((t) => t.reasoning)}</p>
  </section>`
}
