import type { Stats } from "../domain/Stats.ts"
import { peakHour } from "../domain/Stats.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import type { Messages } from "./messages.ts"

/**
 * Charts drawn from `stats` only, as HTML/CSS so they reflow on small screens. Hover (or tap)
 * shows a CSS tooltip from `data-tip-<lang>`; no JavaScript. Project colors are `--p0`… and
 * `--po` (other).
 */

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`
const pct = (n: number, max: number) => (max <= 0 ? 0 : (100 * n) / max).toFixed(1)

/** Tooltip anchor: `tabindex="-1"` makes it tappable without adding a Tab stop. */
const tipClass = (i: number, n: number) => (i < 2 ? "tip tip-l" : i >= n - 2 ? "tip tip-r" : "tip")

/** Project name for slot `i` (the last slot is "other"). */
const projectName = (s: Stats, i: number, m: Messages) => s.activity.projects[i] ?? m.other

const slotColor = (s: Stats, i: number) =>
  i < s.activity.projects.length ? `var(--p${i})` : "var(--po)"

/** "drawstuff 8 · dotfiles 3": the two biggest non-zero slots. */
const topProjects = (s: Stats, counts: ReadonlyArray<number>, m: Messages): string =>
  counts
    .map((n, i) => ({ n, i }))
    .filter((x) => x.n > 0)
    .toSorted((a, b) => b.n - a.n)
    .slice(0, 2)
    .map((x) => `${projectName(s, x.i, m)} ${x.n}`)
    .join(" · ")

/** Format `YYYY-MM-DD` (a calendar date, not an instant) in a language. */
const formatDay = (date: string, m: Messages, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(m.locale, { ...opts, timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  )

const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** Monday of the week containing `date`. */
const mondayOf = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, -((day + 6) % 7))
}

// ---- bars ---------------------------------------------------------------------------------

const columnBars = (
  values: ReadonlyArray<number>,
  highlight: number | null,
  tip: (i: number) => Raw,
  label: (i: number) => Raw | null,
  className: string,
): Raw => {
  const max = Math.max(1, ...values)
  return html`<div class="cols ${className}">
    ${values.map(
      (n, i) =>
        html`<div class="col ${tipClass(i, values.length)}" ${tip(i)} tabindex="-1">
          <span
            class="col-fill${i === highlight ? " peak" : ""}"
            style="height:${n === 0 ? "2px" : `${pct(n, max)}%`}"
          ></span>
          <span class="col-label">${label(i)}</span>
        </div>`,
    )}
  </div>`
}

export const hourChart = (s: Stats, loc: Loc): Raw =>
  html`<div role="img" aria-label="${loc.attr((m) => m.byHour)}">
    ${columnBars(
      s.hourHistogram,
      peakHour(s),
      (h) => loc.tip((m) => m.hourTip(hh(h), s.hourHistogram[h]!)),
      (h) => (h % 6 === 0 ? html`${String(h).padStart(2, "0")}` : null),
      "hours",
    )}
  </div>`

export const weekdayChart = (s: Stats, loc: Loc): Raw => {
  const best = s.weekdayHistogram.indexOf(Math.max(...s.weekdayHistogram))
  return html`<div role="img" aria-label="${loc.attr((m) => m.byWeekday)}">
    ${columnBars(
      s.weekdayHistogram,
      s.weekdayHistogram[best]! > 0 ? best : null,
      (d) => loc.tip((m) => `${m.weekdays[d]} · ${m.prompts(s.weekdayHistogram[d]!)}`),
      (d) => loc.text((m) => m.weekdays[d]!),
      "weekdays",
    )}
  </div>`
}

// ---- heatmap: weekday × hour --------------------------------------------------------------

/** 0 = none, 1–4 by the square root of the share of the busiest cell (small counts stay visible). */
const level = (n: number, max: number) =>
  n === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(4 * Math.sqrt(n / max))))

export const heatmap = (s: Stats, loc: Loc): Raw => {
  const max = Math.max(1, ...s.activityGrid.flat())
  const split = s.activity.gridByProject
  return html`<div class="heat" role="img" aria-label="${loc.attr((m) => m.heatmap)}">
    <span></span>
    ${Array.from(
      { length: 24 },
      (_, h) => html`<span class="heat-h">${h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>`,
    )}
    ${s.activityGrid.map(
      (row, w) =>
        html`<span class="heat-d">${loc.text((m) => m.weekdays[w]!)}</span>${row.map(
          (n, h) =>
            html`<span
                class="heat-c l${level(n, max)} ${tipClass(h, 24)}"
                ${loc.tip((m) =>
                  [
                    m.cellTip(m.weekdays[w]!, hh(h)),
                    m.prompts(n),
                    split[w]?.[h] ? topProjects(s, split[w]![h]!, m) : "",
                  ]
                    .filter((x) => x !== "")
                    .join(" · "),
                )}
                tabindex="-1"
              ></span>`,
        )}`,
    )}
  </div>`
}

const legend = (loc: Loc): Raw =>
  html`<div class="scale">
    ${loc.text((m) => m.less)}${[0, 1, 2, 3, 4].map((l) => html`<i class="l${l}"></i>`)}${loc.text(
      (m) => m.more,
    )}
  </div>`

// ---- calendar: one square per day ---------------------------------------------------------

export const calendar = (s: Stats, loc: Loc): Raw | null => {
  const days = s.activity.days
  if (days.length === 0) return null
  const byDate = new Map(days.map((d) => [d.date, d]))
  const max = Math.max(1, ...days.map((d) => d.count))
  const first = mondayOf(days[0]!.date)
  const last = days.at(-1)!.date
  const weeks: Array<string> = []
  for (let w = first; w <= last; w = addDays(w, 7)) weeks.push(w)
  return html`<div class="cal" role="img" aria-label="${loc.attr((m) => m.daily)}">
    ${weeks.map((monday, wi) => {
      const firstOfMonth = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).find((d) =>
        d.endsWith("-01"),
      )
      return html`<div class="cal-w">
        <span class="cal-m"
          >${
            wi === 0 || firstOfMonth
              ? loc.text((m) => formatDay(firstOfMonth ?? monday, m, { month: "short" }))
              : ""
          }</span
        >
        ${Array.from({ length: 7 }, (_, i) => {
          const date = addDays(monday, i)
          const d = byDate.get(date)
          if (date > last || date < days[0]!.date) return html`<span class="cal-d out"></span>`
          return html`<span
            class="cal-d l${level(d?.count ?? 0, max)} ${tipClass(wi, weeks.length)}"
            ${loc.tip((m) =>
              [
                formatDay(date, m, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  weekday: "short",
                }),
                m.prompts(d?.count ?? 0),
                d ? topProjects(s, d.byProject, m) : "",
              ]
                .filter((x) => x !== "")
                .join(" · "),
            )}
            tabindex="-1"
          ></span>`
        })}
      </div>`
    })}
  </div>
  ${legend(loc)}`
}

// ---- projects -----------------------------------------------------------------------------

/** Totals per slot (projects, then other) from the daily split. */
const projectTotals = (s: Stats): Array<number> => {
  const slots = s.activity.projects.length + 1
  const totals = Array.from({ length: slots }, () => 0)
  for (const d of s.activity.days) d.byProject.forEach((n, i) => (totals[i]! += n))
  return totals
}

export const projectRanking = (s: Stats, loc: Loc): Raw | null => {
  if (s.activity.projects.length === 0) return null
  const totals = projectTotals(s)
  const sum = Math.max(
    1,
    totals.reduce((a, b) => a + b, 0),
  )
  const max = Math.max(1, ...totals)
  const rows = totals.map((n, i) => ({ n, i })).filter((r) => r.n > 0)
  return html`<ul class="ranks">
    ${rows.map(
      (r) =>
        html`<li>
          <span class="rank-name"
            ><i class="dot" style="background:${slotColor(s, r.i)}"></i>${
              r.i < s.activity.projects.length
                ? html`${s.activity.projects[r.i]}`
                : loc.text((m) => m.other)
            }</span
          >
          <span class="share-track"
            ><span
              class="share-fill"
              style="width:${pct(r.n, max)}%;background:${slotColor(s, r.i)}"
            ></span
          ></span>
          <b>${Math.round((100 * r.n) / sum)}%</b>
        </li>`,
    )}
  </ul>`
}

export const projectWeeks = (s: Stats, loc: Loc): Raw | null => {
  const days = s.activity.days
  if (days.length === 0 || s.activity.projects.length === 0) return null
  const slots = s.activity.projects.length + 1
  const weeks = new Map<string, Array<number>>()
  for (let w = mondayOf(days[0]!.date); w <= days.at(-1)!.date; w = addDays(w, 7))
    weeks.set(
      w,
      Array.from({ length: slots }, () => 0),
    )
  for (const d of days) {
    const counts = weeks.get(mondayOf(d.date))!
    d.byProject.forEach((n, i) => (counts[i]! += n))
  }
  const entries = [...weeks.entries()]
  const max = Math.max(1, ...entries.map(([, c]) => c.reduce((a, b) => a + b, 0)))
  return html`<div class="stack" role="img" aria-label="${loc.attr((m) => m.projectsByWeek)}">
    ${entries.map(([monday, counts], wi) => {
      const total = counts.reduce((a, b) => a + b, 0)
      return html`<div
        class="stack-w ${tipClass(wi, entries.length)}"
        ${loc.tip((m) =>
          [
            m.weekOf(formatDay(monday, m, { month: "short", day: "numeric" })),
            m.prompts(total),
            topProjects(s, counts, m),
          ]
            .filter((x) => x !== "")
            .join(" · "),
        )}
        tabindex="-1"
      >
        <span class="stack-bar" style="height:${total === 0 ? "2px" : `${pct(total, max)}%`}"
          >${counts.map((n, i) =>
            n === 0 ? "" : html`<span style="flex:${n};background:${slotColor(s, i)}"></span>`,
          )}</span
        >
      </div>`
    })}
  </div>`
}

/** CSS for the charts and tooltips; `langs` selects the tooltip attribute per language. */
export const chartStyle = (langs: ReadonlyArray<string>): string => `
.cols{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:4px;height:170px;align-items:end}
.hours{--n:24}.weekdays{--n:7;gap:10px}
.col{position:relative;display:flex;flex-direction:column;justify-content:flex-end;height:100%;padding-bottom:20px;outline:none}
.col-fill{display:block;border-radius:4px 4px 2px 2px;background:var(--accent);opacity:.35;transition:opacity .15s}
.col-fill.peak,.col:hover .col-fill,.col:focus .col-fill{opacity:1}
.col-label{position:absolute;bottom:0;left:50%;transform:translateX(-50%);font-size:11px;color:var(--muted);white-space:nowrap}
.heat{display:grid;grid-template-columns:28px repeat(24,minmax(0,1fr));gap:3px;margin-top:12px}
.heat-h{font-size:10px;color:var(--muted);text-align:left}
.heat-d{font-size:11px;color:var(--muted);align-self:center}
.heat-c,.cal-d{position:relative;border-radius:3px;background:var(--empty);outline:none}
.heat-c{height:22px}
.cal-d{aspect-ratio:1}
:is(.heat-c,.cal-d,.scale i).l1{background:color-mix(in srgb,var(--accent) 28%,var(--empty))}
:is(.heat-c,.cal-d,.scale i).l2{background:color-mix(in srgb,var(--accent) 52%,var(--empty))}
:is(.heat-c,.cal-d,.scale i).l3{background:color-mix(in srgb,var(--accent) 76%,var(--empty))}
:is(.heat-c,.cal-d,.scale i).l4{background:var(--accent)}
.heat-c:hover,.heat-c:focus,.cal-d:hover,.cal-d:focus{box-shadow:0 0 0 2px var(--fg)}
.cal{display:flex;gap:3px;margin-top:8px}
.cal-w{display:grid;grid-template-rows:16px repeat(7,auto);gap:3px;flex:1;min-width:0;max-width:30px}
.cal-m{font-size:10px;color:var(--muted);white-space:nowrap;overflow:visible}
.cal-d.out{background:transparent}
.scale{display:flex;align-items:center;gap:3px;justify-content:flex-end;font-size:11px;color:var(--muted);margin-top:10px}
.scale i{width:11px;height:11px;border-radius:3px;background:var(--empty)}
.scale i:first-of-type{margin-left:6px}.scale i:last-of-type{margin-right:6px}
.ranks{list-style:none;margin:0;padding:0}
.ranks li{display:grid;grid-template-columns:minmax(0,10em) 1fr 38px;align-items:center;gap:10px;font-size:13px;margin:9px 0}
.rank-name{display:flex;align-items:center;gap:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ranks b{text-align:right;font-size:12px}
.stack{display:flex;align-items:flex-end;gap:3px;height:170px;margin-top:8px}
.stack-w{position:relative;flex:1;height:100%;display:flex;align-items:flex-end;outline:none}
.stack-bar{display:flex;flex-direction:column-reverse;width:100%;border-radius:3px;overflow:hidden;opacity:.9}
.stack-w:hover .stack-bar,.stack-w:focus .stack-bar{opacity:1;box-shadow:0 0 0 2px var(--fg)}
.tip{cursor:default}
.tip:hover::after,.tip:focus::after{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);z-index:20;width:max-content;max-width:min(240px,80vw);padding:6px 9px;border-radius:8px;background:var(--fg);color:var(--bg);font-size:12px;line-height:1.4;font-weight:500;white-space:normal;text-align:left;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.tip-l:hover::after,.tip-l:focus::after{left:0;transform:none}
.tip-r:hover::after,.tip-r:focus::after{left:auto;right:0;transform:none}
${
  langs.length === 1
    ? `.tip:hover::after,.tip:focus::after{content:attr(data-tip-${langs[0]})}`
    : langs
        .map(
          (l) =>
            `#lang-${l}:checked~.page .tip:hover::after,#lang-${l}:checked~.page .tip:focus::after{content:attr(data-tip-${l})}`,
        )
        .join("\n")
}
@media (max-width:640px){
.cal-w:nth-last-child(n+19){display:none}
.cols{height:140px}.hours{gap:2px}
.heat{grid-template-columns:20px repeat(24,minmax(0,1fr));gap:2px}
.heat-c{height:14px}
.heat-h{font-size:9px}
.stack{height:140px;gap:2px}
}
`
