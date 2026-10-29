import { documentLayoutStyle } from "./document-layout.ts"
import { identitySignatures, productStyle } from "./templates.ts"
import { isProductLook } from "./looks.ts"
import { portraitSection, portraitStyle } from "./portrait.ts"
import { VIEW_MESSAGES } from "./messages.ts"
import { preferenceMap, workflowCharts, viewStyle } from "./overview.ts"
import { DateTime } from "effect"
import type { DimensionKey, Evidence, Language, Profile, Trait } from "../domain/Profile.ts"
import {
  calendar,
  chapterStrip,
  chartStyle,
  heatmap,
  projectRanking,
  projectWeeks,
  radialClock,
  type ChartView,
} from "./charts.ts"
import { chapters, chronotype, correctionEvery, nightShare, promptsPerSession } from "./derive.ts"
import { LANG_TAGS, makeLoc, type Loc } from "./loc.ts"
import { displayFontDataUrl } from "./fonts.ts"
import { graphicSvg, svgDataUrl } from "./graphic.ts"
import { html, raw, type Raw } from "./html-template.ts"
import {
  CLASSIC_TOKENS,
  DEFAULT_RENDER_OPTIONS,
  excludedParts,
  lookOf,
  type Identity,
  type Look,
  type RenderOptions,
  type ReportTokens,
} from "./looks.ts"
import { MESSAGES, type Messages } from "./messages.ts"
import { triggeredSignals } from "./signals.ts"
import { PROMPT_TECHNIQUES, TOOL_TECHNIQUES } from "../domain/Techniques.ts"
import { techniquesSection, techniqueStyle } from "./techniques.ts"
import { makeScrub, visibilityOf, type Scrub, type Visibility } from "./visibility.ts"

const RUNNER_NAMES = { "claude-code": "Claude Code", codex: "Codex" } as const

const formatDate = (t: DateTime.Utc, timeZone: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(DateTime.toEpochMillis(t))

const formatMonth = (t: DateTime.Utc, timeZone: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { timeZone, year: "numeric", month: "short" }).format(
    DateTime.toEpochMillis(t),
  )

/** Calendar days from `from` to `to` in `timeZone`, both included. */
const daysBetween = (from: DateTime.Utc, to: DateTime.Utc, timeZone: string): number => {
  const day = (t: DateTime.Utc) => {
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone })
      .format(DateTime.toEpochMillis(t))
      .split("-")
      .map(Number) as [number, number, number]
    return Date.UTC(y, m - 1, d) / 86_400_000
  }
  return day(to) - day(from) + 1
}

