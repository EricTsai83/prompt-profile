import type { Stats } from "../domain/Stats.ts"
import {
  PROMPT_TECHNIQUES,
  TOOL_TECHNIQUES,
  type PromptTechnique,
  type Techniques,
  type ToolTechnique,
} from "../domain/Techniques.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import type { Messages } from "./messages.ts"

/**
 * "How I work with AI" (plan 17) in four layouts for review: badges, bars, an adoption
 * timeline and highlights. Same data and definitions in each; counts only, so the share page can show it.
 */
export const TECHNIQUE_VIEWS = ["badges", "bars", "timeline", "highlights"] as const
export type TechniqueView = (typeof TECHNIQUE_VIEWS)[number]

interface Row {
  readonly id: string
  readonly kind: "tool" | "prompt"
  /** 0–1: share of sessions (workflow) or of prompts (prompt craft). */
  readonly share: number
  readonly amount: number
  readonly monthly: ReadonlyArray<{
    readonly month: string
    readonly share: number
    readonly n: number
    readonly of: number
  }>
  readonly name: (m: Messages) => string
  readonly definition: (m: Messages) => string
}

const rowsOf = (s: Stats, t: Techniques): { tools: Array<Row>; prompts: Array<Row> } => {
  const tools = TOOL_TECHNIQUES.map((id: ToolTechnique): Row => ({
    id,
    kind: "tool",
    share: s.totalSessions === 0 ? 0 : t.tools[id].sessions / s.totalSessions,
    amount: id === "pullRequests" ? t.tools[id].count : t.tools[id].sessions,
    monthly: t.monthly.map((m) => ({
      month: m.month,
      n: m.tools[id],
      of: m.sessions,
      share: m.sessions === 0 ? 0 : m.tools[id] / m.sessions,
    })),
    name: (m) => m.toolNames[id][0],
    definition: (m) => m.toolNames[id][1],
  }))
    .filter((r) => r.amount > 0)
    .toSorted((a, b) => b.share - a.share)
  const prompts = PROMPT_TECHNIQUES.map((id: PromptTechnique): Row => ({
    id,
    kind: "prompt",
    share: t.prompts[id],
    amount: Math.round(t.prompts[id] * 100),
    monthly: t.monthly.map((m) => ({
      month: m.month,
      n: m.techniques[id],
      of: m.prompts,
      share: m.prompts === 0 ? 0 : m.techniques[id] / m.prompts,
    })),
    name: (m) => m.promptNames[id][0],
    definition: (m) => m.promptNames[id][1],
  }))
    .filter((r) => r.share > 0)
    .toSorted((a, b) => b.share - a.share)
  return { tools, prompts }
}

