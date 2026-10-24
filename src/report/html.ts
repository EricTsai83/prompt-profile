import { DateTime } from "effect"
import type { DimensionKey, Evidence, Language, Profile } from "../domain/Profile.ts"
import { contentIn, type Content } from "./content.ts"
import { peakHour, type Stats } from "../domain/Stats.ts"
import { displayFontDataUrl } from "./fonts.ts"
import { graphicSvg, svgDataUrl } from "./graphic.ts"
import { html, raw, type Raw } from "./html-template.ts"
import {
  DEFAULT_RENDER_OPTIONS,
  lookOf,
  type Identity,
  type Look,
  type RenderOptions,
  type ReportTokens,
} from "./looks.ts"
import { MESSAGES, type Messages } from "./messages.ts"

const RUNNER_NAMES = { "claude-code": "Claude Code", codex: "Codex" } as const

/** `lang` attribute per report language (zh-TW content is Traditional Chinese). */
const LANG_TAGS: Record<Language, string> = { en: "en", "zh-TW": "zh-Hant-TW" }

/**
 * Text in every report language. With several languages each version is a `[data-l]` span
 * and CSS shows the selected one (no JavaScript); with one language it is plain text.
 */
interface Loc {
  readonly langs: ReadonlyArray<Language>
  readonly text: (pick: (m: Messages, c: Content, lang: Language) => string) => Raw
  /** An SVG `<text>` per language (spans cannot be toggled inside SVG text). */
  readonly svgText: (
    attrs: string,
    pick: (m: Messages, c: Content, lang: Language) => string,
  ) => Raw
  /** Default-language string for attributes (aria-label, title). */
  readonly attr: (pick: (m: Messages, c: Content, lang: Language) => string) => string
}

const makeLoc = (p: Profile): Loc => {
  const langs = p.languages
  const contents = new Map(langs.map((l) => [l, contentIn(p, l)]))
  const one = langs.length === 1
  const value = (l: Language, pick: (m: Messages, c: Content, lang: Language) => string) =>
    pick(MESSAGES[l], contents.get(l)!, l)
  return {
    langs,
    text: (pick) =>
      one
        ? html`${value(langs[0]!, pick)}`
        : html`${langs.map(
            (l) => html`<span data-l="${l}" lang="${LANG_TAGS[l]}">${value(l, pick)}</span>`,
          )}`,
    svgText: (attrs, pick) =>
      html`${langs.map(
        (l) =>
          html`<text ${raw(attrs)} ${one ? "" : raw(`data-l="${l}"`)}>${value(l, pick)}</text>`,
      )}`,
    attr: (pick) => value(langs[0]!, pick),
  }
}