const formatDateTime = (t: DateTime.Utc, timeZone: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(DateTime.toEpochMillis(t))

const percent = (x: number) => Math.round(x * 100)
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`

// ---- charts (inline SVG / CSS, drawn from `stats` only) ----------------------------------

/** A donut of ratios with a legend; segments use the accent at three strengths. */
const donut = (parts: ReadonlyArray<{ readonly value: number; readonly label: Raw }>): Raw => {
  let offset = 0
  const total = Math.max(
    1e-9,
    parts.reduce((a, p) => a + p.value, 0),
  )
  const rings = parts.map((p, i) => {
    const share = (p.value / total) * 100
    const ring = html`<circle
      cx="60"
      cy="60"
      r="44"
      pathLength="100"
      class="seg s${i}"
      stroke-dasharray="${share.toFixed(2)} ${(100 - share).toFixed(2)}"
      stroke-dashoffset="${(25 - offset).toFixed(2)}"
    />`
    offset += share
    return ring
  })
  const top = parts.reduce((a, p) => (p.value > a.value ? p : a), parts[0]!)
  return html`<div class="donut">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="44" class="track" />
      ${rings}
      <text x="60" y="66" text-anchor="middle" class="donut-value">
        ${Math.round((top.value / total) * 100)}%
      </text>
    </svg>
    <ul class="legend">
      ${parts.map(
        (p, i) =>
          html`<li><i class="dot s${i}"></i>${p.label}<b>${Math.round((p.value / total) * 100)}%</b></li>`,
      )}
    </ul>
  </div>`
}

/** Horizontal share bars (CSS widths). */
const shareBars = (rows: ReadonlyArray<{ readonly label: Raw; readonly n: number }>): Raw => {
  const total = Math.max(
    1,
    rows.reduce((a, r) => a + r.n, 0),
  )
  return html`<ul class="shares">
    ${rows
      .filter((r) => r.n > 0)
      .map(
        (r) =>
          html`<li>
            <span class="share-label">${r.label}</span>
            <span class="share-track"
              ><span class="share-fill" style="width:${((100 * r.n) / total).toFixed(1)}%"></span
            ></span>
            <b>${Math.round((100 * r.n) / total)}%</b>
          </li>`,
      )}
  </ul>`
}

const ring = (value: number, label: Raw): Raw =>
  html`<div class="ring">
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" class="track" />
      <circle
        cx="32"
        cy="32"
        r="26"
        pathLength="100"
        class="seg s0"
        stroke-dasharray="${Math.max(0.5, value * 100).toFixed(1)} 100"
        stroke-dashoffset="25"
      />
    </svg>
    <div><b>${percent(value)}%</b><span>${label}</span></div>
  </div>`

// ---- profile sections ---------------------------------------------------------------------

/** Verbatim text (quotes, rewrites): as written, or per language with project names replaced. */
type Verbatim = (text: string) => Raw | string

const makeVerbatim =
  (loc: Loc, v: Visibility, scrub: Scrub): Verbatim =>
  (text) =>
    v.projects ? text : loc.text((_m, _c, l) => scrub(text, l))

const quotes = (evidence: ReadonlyArray<Evidence>, say: Verbatim): Raw =>
  html`<ul class="evidence">
    ${evidence.map((e) => html`<li><blockquote>${say(e.quote)}</blockquote></li>`)}
  </ul>`

const CONFIDENCE_RANK = { high: 0, medium: 1, low: 2 } as const
const CONFIDENCE_LEVEL = { high: 3, medium: 2, low: 1 } as const

const meter = (t: Trait, loc: Loc): Raw =>
  html`<span class="meter ${t.confidence}"
    >${[1, 2, 3].map((n) => html`<i class="${n <= CONFIDENCE_LEVEL[t.confidence] ? "on" : ""}"></i>`)}<span
      class="meter-label"
      >${loc.text((m) => m.confidence[t.confidence])}</span
    ></span
  >`

const supportLine = (t: Trait, loc: Loc): Raw =>
  t.support === null
    ? html``
    : html`<p class="support">
        ${loc.text((m) => m.support(t.support!.sessions, t.support!.weeks, t.evidence.length))}
      </p>`

/** A signature trait: one quote shown in the private report, the rest one click away. */
const signatureTrait = (p: Profile, i: number, loc: Loc, v: Visibility, scrub: Scrub): Raw => {
  const t = p.traits[i]!
  return html`<article class="trait">
    <header>
      <h3>${loc.text((_m, c, l) => scrub(c.trait(i).name, l))}</h3>
      ${meter(t, loc)}
    </header>
    <p>${loc.text((_m, c, l) => scrub(c.trait(i).description, l))}</p>
    ${v.quotes && t.evidence[0] ? html`<blockquote class="lead-quote">${makeVerbatim(loc, v, scrub)(t.evidence[0].quote)}</blockquote>` : ""}
    ${supportLine(t, loc)}
    ${
      v.quotes && t.evidence.length > 1
        ? html`<details open>
            <summary>${loc.text((m) => m.showEvidence(t.evidence.length))}</summary>
            ${quotes(t.evidence.slice(1), makeVerbatim(loc, v, scrub))}
          </details>`
        : ""
    }
  </article>`
}

const minorTrait = (p: Profile, i: number, loc: Loc, v: Visibility, scrub: Scrub): Raw => {
  const t = p.traits[i]!
  return html`<li class="minor">
    <div class="minor-head">
      <b>${loc.text((_m, c, l) => scrub(c.trait(i).name, l))}</b>${meter(t, loc)}
    </div>
    <p>${loc.text((_m, c, l) => scrub(c.trait(i).description, l))}</p>
    ${
      v.quotes && t.evidence.length > 0
        ? html`<details open>
            <summary>${loc.text((m) => m.showEvidence(t.evidence.length))}</summary>
            ${quotes(t.evidence, makeVerbatim(loc, v, scrub))}
          </details>`
        : ""
    }
  </li>`
}

const dimensionRow = (
  p: Profile,
  key: DimensionKey,
  loc: Loc,
  v: Visibility,
  scrub: Scrub,
): Raw => {
  const d = p.dimensions.find((x) => x.key === key)!
  const head = html`<span class="dim-name">${loc.text((m) => m.dimensionNames[key])}</span>
    <span class="dim-main">
      <span class="dim-title">${loc.text((_m, c, l) => scrub(c.dimension(key).title, l))}</span>
      <span class="dim-summary">${loc.text((_m, c, l) => scrub(c.dimension(key).summary, l))}</span>
    </span>
    ${
      d.evidence.length === 0
        ? html`<span class="badge warn">${loc.text((m) => m.noEvidence)}</span>`
        : html`<span class="badge">${loc.text((m) => m.evidenceCount(d.evidence.length))}</span>`
    }`
  if (!v.quotes) return html`<div class="dimension static">${head}</div>`
  return html`<details open class="dimension">
    <summary>${head}</summary>
    <div class="dim-body">
      ${
        d.evidence.length === 0
          ? html`<p class="warning">${loc.text((m) => m.insufficientEvidence)}</p>`
          : quotes(d.evidence, makeVerbatim(loc, v, scrub))
      }
    </div>
  </details>`
}

const improvementCard = (p: Profile, i: number, loc: Loc, v: Visibility, scrub: Scrub): Raw => {
  const imp = p.improvements[i]!
  const before =
    v.quotes && imp.rewrite
      ? imp.evidence.find((e) => e.promptId === imp.rewrite!.promptId)
      : undefined
  const others = v.quotes ? imp.evidence.filter((e) => e !== before) : []
  return html`<article class="improve">
    <header><span class="improve-n">${i + 1}</span><h3>${loc.text((_m, c, l) => scrub(c.improvement(i).title, l))}</h3></header>
    <p class="improve-pattern">${loc.text((_m, c, l) => scrub(c.improvement(i).pattern, l))}</p>
    <p class="improve-impact">${loc.text((_m, c, l) => scrub(c.improvement(i).impact, l))}</p>
    <p class="improve-tip">${loc.text((_m, c, l) => scrub(c.improvement(i).suggestion, l))}</p>
    ${
      before && imp.rewrite
        ? html`<div class="rewrite">
            <div>
              <span class="rw-label">${loc.text((m) => m.before)}</span>
              <blockquote>${makeVerbatim(loc, v, scrub)(before.quote)}</blockquote>
            </div>
            <div>
              <span class="rw-label">${loc.text((m) => m.after)}</span>
              <p class="rw-after" title="${loc.attr((m) => m.suggested)}">${makeVerbatim(loc, v, scrub)(imp.rewrite.after)}</p>
            </div>
          </div>`
        : ""
    }
    ${
      others.length > 0
        ? html`<details open>
            <summary>${loc.text((m) => m.showEvidence(others.length))}</summary>
            ${quotes(others, makeVerbatim(loc, v, scrub))}
          </details>`
        : ""
    }
  </article>`
}

const signalRow = (p: Profile, loc: Loc): Raw | null => {
  const list = triggeredSignals(p.stats)
  if (list.length === 0) return null
  const r = p.stats.promptHabits.reusedOpenings
  const texts = (m: Messages, id: (typeof list)[number]["id"], amount: number) =>
    id === "reusedOpenings" ? m.signal.reusedOpenings(r.openings, r.sessions) : m.signal[id](amount)
  return html`<ul class="signals">
    ${list.map(
      (x) =>
        html`<li>
          <b>${loc.text((m) => texts(m, x.id, x.amount)[0])}</b>
          <span>${loc.text((m) => texts(m, x.id, x.amount)[1])}</span>
        </li>`,
    )}
  </ul>`
}

/** One "before → now" row; `better` says which direction is an improvement, if any. */
const change = (label: Raw, before: number, now: number, better: "down" | "up" | null): Raw => {
  const delta = Math.round(now * 100) - Math.round(before * 100)
  const tone =
    better === null || delta === 0 ? "flat" : delta < 0 === (better === "down") ? "good" : "bad"
  return html`<li class="chg ${tone}">
    <span>${label}</span>
    <b>${Math.round(before * 100)}% → ${Math.round(now * 100)}%</b>
    <i>${delta === 0 ? "=" : delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`}</i>
  </li>`
}

/** "Since your last report": habits and the techniques that moved most. */
const progressBlock = (p: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw | null => {
  const prev = p.previous
  if (prev === null) return null
  const s = p.stats
  const t = s.techniques
  const movers =
    t === null
      ? []
      : [
          ...TOOL_TECHNIQUES.map((k) => ({
            label: loc.text((m) => m.toolNames[k][0]),
            before: prev.toolShares[k],
            now: t.coveredSessions === 0 ? 0 : Math.min(1, t.tools[k].sessions / t.coveredSessions),
          })),
          ...PROMPT_TECHNIQUES.map((k) => ({
            label: loc.text((m) => m.promptNames[k][0]),
            before: prev.promptShares[k],
            now: t.prompts[k],
          })),
        ]
          .filter((x) => Math.abs(x.now - x.before) >= 0.03)
          .toSorted((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
          .slice(0, 4)
  return html`<div class="progress">
    <h3 class="sub-h">
      ${loc.text((m) =>
        m.sinceLast((v.dates ? formatDate : formatMonth)(prev.generatedAt, s.timezone, m.locale)),
      )}
    </h3>
    <ul class="changes">
      ${change(
        loc.text((m) => m.correctionsShare),
        prev.correctionRate,
        s.correctionRate,
        "down",
      )}
      ${change(
        loc.text((m) => m.terseLabel),
        prev.terseShare,
        s.promptHabits.terseShare,
        "down",
      )}
      ${change(
        loc.text((m) => m.nightLabel),
        prev.nightShare,
        nightShare(s),
        null,
      )}
      ${movers.map((x) => change(x.label, x.before, x.now, null))}
    </ul>
    ${
      prev.improvements.length > 0
        ? html`<p class="last-tips">
            ${loc.text(
              (m, _c, l) =>
                `${m.lastSuggestions}: ${prev.improvements.map((x) => scrub(x, l)).join(" · ")}`,
            )}
          </p>`
        : ""
    }
  </div>`
}

const signatureTile = (value: Raw, label: Raw, tip: Raw, i: number): Raw =>
  html`<div class="sig tip ${i === 0 ? "tip-l" : i === 3 ? "tip-r" : ""}" ${tip} tabindex="-1">
    <b>${value}</b><span>${label}</span>
  </div>`

// ---- styles -------------------------------------------------------------------------------

/** The classic hero: today's colors on a card, with the hour graphic. */
const CLASSIC_IDENTITY: Identity = {
  background: "var(--card)",
  split: null,
  text: "var(--fg)",
  muted: "var(--muted)",
  chipBorder: "var(--border)",
  chipBackground: "transparent",
  graphic: "bars",
  graphicColor: "#5b5bd6",
  graphicDetail: "#5b5bd6",
}

/** Categorical colors for up to six projects, then "other"; readable in light and dark. */
const PROJECT_PALETTE = `--p0:#4f7cff;--p1:#f2994a;--p2:#27ae60;--p3:#eb5757;--p4:#9b51e0;--p5:#2bb3c0;--po:#d3d6dc`

const tokens = (t: ReportTokens) =>
  `--bg:${t.bg};--fg:${t.fg};--muted:${t.muted};--card:${t.card};--border:${t.border};--accent:${t.accent};--accent-soft:${t.accentSoft};--warn:${t.warn};--empty:${t.empty}`

const BASE_STYLE = `
:root{${PROJECT_PALETTE}}
@media (prefers-color-scheme:dark){:root{--po:#454952}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif}
.page{max-width:1080px;margin:0 auto;padding:20px 20px 56px}
h1,h2,h3{line-height:1.2;margin:0}
p{margin:0}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:6px 0 18px}
.brand{font-weight:700;letter-spacing:-.01em}
.switch{display:flex;gap:2px;padding:3px;border:1px solid var(--border);border-radius:999px;background:var(--card)}
.switch label{padding:4px 12px;border-radius:999px;font-size:13px;cursor:pointer;color:var(--muted)}
.lang-input{position:absolute;opacity:0;pointer-events:none}
.hero{position:relative;overflow:hidden;border-radius:24px;padding:36px 40px;border:1px solid var(--border);background:var(--id-bg);color:var(--id-fg)}
.hero .split{position:absolute;right:0;top:0;bottom:0;width:34%;background:var(--id-split)}
.hero .copy{position:relative;max-width:60%}
.hero h1{font-size:clamp(32px,5.6vw,58px);letter-spacing:-.02em;margin-bottom:12px}
.hero .tagline{font-size:19px;line-height:1.45;color:var(--id-muted);display:block}
.hero .desc{margin-top:8px;color:var(--id-muted);font-size:14px}
.hero .report-facts{margin:18px 0 0;display:flex;flex-wrap:wrap;gap:10px 28px;font-size:13px}.hero .report-facts dt{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--id-muted)}.hero .report-facts dd{margin:2px 0 0;font-weight:600;font-variant-numeric:tabular-nums}
.hero:has(.hero-clock){min-height:270px}
.hero-clock{position:absolute;right:32px;top:50%;transform:translateY(-50%);width:min(28%,210px)}
.hero .chrono{margin-top:14px;font-size:13px;font-weight:600;color:var(--id-fg)}
.hero .graphic{position:absolute;right:36px;top:28px;bottom:28px;height:calc(100% - 56px);width:auto;max-width:30%;object-fit:contain}
.sigs{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.sig,.panel,.trait,.dimension,.fact,.about,.minor{background:var(--card);border:1px solid var(--border);border-radius:18px}
.sig{position:relative;padding:16px 18px;outline:none}
.sig b{display:block;font-size:26px;letter-spacing:-.02em;line-height:1.15}
.sig>span{color:var(--muted);font-size:12.5px}
.sig:hover,.sig:focus{border-color:var(--accent)}
.grid{display:grid;gap:12px;margin-bottom:12px}
.g-2{grid-template-columns:2fr 1fr}
.g-3{grid-template-columns:repeat(3,1fr)}
.g-2r{grid-template-columns:1fr 1.6fr}
.wide{margin-bottom:12px}
.panel-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.panel-head h2{margin-bottom:0}.panel-head .note{margin-top:0}
.panel{padding:18px 20px}
.panel h3{font-size:14px;margin-bottom:10px}
.panel .note{color:var(--muted);font-size:12px;margin-top:6px}
.axis{fill:var(--muted);font-size:11px}
.donut{display:flex;align-items:center;gap:16px}
.donut svg{width:112px;flex:none}
.track{fill:none;stroke:var(--empty);stroke-width:14}
.seg{fill:none;stroke-width:14;stroke:var(--accent)}
.s1{stroke-opacity:.55}.s2{stroke-opacity:.25}
.donut-value{fill:var(--fg);font-size:20px;font-weight:700}
.legend,.shares,.evidence,.facts{list-style:none;margin:0;padding:0}
.legend li{display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0}
.legend b{margin-left:auto;padding-left:10px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--accent);flex:none}
.dot.s1{opacity:.55}.dot.s2{opacity:.25}
.shares li{display:grid;grid-template-columns:84px 1fr 38px;align-items:center;gap:8px;font-size:13px;margin:7px 0}
.share-track{height:8px;border-radius:99px;background:var(--empty);overflow:hidden}
.share-fill{display:block;height:100%;background:var(--accent);border-radius:99px}
.shares b{text-align:right;font-size:12px}
.sub{color:var(--muted);font-size:12px;margin-top:12px}
.rings{display:flex;gap:14px;flex-wrap:wrap}
.ring{display:flex;align-items:center;gap:8px}
.ring svg{width:52px}
.ring b{display:block;font-size:17px}
.ring div>span{font-size:12px;color:var(--muted)}
.length{margin-top:14px}
.length .shares li{grid-template-columns:84px 1fr 78px}
details summary{cursor:pointer}
section>h2{font-size:20px;margin:36px 0 14px}
section .panel{margin-bottom:12px}
.traits{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.trait{padding:18px 20px}
.trait header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px}
.trait h3{font-size:17px}
.trait p{font-size:14px;color:var(--muted)}
.meter{display:flex;align-items:center;gap:3px;flex:none}
.meter i{width:14px;height:6px;border-radius:3px;background:var(--empty)}
.meter i.on{background:var(--accent)}
.meter-label{font-size:11px;color:var(--muted);margin-left:6px;white-space:nowrap}
.trait details{margin-top:8px}
.lead-quote{margin-top:12px}
.support{margin-top:10px;font-size:12px;color:var(--muted)}
.sub-h{font-size:14px;color:var(--muted);margin:22px 0 10px}
.minors{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
.minor{padding:12px 16px}
.minor-head{display:flex;justify-content:space-between;gap:10px;align-items:center}
.minor p{font-size:13px;color:var(--muted);margin-top:4px}
.minor details{margin-top:6px}
.trait summary,.dim-body summary{font-size:13px;color:var(--accent)}
.evidence li{margin:8px 0 0}
blockquote{margin:0;padding:6px 12px;border-left:3px solid var(--accent);color:var(--muted);font-size:13.5px;white-space:pre-wrap;overflow-wrap:anywhere}
.dims{display:grid;gap:8px}
.dimension>summary{display:flex;align-items:center;gap:12px;padding:14px 18px;list-style:none}
.dimension>summary::-webkit-details-marker{display:none}
.dimension>summary::after{content:"+";margin-left:12px;color:var(--muted);font-size:18px;line-height:1}
.dimension[open]>summary::after{content:"–"}
.dim-name{font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;min-width:120px}
.dim-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.dim-title{font-weight:600}
.dim-summary{font-size:13.5px;color:var(--muted);font-weight:400}
.dimension.static{display:flex;align-items:center;gap:12px;padding:14px 18px}
.badge{font-size:12px;padding:2px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent);white-space:nowrap}
.badge.warn{background:transparent;border:1px solid var(--warn);color:var(--warn)}
.dim-body{padding:0 18px 16px}
.dim-body p{font-size:14px}
.warning{color:var(--warn);font-size:13px;margin-top:8px}
.section-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.section-head h2{font-size:20px;margin:36px 0 14px}
.improves{display:grid;gap:12px}
.improve{background:var(--card);border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:18px;padding:18px 20px}
.improve header{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.improve-n{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-size:12px;font-weight:700;flex:none}
.improve h3{font-size:17px}
.improve-pattern{font-size:14px}
.improve-impact{font-size:13px;color:var(--muted);margin-top:4px}
.improve-tip{font-size:14px;font-weight:600;margin-top:8px}
.rewrite{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
.rw-label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:4px}
.rw-after{margin:0;padding:8px 12px;border-radius:10px;background:var(--accent-soft);font-size:13.5px;white-space:pre-wrap;overflow-wrap:anywhere}
.signals{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.signals li{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 16px;display:flex;flex-direction:column;gap:4px}
.signals b{font-size:14px}.signals span{font-size:13px;color:var(--muted)}
.changes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px}
.chg{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:10px 14px;border:1px solid var(--border);border-radius:12px;background:var(--card);font-size:13px}
.chg b{font-variant-numeric:tabular-nums}.chg i{font-style:normal;font-size:12px;color:var(--muted);min-width:3em;text-align:right}
.chg.good i{color:#1f9d55}.chg.bad i{color:var(--warn)}
.last-tips{margin-top:10px;font-size:13px;color:var(--muted)}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.fact{padding:16px 18px;font-size:14px}
.about{margin-top:36px;padding:14px 18px;font-size:13px;color:var(--muted)}
.measured{margin-top:14px}
.measured .panel{background:var(--bg)}
.foot{margin-top:28px;text-align:center;font-size:12px;color:var(--muted)}
.about summary{color:var(--fg);font-weight:600}
.about p{margin-top:8px}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
@media (max-width:1000px){.g-3{grid-template-columns:repeat(2,1fr)}.g-2r{grid-template-columns:1fr}}
@media (max-width:760px){
.hero{padding:26px 22px}.hero .copy{max-width:none}.hero .split{display:none}
.hero:has(.hero-clock){min-height:270px}
.hero-clock{position:absolute;right:32px;top:50%;transform:translateY(-50%);width:min(28%,210px)}
.hero .chrono{margin-top:14px;font-size:13px;font-weight:600;color:var(--id-fg)}
.hero .graphic{position:static;display:block;height:auto;width:62%;max-width:none;margin:18px 0 0 auto}
.hero:has(.hero-clock){min-height:0}
.hero-clock{position:static;transform:none;width:70%;margin:18px auto 0}
.sigs{grid-template-columns:repeat(2,1fr)}.rewrite{grid-template-columns:1fr}.g-2,.g-3,.g-2r{grid-template-columns:1fr}
.dim-name{min-width:0;flex-basis:100%}.dimension>summary,.dimension.static{flex-wrap:wrap;gap:6px 12px}
}
`

/** Show only the selected language; style the selected switch button. */
const languageStyle = (langs: ReadonlyArray<Language>): string =>
  langs.length < 2
    ? ""
    : [
        ".page [data-l]{display:none}",
        ...langs.map(
          (l) =>
            `#lang-${l}:checked~.page [data-l="${l}"]{display:revert}` +
            `#lang-${l}:checked~.page label[for="lang-${l}"]{background:var(--accent);color:#fff}` +
            `#lang-${l}:focus-visible~.page label[for="lang-${l}"]{outline:3px solid var(--accent);outline-offset:2px}`,
        ),
      ].join("\n")

const identityVars = (id: Identity) =>
  `.hero{--id-bg:${id.background};--id-fg:${id.text};--id-muted:${id.muted};--id-split:${id.split ?? "transparent"}}`

const lookStyle = (look: Look | null): string => {
  if (look === null) {
    return `:root{color-scheme:light dark;${tokens(CLASSIC_TOKENS.light)}}
@media (prefers-color-scheme:dark){:root{${tokens(CLASSIC_TOKENS.dark)}}}
${identityVars(CLASSIC_IDENTITY)}`
  }
  return `@font-face{font-family:Bricolage;src:url(${displayFontDataUrl()}) format("woff");font-weight:800}
:root{color-scheme:light dark;${tokens(look.light)}}
@media (prefers-color-scheme:dark){:root{${tokens(look.dark)}}}
${identityVars(look.identity)}
.hero{border:0}
h1,section>h2,.sig b{font-family:Bricolage,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC",sans-serif;font-weight:800}`
}

// ---- page ---------------------------------------------------------------------------------

/** Render a self-contained, offline HTML report (no external requests, no JavaScript). */
export const renderHtml = (profile: Profile, options: RenderOptions = DEFAULT_RENDER_OPTIONS) => {
  const look = lookOf(options.look)
  const identity = look?.identity ?? CLASSIC_IDENTITY
  const loc = makeLoc(profile)
  const v = visibilityOf(options)
  const scrub = makeScrub(profile, v)
  const view: ChartView = { anonymizeProjects: !v.projects, showDates: v.dates }
  const excluded = excludedParts(options)
  const s = profile.stats
  const tz = s.timezone
  const c = profile.coverage
  const multi = loc.langs.length > 1
  const window = chronotype(s)
  const windowText = loc.text((m) =>
    window === null ? m.none : m.chronotype(hh(window.start), hh(window.end)),
  )
  const period = s.dateRange
  const cal = v.dates ? calendar(s, loc, view) : null
  const ranking = projectRanking(s, loc, view)
  const weekly = projectWeeks(s, loc, view)
  const strip = chapterStrip(s, chapters(s), loc, view)
  const order = profile.traits
    .map((t, i) => ({ t, i }))
    .toSorted((a, b) => CONFIDENCE_RANK[a.t.confidence] - CONFIDENCE_RANK[b.t.confidence])
    .map((x) => x.i)
  const signature = order.slice(0, 3)
  const minor = order.slice(3)
  const every = correctionEvery(s)
  const signals = v.coaching ? signalRow(profile, loc) : null
  const progress = v.coaching ? progressBlock(profile, loc, v, scrub) : null
  const portrait = portraitSection(profile, loc, v, scrub)
  const tech = techniquesSection(s, loc, v, makeVerbatim(loc, v, scrub))
  const perSession = promptsPerSession(s)
  const graphic = look
    ? graphicSvg(identity.graphic, s.hourHistogram, {
        graphicColor: identity.graphicColor,
        graphicDetail: identity.graphicDetail,
      })
    : null

  const page = html`<!doctype html>
    <html lang="${LANG_TAGS[loc.langs[0]!]}"${look ? raw(` data-look="${look.id}"`) : ""}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="referrer" content="no-referrer" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src 'unsafe-inline'; img-src data:${look ? "; font-src data:" : ""}"
        />
        <title>${scrub(profile.archetype.name, "en")} · prompt-profile</title>
        <style>
          ${raw(viewStyle)}${portrait ? raw(portraitStyle) : ""}${raw(BASE_STYLE)}${raw(chartStyle(loc.langs))}${raw(techniqueStyle)}${raw(lookStyle(look))}${raw(
            languageStyle(loc.langs),
          )}
        ${isProductLook(options.look) ? raw(productStyle) : ""}${raw(documentLayoutStyle)}</style>
      </head>
      <body>
        <input type="radio" name="report-view" id="report-overview" class="view-input" aria-label="${loc.attr((_m, _c, l) => VIEW_MESSAGES[l].overview)}" checked />
        <input type="radio" name="report-view" id="report-detail" class="view-input" aria-label="${loc.attr((_m, _c, l) => VIEW_MESSAGES[l].detail)}" />
        ${
          multi
            ? loc.langs.map(
                (l, i) =>
                  html`<input
                    type="radio"
                    name="lang"
                    id="lang-${l}"
                    class="lang-input"
                    ${i === 0 ? raw("checked") : ""}
                  />`,
              )
            : ""
        }
        <div class="page">
          <header class="topbar">
            <span class="brand">prompt-profile</span>
            ${
              multi
                ? html`<nav class="switch" aria-label="${loc.attr((m) => m.switchLabel)}">
                    ${loc.langs.map(
                      (l) =>
                        html`<label for="lang-${l}" lang="${LANG_TAGS[l]}"
                          >${MESSAGES[l].languageName}</label
                        >`,
                    )}
                  </nav>`
                : ""
            }
          </header>
          <nav class="view-nav" aria-label="${loc.attr((_m, _c, l) => VIEW_MESSAGES[l].navigation)}">
            <label for="report-overview">${loc.text((_m, _c, l) => VIEW_MESSAGES[l].overview)}</label>
            <label for="report-detail">${loc.text((_m, _c, l) => VIEW_MESSAGES[l].detail)}</label>
          </nav>
          <section class="hero">
            ${identity.split ? html`<div class="split"></div>` : ""}
            <div class="copy">
              <h1>${loc.text((_m, ct, l) => scrub(ct.archetype.name, l))}</h1>
              <p class="tagline">${loc.text((_m, ct, l) => scrub(ct.headline, l))}</p>
              <p class="desc">${loc.text((_m, ct, l) => scrub(ct.archetype.description, l))}</p>
              ${look ? html`<p class="chrono">${windowText}</p>` : ""}
              <dl class="report-facts">
                <div>
                  <dt>${loc.text((m) => m.dataPeriod)}</dt>
                  <dd>
                    ${loc.text((m) => {
                      if (period === null) return m.none
                      const days = daysBetween(period.from, period.to, tz)
                      return v.dates
                        ? `${m.period(formatDate(period.from, tz, m.locale), formatDate(period.to, tz, m.locale))} · ${m.days(days)}`
                        : `${m.period(formatMonth(period.from, tz, m.locale), formatMonth(period.to, tz, m.locale))} · ${days < 45 ? m.days(days) : m.months(Math.round(days / 30.44))}`
                    })}
                  </dd>
                </div>
                <div>
                  <dt>${loc.text((m) => m.generated)}</dt>
                  <dd>
                    ${loc.text((m) =>
                      v.dates
                        ? formatDateTime(profile.generatedAt, tz, m.locale)
                        : formatMonth(profile.generatedAt, tz, m.locale),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>${loc.text((m) => m.analyzed)}</dt>
                  <dd>
                    ${loc.text((m) =>
                      [
                        m.coverage(c.promptsAnalyzed, c.sessionsAnalyzed),
                        c.sampled ? m.sampled(c.chunksAnalyzed, c.chunksTotal) : null,
                        c.chunksFailed > 0 ? m.chunksSkipped(c.chunksFailed) : null,
                      ]
                        .filter((x) => x !== null)
                        .join(" · "),
                    )}
                  </dd>
                </div>
              </dl>
            </div>
            ${isProductLook(options.look) ? identitySignatures(profile, loc, scrub) : ""}${
              graphic
                ? html`<img
                    class="graphic"
                    src="${svgDataUrl(graphic.svg)}"
                    alt="${loc.attr((m) => m.graphicAlt)}"
                  />`
                : html`<div class="hero-clock">${radialClock(s, window, windowText)}</div>`
            }
          </section>

          <main>
          <section id="overview" class="report-view report-view-overview" aria-label="${loc.attr((_m, _c, l) => VIEW_MESSAGES[l].overview)}">
          <header class="view-heading"><h2>${loc.text((_m, _c, l) => VIEW_MESSAGES[l].overviewTitle)}</h2><p>${loc.text((_m, _c, l) => VIEW_MESSAGES[l].overviewNote)}</p></header>
          <section class="sigs" aria-label="${loc.attr((m) => m.signature)}">
            ${signatureTile(
              html`${percent(nightShare(s))}%`,
              loc.text((m) => m.nightShare),
              loc.tip((m) => m.nightShareDef),
              0,
            )}
            ${signatureTile(
              loc.text((m) => m.characters(Math.round(s.promptLength.median))),
              loc.text((m) => m.medianPrompt),
              loc.tip((m) => m.medianPromptDef),
              1,
            )}
            ${signatureTile(
              loc.text((m) => m.corrections(every)),
              loc.text((m) => m.correctionsLabel),
              loc.tip((m) => m.correctionsDef),
              2,
            )}
            ${signatureTile(
              html`${perSession === null ? "—" : perSession}`,
              loc.text((m) => m.perSession),
              loc.tip((m) => m.perSessionDef),
              3,
            )}
          </section>


          ${preferenceMap(profile, loc)}
          ${workflowCharts(profile, loc)}
          <section>
            <h2>${loc.text((m) => m.rhythm)}</h2>
            ${
              cal
                ? html`<article class="panel wide">
                    <div class="panel-head">
                      <h3>${loc.text((m) => m.daily)}</h3>
                      <p class="note">
                        ${loc.text((m) => m.volume(s.totalPrompts, s.activeDays, s.longestStreakDays))}
                      </p>
                    </div>
                    ${cal}
                  </article>`
                : ""
            }
            <article class="panel wide">
              <div class="panel-head">
                <h3>${loc.text((m) => m.heatmap)}</h3>
                <p class="note">${loc.text((m) => m.heatmapNote)}</p>
              </div>
              ${heatmap(s, loc, view)}
              ${
                window
                  ? html`<p class="note">
                      ${windowText} · ${loc.text((m) => m.chronotypeShare(percent(window.share)))}
                    </p>`
                  : ""
              }
            </article>
          </section>

          ${
            ranking && weekly && strip
              ? html`<section>
                  <h2>${loc.text((m) => m.chapters)}</h2>
                  <div class="grid g-2r">
                    <article class="panel">
                      <h3>${loc.text((m) => m.projects)}</h3>
                      ${ranking}
                      ${v.projects ? html`<p class="note">${loc.text((m) => m.projectsNote)}</p>` : ""}
                    </article>
                    <article class="panel">
                      ${strip}
                      <h3>${loc.text((m) => m.projectsByWeek)}</h3>
                      ${weekly}
                    </article>
                  </div>
                </section>`
              : ""
          }

                  <div class="grid g-3 measured">
                    <article class="panel">
                      <h3>${loc.text((m) => m.languageMix)}</h3>
                      ${donut([
                        { value: s.languageMix.zh, label: loc.text((m) => m.languageNames.zh) },
                        { value: s.languageMix.en, label: loc.text((m) => m.languageNames.en) },
                        {
                          value: s.languageMix.mixed,
                          label: loc.text((m) => m.languageNames.mixed),
                        },
                      ])}
                    </article>
                    <article class="panel">
                      <h3>${loc.text((m) => m.sources)}</h3>
                      ${shareBars(
                        Object.entries(s.bySource).map(([id, count]) => ({
                          label: html`${RUNNER_NAMES[id as keyof typeof RUNNER_NAMES] ?? id}`,
                          n: count,
                        })),
                      )}
                      <p class="sub">${loc.text((m) => m.origins)}</p>
                      ${shareBars(
                        (["interactive", "sdk", "exec", "unknown"] as const).map((o) => ({
                          label: loc.text((m) => m.originNames[o]),
                          n: s.byOrigin[o],
                        })),
                      )}
                    </article>
                    <article class="panel">
                      <h3>${loc.text((m) => m.habits)}</h3>
                      <div class="rings">${ring(
                        s.imageRate,
                        loc.text((m) => m.imageRate),
                      )}</div>
                      <div class="length">
                        <p class="sub">${loc.text((m) => m.promptLength)}</p>
                        <ul class="shares">
                          ${(
                            [
                              ["median", s.promptLength.median],
                              ["p90", s.promptLength.p90],
                            ] as const
                          ).map(
                            ([k, n]) =>
                              html`<li>
                                <span class="share-label">${loc.text((m) => m[k])}</span>
                                <span class="share-track"
                                  ><span
                                    class="share-fill"
                                    style="width:${(100 * n) / Math.max(1, s.promptLength.p90)}%"
                                  ></span
                                ></span>
                                <b>${loc.text((m) => m.characters(Math.round(n)))}</b>
                              </li>`,
                          )}
                        </ul>
                      </div>
                    </article>
                  </div>
          ${
            v.funFacts && profile.funFacts.length > 0
              ? html`<section>
                  <h2>${loc.text((m) => m.funFacts)}</h2>
                  <ul class="facts">
                    ${profile.funFacts.map(
                      (_f, i) =>
                        html`<li class="fact">${loc.text((_m, ct, l) => scrub(ct.funFacts[i]!, l))}</li>`,
                    )}
                  </ul>
                </section>`
              : ""
          }

          <label class="page-turn" for="report-detail">${loc.text((_m, _c, l) => VIEW_MESSAGES[l].next)}</label>
          </section>
          <section id="detail" class="report-view report-view-detail" aria-label="${loc.attr((_m, _c, l) => VIEW_MESSAGES[l].detail)}">
          <header class="view-heading"><h2>${loc.text((_m, _c, l) => VIEW_MESSAGES[l].detailTitle)}</h2><p>${loc.text((_m, _c, l) => VIEW_MESSAGES[l].detailNote)}</p></header>
          ${portrait ?? ""}
          <section>
            <h2>${loc.text((m) => m.traits)}</h2>
            <div class="traits">
              ${signature.map((i) => signatureTrait(profile, i, loc, v, scrub))}
            </div>
            ${
              minor.length > 0
                ? html`<h3 class="sub-h">${loc.text((m) => m.moreTraits)}</h3>
                    <ul class="minors">
                      ${minor.map((i) => minorTrait(profile, i, loc, v, scrub))}
                    </ul>`
                : ""
            }
          </section>

          ${
            tech
              ? html`<section class="techniques">
                  <div class="section-head">
                    <h2>${loc.text((m) => m.techniques)}</h2>
                    <p class="note">${loc.text((m) => m.techniquesNote)}</p>
                  </div>
                  ${tech}
                </section>`
              : ""
          }

          ${
            v.coaching && (profile.improvements.length > 0 || signals !== null || progress !== null)
              ? html`<section class="coaching">
                  <div class="section-head">
                    <h2>${loc.text((m) => m.coaching)}</h2>
                    <p class="note">${loc.text((m) => m.coachingNote)}</p>
                  </div>
                  <div class="improves">
                    ${profile.improvements.map((_x, i) => improvementCard(profile, i, loc, v, scrub))}
                  </div>
                  ${
                    signals
                      ? html`<h3 class="sub-h">${loc.text((m) => m.signalsTitle)}</h3>
                          ${signals}`
                      : ""
                  }
                  ${progress ?? ""}
                </section>`
              : ""
          }

          <section>
            <h2>${loc.text((m) => m.dimensions)}</h2>
            <div class="dims">
              ${profile.dimensions.map((d) => dimensionRow(profile, d.key, loc, v, scrub))}
            </div>
          </section>

          <section class="about">
                  <h2>${loc.text((m) => m.howMeasured)}</h2>
                  <p>
                    ${loc.text(
                      (m) =>
                        `${m.engine(RUNNER_NAMES[profile.engine.runner], profile.engine.model)} · ${m.generatedAt((v.dates ? formatDateTime : formatMonth)(profile.generatedAt, tz, m.locale))}`,
                    )}
                  </p>
                  <p>
                    ${loc.text(
                      (m) =>
                        `${m.evidenceVerified(c.evidenceKept, c.evidenceDropped)}${c.chunksFailed > 0 ? ` · ${m.chunksSkipped(c.chunksFailed)}` : ""}`,
                    )}
                  </p>
                  ${excluded.length > 0 ? html`<p>${loc.text((m) => m.leftOut(excluded.join(", ")))}</p>` : ""}
                  <p>${loc.text((m) => m.privacy)}</p>
                </section>
          <label class="page-turn" for="report-overview">${loc.text((_m, _c, l) => VIEW_MESSAGES[l].back)}</label>
          </section>
          </main>
          <footer class="foot">prompt-profile · npx prompt-profile</footer>
        </div>
      </body>
    </html> `
  return page.value.replace(/[ \t]+$/gm, "")
}
