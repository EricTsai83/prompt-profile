import { TOKEN_KINDS, type Profile } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { formatDuration } from "./format.ts"
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
  const number = (n: number) => loc.text((_m, _c, l) => new Intl.NumberFormat(l).format(n))
  const usd = (n: number) =>
    loc.text((_m, _c, l) =>
      new Intl.NumberFormat(l, {
        style: "currency",
        currency: "USD",
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 4,
        maximumFractionDigits: 6,
      }).format(n),
    )
  const row = (label: Raw, value: Raw | string | number) =>
    html`<div><dt>${label}</dt><dd>${value}</dd></div>`
  const costKnown = s.cost.state !== "unavailable"
  const tokenKnown = s.tokens.state !== "unavailable"
  // Legacy summaries cannot distinguish an unreported zero from a measured zero per kind.
  // Keep positive subtotals; show zero only when new coverage metadata proves it was measured.
  const kinds = TOKEN_KINDS.filter(
    (k) =>
      k !== "reasoning" &&
      tokenKnown &&
      (s.tokens.subtotal[k] > 0 ||
        (!k.startsWith("cacheWrite") && s.calls > 0 && s.tokens.measuredAttempts?.[k] === s.calls)),
  )
  const breakdown = s.cost.breakdown?.filter((b) => b.reportedUsd + b.estimatedUsd > 0) ?? []
  const maxCost = Math.max(0, ...breakdown.map((b) => b.reportedUsd + b.estimatedUsd))
  const bar = (amount: number, total: number, estimated = false) =>
    html`<span class="generation-bar${estimated ? " generation-estimated" : ""}" style="width:${total > 0 ? ((amount / total) * 100).toFixed(3) : 0}%"></span>`
  return html`<section class="panel" id="report-generation">
    <h2>${text((t) => t.title)}</h2><p>${text((t) => t.note)}</p>
    <dl class="generation-summary">
      <div><dt>${text((t) => t.elapsed)}</dt><dd>${loc.text((_m, _c, l) => formatDuration(s.wallDurationMs, l))}</dd></div>
      <div><dt>${text((t) => t.tokens)}</dt><dd>${tokenKnown ? number(s.tokens.total) : text((t) => t.tokenMissing)}</dd><dd class="note">${text((t) => t.states[s.tokens.state])}</dd></div>
      <div><dt>${text((t) => t.cost)}</dt><dd>${costKnown ? usd(s.cost.usd) : text((t) => t.costUnavailable)}</dd><dd class="note">${costKnown ? text((t) => (s.cost.state === "partial" ? t.subtotal : t.states[s.cost.state])) : ""}</dd></div>
    </dl>
    ${s.calls === 0 ? html`<p class="note">${text((t) => t.noCalls)}</p>` : ""}
    <div class="generation-charts">
      <div class="generation-token-chart">
        <h3>${text((t) => t.tokenTitle)}</h3><p class="note">${text((t) => t.tokenUnit)}</p>
        ${
          kinds.length
            ? html`<ul class="generation-bars">${kinds.map(
                (k) => html`<li data-token-kind="${k}">
          <div class="generation-bar-label"><span>${text((t) => t.tokenKinds[k])}</span><b>${number(s.tokens.subtotal[k])}</b></div>
          <span class="generation-track" aria-hidden="true">${bar(s.tokens.subtotal[k], s.tokens.total)}</span>
          ${s.tokens.measuredAttempts && s.tokens.measuredAttempts[k] < s.calls ? html`<small>${text((t) => t.kindCoverage(s.tokens.measuredAttempts![k], s.calls))}</small>` : ""}
        </li>`,
              )}</ul>`
            : html`<p>${text((t) => (tokenKnown ? t.states[s.tokens.state] : t.tokenMissing))}</p>`
        }
        ${s.tokens.unknownAttempts > 0 ? html`<p class="note">${text((t) => t.tokenCoverage(s.tokens.unknownAttempts, s.calls))}</p>` : ""}
        <p class="note">${text((t) => t.omitted)}</p><p class="note">${text((t) => t.reasoning)}</p>
      </div>
      <div>
        <h3>${text((t) => t.costChart)}</h3>
        ${costKnown ? html`<p class="note">${text((t) => t.costChartNote)}</p>` : html`<p>${text((t) => t.costMissing)}</p>`}
        ${
          breakdown.length && costKnown
            ? html`<ul class="generation-cost-chart">${breakdown.map(
                (b) => html`<li>
          <div class="generation-bar-label"><span>${text((t) => t.stageNames[b.stage])}</span><b>${usd(b.reportedUsd + b.estimatedUsd)}</b></div>
          <span class="generation-track" aria-hidden="true">${bar(b.reportedUsd, maxCost)}${bar(b.estimatedUsd, maxCost, true)}</span>
          ${b.reportedUsd > 0 ? html`<small>${text((t) => t.reportedCost)}: ${usd(b.reportedUsd)}</small>` : ""}
          ${b.estimatedUsd > 0 ? html`<small>${text((t) => t.estimatedCost)}: ${usd(b.estimatedUsd)}</small>` : ""}
        </li>`,
              )}</ul>`
            : costKnown && s.calls > 0 && !s.cost.breakdown
              ? html`<p class="note">${text((t) => t.noBreakdown)}</p>`
              : ""
        }
        <p class="note">${text((t) => t.costCoverage(s.calls - s.cost.unknownAttempts, s.calls))}</p>
        ${s.cost.reportedAttempts > 0 ? html`<p class="note">${text((t) => t.reportedCost)}: ${number(s.cost.reportedAttempts)}</p>` : ""}
        ${s.cost.estimatedAttempts > 0 ? html`<p class="note">${text((t) => t.estimatedCost)}: ${number(s.cost.estimatedAttempts)}</p>` : ""}
        ${s.cost.state === "partial" || s.tokens.state === "partial" ? html`<p class="note">${text((t) => t.partialNote)}</p>` : ""}
      </div>
    </div>
    <details class="generation-details"><summary>${text((t) => t.details)}</summary><dl class="generation-facts">
      ${row(
        text((t) => t.callDuration),
        html`${loc.text((_m, _c, l) => formatDuration(s.callDurationMs, l))}<p class="note">${text((t) => t.parallelTime)}</p>`,
      )}
      ${row(
        text((t) => t.calls),
        `${s.calls} / ${s.retries}`,
      )}
      ${row(
        text((t) => t.cache),
        number(s.localCacheHits),
      )}
      ${row(
        text((t) => t.outcome),
        text((t) => t.outcomes[g.outcome]),
      )}
      ${row(
        text((t) => t.models),
        html`${g.models.map((m) => html`<p>${m.engine}: ${m.model ?? text((t) => t.unknown)} (${text((t) => (m.source === "reported" ? t.reported : m.source === "requested" ? t.requested : t.unknown))})</p>`)}`,
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
        text((t) => t.identity),
        g.executionId,
      )}
    </dl></details>
  </section>`
}