const monthName = (ym: string, m: Messages, year = false) =>
  new Intl.DateTimeFormat(m.locale, {
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${ym}-01T00:00:00Z`))

const firstMonth = (r: Row) => r.monthly.find((x) => x.n > 0)?.month ?? null

const pct = (x: number) => Math.round(x * 100)

const tipClass = (i: number, n: number) => (i < 2 ? "tip tip-l" : i >= n - 2 ? "tip tip-r" : "tip")

/** A tiny trend line of the monthly shares. */
const spark = (r: Row): Raw => {
  const points = r.monthly
  if (points.length < 2) return html``
  const max = Math.max(0.0001, ...points.map((p) => p.share))
  const xy = points
    .map(
      (p, i) =>
        `${((i / (points.length - 1)) * 96 + 2).toFixed(1)},${(26 - (p.share / max) * 22).toFixed(1)}`,
    )
    .join(" ")
  return html`<svg class="spark" viewBox="0 0 100 28" aria-hidden="true">
    <polyline points="${xy}" />
  </svg>`
}

const callout = (t: Techniques, loc: Loc): Raw =>
  t.maxParallel >= 2
    ? html`<p class="tech-callout">${loc.text((m) => m.parallel(t.maxParallel, t.parallelDays))}</p>`
    : html``

const amountText = (r: Row, m: Messages) =>
  r.kind === "prompt"
    ? m.ofPrompts(r.amount)
    : r.id === "pullRequests"
      ? `${r.amount} PR`
      : m.sessionsUsed(r.amount)

// ---- A: badges ----------------------------------------------------------------------------

const BADGES_SHOWN = 6

const badges = (rows: ReadonlyArray<Row>, loc: Loc): Raw =>
  html`${badgeGrid(rows.slice(0, BADGES_SHOWN), loc)}${
    rows.length > BADGES_SHOWN
      ? html`<details class="tech-more">
          <summary>${loc.text((m) => m.moreCount(rows.length - BADGES_SHOWN))}</summary>
          ${badgeGrid(rows.slice(BADGES_SHOWN), loc)}
        </details>`
      : ""
  }`

const badgeGrid = (rows: ReadonlyArray<Row>, loc: Loc): Raw =>
  html`<div class="tech-badges">
    ${rows.map(
      (r, i) =>
        html`<div class="tech-badge ${tipClass(i, rows.length)}" ${loc.tip((m) => r.definition(m))} tabindex="-1">
          <b>${r.kind === "prompt" ? `${r.amount}%` : r.amount}</b>
          <span class="tb-name">${loc.text((m) => r.name(m))}</span>
          <span class="tb-sub">${loc.text((m) =>
            r.kind === "prompt" ? r.definition(m) : amountText(r, m),
          )}</span>
          ${spark(r)}
          ${
            firstMonth(r)
              ? html`<span class="tb-since">${loc.text((m) => m.since(monthName(firstMonth(r)!, m)))}</span>`
              : ""
          }
        </div>`,
    )}
  </div>`

// ---- B: bars ------------------------------------------------------------------------------

const bars = (rows: ReadonlyArray<Row>, loc: Loc): Raw => {
  const max = Math.max(0.0001, ...rows.map((r) => r.share))
  const unit =
    rows[0]?.kind === "prompt" ? (m: Messages) => m.unitPrompts : (m: Messages) => m.unitSessions
  return html`<p class="tech-unit">${loc.text(unit)}</p><ul class="tech-bars">
    ${rows.map(
      (r) =>
        html`<li class="tip tip-l" ${loc.tip((m) => r.definition(m))} tabindex="-1">
          <span class="tbr-name">${loc.text((m) => r.name(m))}</span>
          <span class="share-track"
            ><span class="share-fill" style="width:${((100 * r.share) / max).toFixed(1)}%"></span
          ></span>
          <b>${pct(r.share)}%</b>
        </li>`,
    )}
  </ul>`
}

// ---- C: adoption timeline -----------------------------------------------------------------

/**
 * Workflow rows are scaled per row (when did each technique take off?); prompt rows share one
 * scale (which habits are strong?), otherwise every prompt row would look the same.
 */
const timeline = (rows: ReadonlyArray<Row>, loc: Loc): Raw => {
  const months = rows[0]?.monthly.map((x) => x.month) ?? []
  const shared = Math.max(0.0001, ...rows.flatMap((r) => r.monthly.map((x) => x.share)))
  return html`<div class="tech-time" style="--months:${months.length}">
    <span></span>
    ${months.map((ym) => html`<span class="tt-m">${loc.text((m) => monthName(ym, m))}</span>`)}
    ${rows.map((r) => {
      const max = r.kind === "prompt" ? shared : Math.max(0.0001, ...r.monthly.map((x) => x.share))
      const first = firstMonth(r)
      return html`<span class="tt-name tip tip-l" ${loc.tip((m) => r.definition(m))} tabindex="-1"
          >${loc.text((m) => r.name(m))}</span
        >${r.monthly.map(
          (x, i) =>
            html`<span
              class="tt-c l${x.n === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((4 * x.share) / max)))}${x.month === first ? " first" : ""} ${tipClass(i, months.length)}"
              ${loc.tip((m) => `${monthName(x.month, m, true)} · ${x.n} / ${x.of}`)}
              tabindex="-1"
            ></span>`,
        )}`
    })}
  </div>`
}

// ---- D: highlights -----------------------------------------------------------------------

/** Growth of a row: share in the last month minus the first month it was used. */
const growthOf = (r: Row) => {
  const used = r.monthly.filter((x) => x.of > 0)
  const first = used.find((x) => x.n > 0)
  const last = used.at(-1)
  return first && last ? last.share - first.share : 0
}

const highlights = (tools: ReadonlyArray<Row>, prompts: ReadonlyArray<Row>, loc: Loc): Raw => {
  const picked: Array<{ row: Row; reason: "top" | "growth" }> = []
  const add = (row: Row | undefined, reason: "top" | "growth") => {
    if (row && !picked.some((p) => p.row.id === row.id)) picked.push({ row, reason })
  }
  add(tools[0], "top")
  add(prompts[0], "top")
  add([...tools, ...prompts].toSorted((a, b) => growthOf(b) - growthOf(a))[0], "growth")
  const rest = [...tools, ...prompts].filter((r) => !picked.some((p) => p.row.id === r.id))
  return html`<div class="tech-hl">
      ${picked.map(
        ({ row, reason }) =>
          html`<article class="hl tip" ${loc.tip((m) => row.definition(m))} tabindex="-1">
            <b>${pct(row.share)}%</b>
            <div>
              <h3>${loc.text((m) => row.name(m))}</h3>
              <p>
                ${loc.text((m) =>
                  [
                    row.kind === "prompt"
                      ? m.ofPrompts(pct(row.share))
                      : m.ofSessions(pct(row.share)),
                    reason === "growth" ? m.growing : null,
                    firstMonth(row) ? m.since(monthName(firstMonth(row)!, m)) : null,
                  ]
                    .filter((x) => x !== null)
                    .join(" · "),
                )}
              </p>
            </div>
            ${spark(row)}
          </article>`,
      )}
    </div>
    <ul class="tech-chips">
      ${rest.map(
        (r) =>
          html`<li class="tip" ${loc.tip((m) => r.definition(m))} tabindex="-1">
            ${loc.text((m) => r.name(m))} <b>${pct(r.share)}%</b>
          </li>`,
      )}
    </ul>`
}

/** The section body in one of the review layouts; null without technique data. */
export const techniquesSection = (s: Stats, loc: Loc, view: TechniqueView): Raw | null => {
  const t = s.techniques
  if (t === null) return null
  const { tools, prompts } = rowsOf(s, t)
  if (tools.length === 0 && prompts.length === 0) return null
  if (view === "highlights") return html`${callout(t, loc)}${highlights(tools, prompts, loc)}`
  if (view === "timeline")
    return html`${callout(t, loc)}
      <article class="panel wide">
        <h3>${loc.text((m) => m.workflow)}</h3>
        ${timeline(tools, loc)}
      </article>
      <article class="panel wide">
        <h3>${loc.text((m) => m.promptCraft)}</h3>
        ${timeline(prompts, loc)}
      </article>`
  const body = view === "badges" ? badges : bars
  return html`${callout(t, loc)}
    <div class="grid g-2e">
      <article class="panel">
        <h3>${loc.text((m) => m.workflow)}</h3>
        ${body(tools, loc)}
      </article>
      <article class="panel">
        <h3>${loc.text((m) => m.promptCraft)}</h3>
        ${body(prompts, loc)}
      </article>
    </div>`
}

export const techniqueStyle = `
.g-2e{grid-template-columns:1fr 1fr}
.tech-callout{display:inline-block;margin:0 0 12px;padding:6px 12px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:13px;font-weight:600}
.tech-badges{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.tech-badge{position:relative;display:flex;flex-direction:column;gap:2px;padding:12px 14px;border:1px solid var(--border);border-radius:14px;outline:none}
.tech-badge:hover,.tech-badge:focus{border-color:var(--accent)}
.tech-badge b{font-size:22px;letter-spacing:-.02em;line-height:1.1}
.tb-name{font-size:13px;font-weight:600}
.tb-sub,.tb-since{font-size:11.5px;color:var(--muted)}
.spark{width:100%;height:28px;margin-top:4px}
.spark polyline{fill:none;stroke:var(--accent);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.tech-bars{list-style:none;margin:0;padding:0}
.tech-bars li{position:relative;display:grid;grid-template-columns:minmax(0,11em) 1fr 7.5em;align-items:center;gap:10px;font-size:13px;padding:5px 0;outline:none}
.tech-bars li b{text-align:right;font-size:12px}
.tbr-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tech-time{display:grid;grid-template-columns:minmax(9em,13em) repeat(var(--months),minmax(0,1fr));gap:3px;align-items:center}
.tt-m{font-size:11px;color:var(--muted);text-align:center}
.tt-name{position:relative;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;outline:none}
.tt-c{position:relative;height:22px;border-radius:4px;background:var(--empty);outline:none}
.tt-c.first::before{content:"";position:absolute;left:4px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:var(--fg)}
.tt-c:hover,.tt-c:focus{box-shadow:0 0 0 2px var(--fg)}
:is(.tt-c).l1{background:color-mix(in srgb,var(--accent) 28%,var(--empty))}
:is(.tt-c).l2{background:color-mix(in srgb,var(--accent) 52%,var(--empty))}
:is(.tt-c).l3{background:color-mix(in srgb,var(--accent) 76%,var(--empty))}
:is(.tt-c).l4{background:var(--accent)}
.tech-more{margin-top:10px}.tech-more summary{font-size:13px;color:var(--accent)}.tech-more .tech-badges{margin-top:10px}
.tech-unit{font-size:11px;color:var(--muted);text-align:right;margin:-4px 0 4px}
.tech-bars li{grid-template-columns:minmax(0,12em) 1fr 3.2em}
.tech-hl{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.hl{position:relative;display:flex;flex-direction:column;gap:8px;padding:18px 20px;border-radius:18px;background:var(--card);border:1px solid var(--border);outline:none}
.hl>b{font-size:40px;letter-spacing:-.03em;line-height:1;color:var(--accent)}
.hl h3{font-size:16px}.hl p{font-size:12.5px;color:var(--muted);margin-top:2px}
.tech-chips{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.tech-chips li{position:relative;padding:6px 12px;border-radius:999px;border:1px solid var(--border);background:var(--card);font-size:13px;outline:none}
.tech-chips b{color:var(--accent);margin-left:4px}
@media (max-width:760px){.tech-hl{grid-template-columns:1fr}.g-2e{grid-template-columns:1fr}.tech-time{grid-template-columns:minmax(7em,9em) repeat(var(--months),minmax(0,1fr))}.tt-name{font-size:12px}}
`