const formatDate = (t: DateTime.Utc, timeZone: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(DateTime.toEpochMillis(t))

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

/** Prompts per hour; the busiest hour is highlighted and labelled. */
const hourChart = (s: Stats, loc: Loc): Raw => {
  const max = Math.max(1, ...s.hourHistogram)
  const peak = peakHour(s)
  const bars = s.hourHistogram.map((n, h) => {
    const height = n === 0 ? 2 : 4 + (116 * n) / max
    return html`<rect
      x="${h * 20 + 3}"
      y="${124 - height}"
      width="14"
      height="${height.toFixed(1)}"
      rx="3"
      class="${h === peak ? "bar peak" : "bar"}"
      ><title>${hh(h)} · ${n}</title></rect
    >`
  })
  // The first and last labels align to the chart edges so they are never cut off.
  const ticks = [0, 6, 12, 18, 23].map(
    (h) =>
      html`<text
        x="${h === 0 ? 3 : h === 23 ? 477 : h * 20 + 10}"
        y="142"
        text-anchor="${h === 0 ? "start" : h === 23 ? "end" : "middle"}"
        class="axis"
        >${hh(h)}</text
      >`,
  )
  const label =
    peak === null
      ? ""
      : html`<text
          x="${peak * 20 + 10}"
          y="${124 - (4 + (116 * s.hourHistogram[peak]!) / max) - 6}"
          text-anchor="middle"
          class="value"
          >${s.hourHistogram[peak]}</text
        >`
  return html`<svg
    viewBox="0 0 480 150"
    class="chart"
    role="img"
    aria-label="${loc.attr((m) => m.byHour)}"
  >
    ${bars}${ticks}${label}
  </svg>`
}

const weekdayChart = (s: Stats, loc: Loc): Raw => {
  const max = Math.max(1, ...s.weekdayHistogram)
  const best = s.weekdayHistogram.indexOf(Math.max(...s.weekdayHistogram))
  const bars = s.weekdayHistogram.map((n, d) => {
    const height = n === 0 ? 2 : 4 + (100 * n) / max
    return html`<rect
        x="${d * 40 + 8}"
        y="${110 - height}"
        width="24"
        height="${height.toFixed(1)}"
        rx="4"
        class="${d === best && n > 0 ? "bar peak" : "bar"}"
        ><title>${n}</title></rect
      >${loc.svgText(`x="${d * 40 + 20}" y="130" text-anchor="middle" class="axis"`, (m) => m.weekdays[d]!)}`
  })
  return html`<svg
    viewBox="0 0 280 140"
    class="chart"
    role="img"
    aria-label="${loc.attr((m) => m.byWeekday)}"
  >
    ${bars}
  </svg>`
}

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

/** Weekday × hour heatmap. */
export const heatmapSvg = (grid: Stats["activityGrid"], loc: Loc): Raw => {
  const cell = 22
  const gap = 3
  const left = 36
  const top = 22
  const max = Math.max(1, ...grid.flat())
  const width = left + 24 * (cell + gap)
  const height = top + 7 * (cell + gap)
  const cells = grid.flatMap((row, w) =>
    row.map((n, h) => {
      const level = n === 0 ? 0 : 0.15 + 0.85 * Math.sqrt(n / max)
      return html`<rect
        x="${left + h * (cell + gap)}"
        y="${top + w * (cell + gap)}"
        width="${cell}"
        height="${cell}"
        rx="4"
        class="cell"
        style="fill-opacity:${level === 0 ? 1 : level.toFixed(3)}"
        data-empty="${n === 0}"
        ><title>${hh(h)} · ${n}</title></rect
      >`
    }),
  )
  const hours = [0, 3, 6, 9, 12, 15, 18, 21].map(
    (h) =>
      html`<text x="${left + h * (cell + gap) + cell / 2}" y="14" text-anchor="middle" class="axis"
        >${String(h).padStart(2, "0")}</text
      >`,
  )
  const days = grid.map((_row, w) =>
    loc.svgText(
      `x="${left - 8}" y="${top + w * (cell + gap) + cell / 2 + 4}" text-anchor="end" class="axis"`,
      (m) => m.weekdays[w]!,
    ),
  )
  return html`<svg
    viewBox="0 0 ${width} ${height}"
    role="img"
    aria-label="${loc.attr((m) => m.heatmap)}"
    class="heatmap"
  >
    ${hours}${days}${cells}
  </svg>`
}

// ---- profile sections ---------------------------------------------------------------------

const quotes = (evidence: ReadonlyArray<Evidence>): Raw =>
  html`<ul class="evidence">
    ${evidence.map((e) => html`<li><blockquote>${e.quote}</blockquote></li>`)}
  </ul>`

const CONFIDENCE_LEVEL = { high: 3, medium: 2, low: 1 } as const

const traitCard = (p: Profile, i: number, loc: Loc): Raw => {
  const trait = p.traits[i]!
  const level = CONFIDENCE_LEVEL[trait.confidence]
  return html`<article class="trait">
    <header>
      <h3>${loc.text((_m, c) => c.trait(i).name)}</h3>
      <span class="meter ${trait.confidence}" title="${loc.attr((m) => m.confidence[trait.confidence])}"
        >${[1, 2, 3].map((n) => html`<i class="${n <= level ? "on" : ""}"></i>`)}<span class="meter-label"
          >${loc.text((m) => m.confidence[trait.confidence])}</span
        ></span
      >
    </header>
    <p>${loc.text((_m, c) => c.trait(i).description)}</p>
    ${
      trait.evidence.length === 0
        ? html`<p class="warning">${loc.text((m) => m.insufficientEvidence)}</p>`
        : html`<details>
            <summary>${loc.text((m) => m.showEvidence(trait.evidence.length))}</summary>
            ${quotes(trait.evidence)}
          </details>`
    }
  </article>`
}

const dimensionRow = (p: Profile, key: DimensionKey, loc: Loc): Raw => {
  const d = p.dimensions.find((x) => x.key === key)!
  return html`<details class="dimension">
    <summary>
      <span class="dim-name">${loc.text((m) => m.dimensionNames[key])}</span>
      <span class="dim-title">${loc.text((_m, c) => c.dimension(key).title)}</span>
      ${
        d.evidence.length === 0
          ? html`<span class="badge warn">${loc.text((m) => m.noEvidence)}</span>`
          : html`<span class="badge">${loc.text((m) => m.evidenceCount(d.evidence.length))}</span>`
      }
    </summary>
    <div class="dim-body">
      <p>${loc.text((_m, c) => c.dimension(key).summary)}</p>
      ${
        d.evidence.length === 0
          ? html`<p class="warning">${loc.text((m) => m.insufficientEvidence)}</p>`
          : quotes(d.evidence)
      }
    </div>
  </details>`
}

const kpi = (value: Raw, label: Raw): Raw =>
  html`<div class="kpi">
    <b>${value}</b><span>${label}</span>
  </div>`

// ---- styles -------------------------------------------------------------------------------

const CLASSIC_TOKENS: { readonly light: ReportTokens; readonly dark: ReportTokens } = {
  light: {
    bg: "#f6f6f3",
    fg: "#1d1d1f",
    muted: "#6b6b70",
    card: "#ffffff",
    border: "#e6e6e1",
    accent: "#5b5bd6",
    accentSoft: "#ececfb",
    warn: "#9a5800",
    empty: "#ececea",
  },
  dark: {
    bg: "#121214",
    fg: "#ececee",
    muted: "#9a9aa2",
    card: "#1c1c20",
    border: "#2c2c33",
    accent: "#9d9dff",
    accentSoft: "#25254a",
    warn: "#f0b35a",
    empty: "#26262c",
  },
}

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

const tokens = (t: ReportTokens) =>
  `--bg:${t.bg};--fg:${t.fg};--muted:${t.muted};--card:${t.card};--border:${t.border};--accent:${t.accent};--accent-soft:${t.accentSoft};--warn:${t.warn};--empty:${t.empty}`

const BASE_STYLE = `
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
.hero .tagline{font-size:19px;line-height:1.45;color:var(--id-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hero .desc{margin-top:8px;color:var(--id-muted);font-size:14px}
.hero .meta{margin-top:16px;font-size:12.5px;color:var(--id-muted)}
.hero .graphic{position:absolute;right:36px;top:28px;bottom:28px;height:calc(100% - 56px);width:auto;max-width:30%;object-fit:contain}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
.kpi,.panel,.trait,.dimension,.fact,.about{background:var(--card);border:1px solid var(--border);border-radius:18px}
.kpi{padding:16px 18px}
.kpi b{display:block;font-size:26px;letter-spacing:-.02em;line-height:1.1}
.kpi>span{color:var(--muted);font-size:12.5px}
.grid{display:grid;gap:12px;margin-bottom:12px}
.g-2{grid-template-columns:2fr 1fr}
.g-3{grid-template-columns:repeat(3,1fr)}
.panel{padding:18px 20px}
.panel h2{font-size:14px;margin-bottom:10px}
.panel .note{color:var(--muted);font-size:12px;margin-top:6px}
.chart{width:100%;height:auto;display:block}
.bar{fill:var(--accent);fill-opacity:.35}
.bar.peak{fill-opacity:1}
.axis{fill:var(--muted);font-size:11px}
.value{fill:var(--fg);font-size:12px;font-weight:700}
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
details.panel>summary{font-weight:700;font-size:14px}
details.panel>summary .note{font-weight:400;margin-left:8px}
.heatmap{width:100%;height:auto;margin-top:12px}
.heatmap .cell{fill:var(--accent)}
.heatmap .cell[data-empty="true"]{fill:var(--empty)}
section>h2{font-size:20px;margin:36px 0 14px}
.traits{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.trait{padding:18px 20px}
.trait header{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px}
.trait h3{font-size:17px}
.trait p{font-size:14px;color:var(--muted)}
.meter{display:flex;align-items:center;gap:3px;flex:none}
.meter i{width:14px;height:6px;border-radius:3px;background:var(--empty)}
.meter i.on{background:var(--accent)}
.meter-label{font-size:11px;color:var(--muted);margin-left:6px;white-space:nowrap}
.trait details{margin-top:10px}
.trait summary,.dim-body summary{font-size:13px;color:var(--accent)}
.evidence li{margin:8px 0 0}
blockquote{margin:0;padding:6px 12px;border-left:3px solid var(--accent);color:var(--muted);font-size:13.5px;white-space:pre-wrap;overflow-wrap:anywhere}
.dims{display:grid;gap:8px}
.dimension>summary{display:flex;align-items:center;gap:12px;padding:14px 18px;list-style:none}
.dimension>summary::-webkit-details-marker{display:none}
.dimension>summary::after{content:"+";margin-left:12px;color:var(--muted);font-size:18px;line-height:1}
.dimension[open]>summary::after{content:"–"}
.dim-name{font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.04em;min-width:120px}
.dim-title{font-weight:600;flex:1}
.badge{font-size:12px;padding:2px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent);white-space:nowrap}
.badge.warn{background:transparent;border:1px solid var(--warn);color:var(--warn)}
.dim-body{padding:0 18px 16px}
.dim-body p{font-size:14px}
.warning{color:var(--warn);font-size:13px;margin-top:8px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.fact{padding:16px 18px;font-size:14px}
.about{margin-top:36px;padding:14px 18px;font-size:13px;color:var(--muted)}
.about summary{color:var(--fg);font-weight:600}
.about p{margin-top:8px}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
@media (max-width:760px){
.hero{padding:26px 22px}.hero .copy{max-width:none}.hero .split{display:none}
.hero .graphic{position:static;display:block;height:auto;width:62%;max-width:none;margin:18px 0 0 auto}
.kpis{grid-template-columns:repeat(2,1fr)}.g-2,.g-3{grid-template-columns:1fr}
.dim-name{min-width:0}.dimension>summary{flex-wrap:wrap;gap:6px 12px}
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
h1,section>h2,.kpi b{font-family:Bricolage,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC",sans-serif;font-weight:800}`
}

