import {
  type Language,
  type Profile,
  TOKEN_KINDS,
  totalTokens,
  type SourceUsage,
  type UsageBucket,
} from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { MESSAGES, USAGE_MESSAGES } from "./messages.ts"
import { defined, definition } from "./definition.ts"
import type { Visibility } from "./visibility.ts"

/**
 * "Usage during this period" (plan 23), in the factual view only: per tool its plan, tokens by
 * kind and API list-price equivalent, then the share between the tools, months and models.
 * The identity HTML view omits usage; cards use a separate compact measured summary.
 * Never a ranking. Four states are told apart: not measured
 * (an older profile), unknown plan, unknown price and unreadable logs.
 */

const TOOL_NAMES = { "claude-code": "Claude Code", codex: "Codex" } as const

const tokensText = (n: number, lang: Language) =>
  new Intl.NumberFormat(MESSAGES[lang].locale, {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n)

const countText = (n: number, lang: Language) =>
  new Intl.NumberFormat(MESSAGES[lang].locale).format(n)

const usd = (amount: number, lang: Language) =>
  new Intl.NumberFormat(MESSAGES[lang].locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

/** The amount as stated: unknown, partial (some responses unpriced) or complete. */
const costText = (b: UsageBucket, lang: Language): string => {
  const t = USAGE_MESSAGES[lang]
  if (b.cost === null) return b.requests === 0 ? "—" : t.costUnknown
  return b.unpricedRequests > 0
    ? t.costPartial(usd(b.cost, lang), countText(b.unpricedRequests, lang))
    : usd(b.cost, lang)
}

const planText = (s: SourceUsage, lang: Language): string => {
  const t = USAGE_MESSAGES[lang]
  const main =
    s.plan.kind === "subscription" && s.plan.name !== null
      ? s.plan.name
      : s.plan.kind === "api-key"
        ? t.planApiKey
        : t.planUnknown
  return s.plan.detail === null ? main : `${main} (${t.planHint(s.plan.detail)})`
}

const toolCard = (s: SourceUsage, loc: Loc): Raw => {
  const u = (pick: (t: (typeof USAGE_MESSAGES)[Language], l: Language) => string) =>
    loc.text((_m, _c, l) => pick(USAGE_MESSAGES[l], l))
  const total = totalTokens(s.totals.tokens)
  const kinds = TOKEN_KINDS.filter((k) => s.totals.tokens[k] > 0)
  const d = s.diagnostics
  return html`<article class="panel usage-tool">
    ${
      kinds.length > 0
        ? defined(
            html`<h3>${TOOL_NAMES[s.source]}</h3>`,
            definition(
              loc,
              u((t) => t.kindsNote),
            ),
          )
        : html`<h3>${TOOL_NAMES[s.source]}</h3>`
    }
    <dl class="usage-facts">
      <div><dt>${u((t) => t.plan)}</dt><dd>${u((_t, l) => planText(s, l))}</dd></div>
      ${
        s.totals.requests === 0
          ? ""
          : html`<div><dt>${u((t) => t.totalTokens)}</dt><dd>${u((_t, l) => tokensText(total, l))}</dd></div>
              <div><dt>${u((t) => t.cost)}</dt><dd>${u((_t, l) => costText(s.totals, l))}</dd></div>
              <div><dt>${u((t) => t.responses)}</dt><dd>${u((_t, l) => countText(s.totals.requests, l))}</dd></div>`
      }
    </dl>
    ${s.totals.requests === 0 ? html`<p class="usage-none">${u((t) => t.noneForTool)}</p>` : ""}
    ${
      kinds.length > 0
        ? html`<ul class="shares usage-kinds" aria-label="${loc.attr((_m, _c, l) => USAGE_MESSAGES[l].kindsNote)}">
            ${kinds.map(
              (k) => html`<li>
                <span class="share-label">${u((t) => t.kinds[k])}</span>
                <span class="share-track"
                  ><span
                    class="share-fill"
                    style="width:${((100 * s.totals.tokens[k]) / Math.max(1, total)).toFixed(1)}%"
                  ></span
                ></span>
                <b>${u((_t, l) => tokensText(s.totals.tokens[k], l))}</b>
              </li>`,
            )}
          </ul>`
        : ""
    }
    ${
      s.totals.fastRequests > 0
        ? html`<p class="note">${u((t, l) => t.fast(countText(s.totals.fastRequests, l)))}</p>`
        : ""
    }
    ${
      s.unpricedModels.length > 0
        ? html`<p class="usage-state">${u((t) => t.unpriced(s.unpricedModels.join(", ")))}</p>`
        : ""
    }
    ${
      d.unreadableFiles > 0 || d.badLines > 0
        ? html`<p class="usage-state">${u((t) => t.unreadable(d.unreadableFiles, d.badLines))}</p>`
        : ""
    }
  </article>`
}

const shareRows = (sources: ReadonlyArray<SourceUsage>, value: (s: SourceUsage) => number): Raw => {
  const sum = sources.reduce((n, s) => n + value(s), 0)
  return html`${sources.map((s) => {
    const share = sum === 0 ? 0 : (100 * value(s)) / sum
    return html`<li>
      <span class="share-label">${TOOL_NAMES[s.source]}</span>
      <span class="share-track"><span class="share-fill" style="width:${share.toFixed(1)}%"></span></span>
      <b>${Math.round(share)}%</b>
    </li>`
  })}`
}

export const usageSection = (
  p: Profile,
  loc: Loc,
  v: Visibility,
  period: (lang: Language) => string,
): Raw | null => {
  if (!v.usage) return null
  const u = (pick: (t: (typeof USAGE_MESSAGES)[Language], l: Language) => string) =>
    loc.text((_m, _c, l) => pick(USAGE_MESSAGES[l], l))
  const head = (note: Raw | null) => html`<div class="section-head">
      ${note === null ? html`<h2>${u((t) => t.title)}</h2>` : defined(html`<h2>${u((t) => t.title)}</h2>`, definition(loc, note))}
    </div>`
  if (p.usage === null)
    return html`<section class="usage">
      ${head(null)}
      <p class="usage-state">${u((t) => t.notMeasured)}</p>
    </section>`
  const usage = p.usage
  const sources = usage.sources
  const active = sources.filter((s) => s.totals.requests > 0)
  const months = [...new Set(active.flatMap((s) => s.byMonth.map((m) => m.month)))].toSorted()
  const priced = active.filter((s) => s.totals.cost !== null)
  return html`<section class="usage">
    ${head(u((t, l) => t.note(period(l), usage.pricingVersion)))}
    ${active.length === 0 ? html`<p class="usage-state">${u((t) => t.nothing)}</p>` : ""}
    <div class="usage-tools">${sources.map((s) => toolCard(s, loc))}</div>
    ${
      active.length > 1
        ? html`<article class="panel usage-share">
            <h3>${u((t) => t.share)}</h3>
            <div class="usage-share-grid">
              <div>
                <p class="sub">${u((t) => t.shareTokens)}</p>
                <ul class="shares">${shareRows(active, (s) => totalTokens(s.totals.tokens))}</ul>
              </div>
              ${
                priced.length > 1
                  ? html`<div>
                      <p class="sub">${u((t) => t.shareCost)}</p>
                      <ul class="shares">${shareRows(priced, (s) => s.totals.cost ?? 0)}</ul>
                    </div>`
                  : ""
              }
            </div>
          </article>`
        : ""
    }
    ${
      months.length > 0
        ? html`<article class="panel usage-table">
            ${defined(
              html`<h3>${u((t) => t.byMonth)}</h3>`,
              definition(
                loc,
                u((t) => t.monthNote(p.stats.timezone)),
              ),
            )}
            <div
              class="usage-scroll"
              role="region"
              tabindex="0"
              aria-label="${loc.attr((_m, _c, l) => USAGE_MESSAGES[l].byMonth)}"
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">${u((t) => t.month)}</th>
                    ${active.map(
                      (s) =>
                        html`<th scope="col">${TOOL_NAMES[s.source]} · ${u((t) => t.totalTokens)}</th>
                          <th scope="col">${TOOL_NAMES[s.source]} · ${u((t) => t.cost)}</th>`,
                    )}
                  </tr>
                </thead>
                <tbody>
                  ${months.map(
                    (month) => html`<tr>
                      <th scope="row">${month}</th>
                      ${active.map((s) => {
                        const b = s.byMonth.find((m) => m.month === month)?.usage
                        return b === undefined
                          ? html`<td>—</td><td>—</td>`
                          : html`<td>${u((_t, l) => tokensText(totalTokens(b.tokens), l))}</td>
                              <td>${u((_t, l) => costText(b, l))}</td>`
                      })}
                    </tr>`,
                  )}
                </tbody>
              </table>
            </div>
          </article>
          <article class="panel usage-table">
            <h3>${u((t) => t.byModel)}</h3>
            <div
              class="usage-scroll"
              role="region"
              tabindex="0"
              aria-label="${loc.attr((_m, _c, l) => USAGE_MESSAGES[l].byModel)}"
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">${u((t) => t.model)}</th>
                    <th scope="col">${u((t) => t.tool)}</th>
                    <th scope="col">${u((t) => t.totalTokens)}</th>
                    <th scope="col">${u((t) => t.responses)}</th>
                    <th scope="col">${u((t) => t.cost)}</th>
                  </tr>
                </thead>
                <tbody>
                  ${active.flatMap((s) =>
                    s.byModel.map(
                      (m) => html`<tr>
                        <th scope="row">${m.model ?? u((t) => t.unknownModel)}</th>
                        <td>${TOOL_NAMES[s.source]}</td>
                        <td>${u((_t, l) => tokensText(totalTokens(m.usage.tokens), l))}</td>
                        <td>${u((_t, l) => countText(m.usage.requests, l))}</td>
                        <td>${u((_t, l) => costText(m.usage, l))}</td>
                      </tr>`,
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </article>`
        : ""
    }
  </section>`
}

export const usageStyle = `
.usage-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:12px}
.usage-tool{display:flex;flex-direction:column;gap:10px}
.usage-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px 18px;margin:0}
.usage-facts dt{font-size:var(--text-2xs);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.usage-facts dd{margin:2px 0 0;font-weight:600;font-variant-numeric:tabular-nums}
.usage-none{font-size:var(--text-sm);color:var(--muted)}
.usage-kinds li{grid-template-columns:minmax(7em,11em) 1fr minmax(4.5em,auto)}
.usage-state{font-size:var(--text-sm);color:var(--warn);margin:0}
.usage-share-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.usage-scroll{overflow-x:auto}.usage-scroll:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.usage-table table{width:100%;border-collapse:collapse;font-size:var(--text-sm);font-variant-numeric:tabular-nums}
.usage-table th,.usage-table td{padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}
.usage-table th:first-child,.usage-table td:first-child{text-align:left}
.usage-table thead th{font-size:var(--text-2xs);font-weight:600;color:var(--muted)}
@media (max-width:760px){.usage-tools,.usage-share-grid{grid-template-columns:1fr}}
@media print{.usage-scroll{overflow:visible}.usage-table th,.usage-table td{white-space:normal}}
`
