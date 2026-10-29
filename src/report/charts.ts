import type { Stats } from "../domain/Stats.ts"
import { peakHour } from "../domain/Stats.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import type { Messages } from "./messages.ts"
import type { Chapter } from "./derive.ts"
import { CLOCK_DIAL, clockBars } from "./graphic.ts"

/**
 * Charts drawn from `stats` only, as HTML/CSS so they reflow on small screens. Hover (or tap)
 * shows a CSS tooltip from `data-tip-<lang>`; no JavaScript. Project colors are `--p0`… and
 * `--po` (other).
 */

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`

/** What a chart may reveal: `--exclude projects` / `dates` hide names and exact dates. */
export interface ChartView {
  readonly anonymizeProjects: boolean
  readonly showDates: boolean
}

export const PRIVATE_VIEW: ChartView = { anonymizeProjects: false, showDates: true }

/** "Project A", "Project B"… in place of folder names. */
const ANON = "ABCDEFGHIJ"
const pct = (n: number, max: number) => (max <= 0 ? 0 : (100 * n) / max).toFixed(1)

/** Tooltip anchor: `tabindex="-1"` makes it tappable without adding a Tab stop. */
const tipClass = (i: number, n: number) => (i < 2 ? "tip tip-l" : i >= n - 2 ? "tip tip-r" : "tip")

/** Project name for slot `i` (the last slot is "other"). */
export const projectName = (s: Stats, i: number, m: Messages, view: ChartView = PRIVATE_VIEW) =>
  i >= s.activity.projects.length
    ? m.other
    : view.anonymizeProjects
      ? `${m.projectAnon} ${ANON[i]}`
      : s.activity.projects[i]!

const slotColor = (s: Stats, i: number) =>
  i < s.activity.projects.length ? `var(--p${i})` : "var(--po)"

/** "drawstuff 8 · dotfiles 3": the two biggest non-zero slots. */
const topProjects = (
  s: Stats,
  counts: ReadonlyArray<number>,
  m: Messages,
  view: ChartView = PRIVATE_VIEW,
): string =>
  counts
    .map((n, i) => ({ n, i }))
    .filter((x) => x.n > 0)
    .toSorted((a, b) => b.n - a.n)
    .slice(0, 2)
    .map((x) => `${projectName(s, x.i, m, view)} ${x.n}`)
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

/**
 * Weekday × hour with marginal totals: hour bars on top, weekday bars on the right. One chart
 * instead of separate hour, weekday and heatmap panels.
 */
export const heatmap = (s: Stats, loc: Loc, view: ChartView = PRIVATE_VIEW): Raw => {
  const max = Math.max(1, ...s.activityGrid.flat())
  const hourMax = Math.max(1, ...s.hourHistogram)
  const dayMax = Math.max(1, ...s.weekdayHistogram)
  const peak = peakHour(s)
  const split = s.activity.gridByProject
  return html`<div class="heat" role="img" aria-label="${loc.attr((m) => m.heatmap)}">
    <span></span>
    ${s.hourHistogram.map(
      (n, h) =>
        html`<span
          class="heat-top ${tipClass(h, 24)}"
          ${loc.tip((m) => m.hourTip(hh(h), n))}
          tabindex="-1"
          ><i class="${h === peak ? "peak" : ""}" style="height:${n === 0 ? 0 : pct(n, hourMax)}%"></i
        ></span>`,
    )}
    <span></span>
    <span></span>
    ${Array.from(
      { length: 24 },
      (_, h) => html`<span class="heat-h">${h % 3 === 0 ? String(h).padStart(2, "0") : ""}</span>`,
    )}
    <span></span>
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
                    split[w]?.[h] ? topProjects(s, split[w]![h]!, m, view) : "",
                  ]
                    .filter((x) => x !== "")
                    .join(" · "),
                )}
                tabindex="-1"
              ></span>`,
        )}<span
            class="heat-side tip tip-r"
            ${loc.tip((m) => `${m.weekdays[w]} · ${m.prompts(s.weekdayHistogram[w]!)}`)}
            tabindex="-1"
            ><i style="width:${pct(s.weekdayHistogram[w]!, dayMax)}%"></i
          ></span>`,
    )}
  </div>`
}

/** 24 radial bars around a dial; the busiest four hours are drawn in full colour. */
export const radialClock = (
  s: Stats,
  window: { readonly start: number; readonly end: number } | null,
  label: Raw,
): Raw => {
  const bars = clockBars(s.hourHistogram, window).map(
    (b) => html`<path d="M${b.from}L${b.to}" class="${b.on ? "clock-bar on" : "clock-bar"}" />`,
  )
  const ticks = [0, 6, 12, 18].map((h) => {
    const a = (h / 24) * Math.PI * 2 - Math.PI / 2
    return html`<text
      x="${(130 + Math.cos(a) * 50).toFixed(1)}"
      y="${(134 + Math.sin(a) * 50).toFixed(1)}"
      text-anchor="middle"
      class="clock-tick"
      >${String(h).padStart(2, "0")}</text
    >`
  })
  return html`<figure class="clock">
    <svg viewBox="0 0 260 260" aria-hidden="true">
      <circle cx="130" cy="130" r="${CLOCK_DIAL}" class="clock-dial" />
      ${bars}${ticks}
    </svg>
    <figcaption>${label}</figcaption>
  </figure>`
}

/** The chapter strip: one segment per chapter, width by months, coloured by project. */
export const chapterStrip = (
  s: Stats,
  list: ReadonlyArray<Chapter>,
  loc: Loc,
  view: ChartView = PRIVATE_VIEW,
): Raw | null => {
  if (list.length === 0) return null
  const months = (c: Chapter) => {
    const [fy, fm] = c.from.split("-").map(Number) as [number, number]
    const [ty, tm] = c.to.split("-").map(Number) as [number, number]
    return (ty - fy) * 12 + (tm - fm) + 1
  }
  const monthName = (ym: string, m: Messages) =>
    formatDay(`${ym}-01`, m, { month: "short", ...(view.showDates ? {} : {}) })
  return html`<ol class="chapters">
    ${list.map(
      (c) =>
        html`<li style="flex:${months(c)};--c:${slotColor(s, c.slot)}">
          <span class="ch-bar"></span>
          <span class="ch-name">${loc.text((m) => projectName(s, c.slot, m, view))}</span>
          <span class="ch-when"
            >${loc.text((m) => m.chapterRange(monthName(c.from, m), monthName(c.to, m)))} ·
            ${loc.text((m) => m.prompts(c.prompts))}</span
          >
        </li>`,
    )}
  </ol>`
}

const legend = (loc: Loc): Raw =>
  html`<div class="scale">
    ${loc.text((m) => m.less)}${[0, 1, 2, 3, 4].map((l) => html`<i class="l${l}"></i>`)}${loc.text(
      (m) => m.more,
    )}
  </div>`

// ---- calendar: one square per day ---------------------------------------------------------

export const calendar = (s: Stats, loc: Loc, view: ChartView = PRIVATE_VIEW): Raw | null => {
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
                d ? topProjects(s, d.byProject, m, view) : "",
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

export const projectRanking = (s: Stats, loc: Loc, view: ChartView = PRIVATE_VIEW): Raw | null => {
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
            ><i class="dot" style="background:${slotColor(s, r.i)}"></i>${loc.text((m) =>
              projectName(s, r.i, m, view),
            )}</span
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

export const projectWeeks = (s: Stats, loc: Loc, view: ChartView = PRIVATE_VIEW): Raw | null => {
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
            view.showDates
              ? m.weekOf(formatDay(monday, m, { month: "short", day: "numeric" }))
              : formatDay(monday, m, { month: "short" }),
            m.prompts(total),
            topProjects(s, counts, m, view),
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
.col-fill{display:block;border-radius:4px 4px 2px 2px;background:var(--accent);opacity:.35;transition:opacity var(--motion-fast) var(--ease-out)}
.col-fill.peak,.col:hover .col-fill,.col:focus .col-fill{opacity:1}
.col-label{position:absolute;bottom:0;left:50%;transform:translateX(-50%);font-size:var(--text-2xs);color:var(--muted);white-space:nowrap}
.heat{display:grid;grid-template-columns:28px repeat(24,minmax(0,1fr)) 56px;gap:3px;margin-top:12px}
.heat-top{position:relative;height:56px;display:flex;align-items:flex-end;outline:none}
.heat-top i{display:block;width:100%;border-radius:3px 3px 0 0;background:var(--accent);opacity:.35}
.heat-top i.peak,.heat-top:hover i,.heat-top:focus i{opacity:1}
.heat-side{position:relative;display:flex;align-items:center;outline:none}
.heat-side i{display:block;height:60%;border-radius:0 3px 3px 0;background:var(--accent);opacity:.45}
.heat-side:hover i,.heat-side:focus i{opacity:1}
.clock{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}
.clock svg{width:100%;max-width:240px;height:auto}
.clock-dial{fill:none;stroke:var(--id-muted,var(--muted));stroke-opacity:.25}
.clock-bar{stroke:var(--id-accent,var(--accent));stroke-width:7;stroke-linecap:round;stroke-opacity:.35}
.clock-bar.on{stroke-opacity:1}
.clock-tick{fill:var(--id-muted,var(--muted));font-size:var(--text-2xs)}
.clock figcaption{font-size:var(--text-sm);color:var(--id-muted,var(--muted));text-align:center}
.chapters{display:flex;gap:6px;list-style:none;margin:6px 0 18px;padding:0}
.chapters li{min-width:0;display:flex;flex-direction:column;gap:4px}
.ch-bar{height:10px;border-radius:5px;background:var(--c)}
.ch-name{font-weight:600;font-size:var(--text-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ch-when{font-size:var(--text-xs);color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.heat-h{font-size:10px;color:var(--muted);text-align:left}
.heat-d{font-size:var(--text-2xs);color:var(--muted);align-self:center}
.heat-c,.cal-d{position:relative;border-radius:3px;background:var(--empty);outline:none;transition:box-shadow var(--motion-fast) var(--ease-out)}
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
.scale{display:flex;align-items:center;gap:3px;justify-content:flex-end;font-size:var(--text-2xs);color:var(--muted);margin-top:10px}
.scale i{width:11px;height:11px;border-radius:3px;background:var(--empty)}
.scale i:first-of-type{margin-left:6px}.scale i:last-of-type{margin-right:6px}
.ranks{list-style:none;margin:0;padding:0}
.ranks li{display:grid;grid-template-columns:minmax(0,10em) 1fr 38px;align-items:center;gap:10px;font-size:var(--text-sm);margin:9px 0}
.rank-name{display:flex;align-items:center;gap:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ranks b{text-align:right;font-size:var(--text-xs)}
.stack{display:flex;align-items:flex-end;gap:3px;height:170px;margin-top:8px}
.stack-w{position:relative;flex:1;height:100%;display:flex;align-items:flex-end;outline:none}
.stack-bar{display:flex;flex-direction:column-reverse;width:100%;border-radius:3px;overflow:hidden;opacity:.9;transition:opacity var(--motion-fast) var(--ease-out),box-shadow var(--motion-fast) var(--ease-out)}
.stack-w:hover .stack-bar,.stack-w:focus .stack-bar{opacity:1;box-shadow:0 0 0 2px var(--fg)}
.tip{cursor:default}
.tip:hover::after,.tip:focus::after{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);z-index:20;width:max-content;max-width:min(240px,80vw);padding:6px 9px;border-radius:var(--radius-xs);background:var(--fg);color:var(--bg);font-size:var(--text-xs);line-height:1.4;font-weight:500;white-space:normal;text-align:left;pointer-events:none;box-shadow:0 4px 14px var(--shadow);animation:fade-in var(--motion-base) var(--ease-out)}
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
.heat{grid-template-columns:20px repeat(24,minmax(0,1fr)) 28px;gap:2px}
.heat-top{height:34px}
.chapters{flex-direction:column}
.heat-c{height:14px}
.heat-h{font-size:9px}
.stack{height:140px;gap:2px}
}
`