// ---- page ---------------------------------------------------------------------------------

/** Render a self-contained, offline HTML report (no external requests, no JavaScript). */
export const renderHtml = (
  profile: Profile,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
): string => {
  const look = lookOf(options.look)
  const identity = look?.identity ?? CLASSIC_IDENTITY
  const loc = makeLoc(profile)
  const s = profile.stats
  const tz = s.timezone
  const c = profile.coverage
  const peak = peakHour(s)
  const multi = loc.langs.length > 1
  const graphic = graphicSvg(identity.graphic, s.hourHistogram, {
    graphicColor: identity.graphicColor,
    graphicDetail: identity.graphicDetail,
  })
  const period = s.dateRange
  const n = (x: number) => html`${x.toLocaleString("en")}`

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
        <title>${profile.archetype.name} · prompt-profile</title>
        <style>
          ${raw(BASE_STYLE)}${raw(lookStyle(look))}${raw(languageStyle(loc.langs))}
        </style>
      </head>
      <body>
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

          <section class="hero">
            ${identity.split ? html`<div class="split"></div>` : ""}
            <div class="copy">
              <h1>${loc.text((_m, ct) => ct.archetype.name)}</h1>
              <p class="tagline">${loc.text((_m, ct) => ct.headline)}</p>
              <p class="desc">${loc.text((_m, ct) => ct.archetype.description)}</p>
              <p class="meta">
                ${loc.text((m) =>
                  [
                    period
                      ? m.period(
                          formatDate(period.from, tz, m.locale),
                          formatDate(period.to, tz, m.locale),
                        )
                      : null,
                    m.coverage(c.promptsAnalyzed, c.sessionsAnalyzed),
                    c.sampled ? m.sampled(c.chunksAnalyzed, c.chunksTotal) : null,
                    c.chunksFailed > 0 ? m.chunksSkipped(c.chunksFailed) : null,
                  ]
                    .filter((x) => x !== null)
                    .join(" · "),
                )}
              </p>
            </div>
            <img
              class="graphic"
              src="${svgDataUrl(graphic.svg)}"
              alt="${loc.attr((m) => m.graphicAlt)}"
            />
          </section>

          <section class="kpis">
            ${kpi(
              n(s.totalPrompts),
              loc.text((m) => m.totalPrompts),
            )}
            ${kpi(
              n(s.activeDays),
              loc.text((m) => m.activeDays),
            )}
            ${kpi(
              loc.text((m) => m.days(s.longestStreakDays)),
              loc.text((m) => m.longestStreak),
            )}
            ${kpi(
              html`${peak === null ? "—" : hh(peak)}`,
              loc.text((m) => m.peakHour),
            )}
          </section>

          <div class="grid g-2">
            <article class="panel">
              <h2>${loc.text((m) => m.byHour)}</h2>
              ${hourChart(s, loc)}
              <p class="note">
                ${loc.text((m) =>
                  m.byHourNote(peak === null ? m.none : hh(peak), s.latestTime ?? m.none),
                )}
              </p>
            </article>
            <article class="panel">
              <h2>${loc.text((m) => m.byWeekday)}</h2>
              ${weekdayChart(s, loc)}
            </article>
          </div>

          <div class="grid g-3">
            <article class="panel">
              <h2>${loc.text((m) => m.languageMix)}</h2>
              ${donut([
                { value: s.languageMix.zh, label: loc.text((m) => m.languageNames.zh) },
                { value: s.languageMix.en, label: loc.text((m) => m.languageNames.en) },
                { value: s.languageMix.mixed, label: loc.text((m) => m.languageNames.mixed) },
              ])}
            </article>
            <article class="panel">
              <h2>${loc.text((m) => m.sources)}</h2>
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
              <h2>${loc.text((m) => m.habits)}</h2>
              <div class="rings">
                ${ring(
                  s.correctionRate,
                  loc.text((m) => m.correctionRate),
                )}
                ${ring(
                  s.imageRate,
                  loc.text((m) => m.imageRate),
                )}
              </div>
              <div class="length">
                <p class="sub">${loc.text((m) => m.promptLength)}</p>
                <ul class="shares">
                  ${(
                    [
                      ["median", s.promptLength.median],
                      ["p90", s.promptLength.p90],
                    ] as const
                  ).map(
                    ([k, v]) =>
                      html`<li>
                        <span class="share-label">${loc.text((m) => m[k])}</span>
                        <span class="share-track"
                          ><span
                            class="share-fill"
                            style="width:${(100 * v) / Math.max(1, s.promptLength.p90)}%"
                          ></span
                        ></span>
                        <b>${loc.text((m) => m.characters(Math.round(v)))}</b>
                      </li>`,
                  )}
                </ul>
              </div>
            </article>
          </div>

          <details class="panel">
            <summary>
              ${loc.text((m) => m.heatmap)}<span class="note"
                >${loc.text((m) => m.heatmapNote)}</span
              >
            </summary>
            ${heatmapSvg(s.activityGrid, loc)}
          </details>

          <section>
            <h2>${loc.text((m) => m.traits)}</h2>
            <div class="traits">${profile.traits.map((_t, i) => traitCard(profile, i, loc))}</div>
          </section>

          <section>
            <h2>${loc.text((m) => m.dimensions)}</h2>
            <div class="dims">${profile.dimensions.map((d) => dimensionRow(profile, d.key, loc))}</div>
          </section>

          ${
            profile.funFacts.length > 0
              ? html`<section>
                  <h2>${loc.text((m) => m.funFacts)}</h2>
                  <ul class="facts">
                    ${profile.funFacts.map(
                      (_f, i) =>
                        html`<li class="fact">${loc.text((_m, ct) => ct.funFacts[i]!)}</li>`,
                    )}
                  </ul>
                </section>`
              : ""
          }

          <details class="about">
            <summary>${loc.text((m) => m.about)}</summary>
            <p>
              ${loc.text(
                (m) =>
                  `${m.engine(RUNNER_NAMES[profile.engine.runner], profile.engine.model)} · ${m.generatedAt(formatDateTime(profile.generatedAt, tz, m.locale))}`,
              )}
            </p>
            <p>
              ${loc.text(
                (m) =>
                  `${m.evidenceVerified(c.evidenceKept, c.evidenceDropped)}${c.chunksFailed > 0 ? ` · ${m.chunksSkipped(c.chunksFailed)}` : ""}`,
              )}
            </p>
            <p>${loc.text((m) => m.privacy)}</p>
            <p>prompt-profile · npx prompt-profile</p>
          </details>
        </div>
      </body>
    </html> `
  return page.value
}
