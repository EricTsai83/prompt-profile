import { DateTime } from "effect"
import type { Dimension, Evidence, Profile, Trait } from "../domain/Profile.ts"
import { peakHour, type Stats } from "../domain/Stats.ts"
import { displayFontDataUrl } from "./fonts.ts"
import { graphicSvg, svgDataUrl } from "./graphic.ts"
import { html, raw, type Raw } from "./html-template.ts"
import {
  DEFAULT_RENDER_OPTIONS,
  lookOf,
  type Look,
  type RenderOptions,
  type ReportTokens,
} from "./looks.ts"
import { messages, type Messages } from "./messages.ts"

const RUNNER_NAMES = { "claude-code": "Claude Code", codex: "Codex" } as const

/** The report's language (Intl formatting and `<html lang>`). */
const LANG = "en"

const formatDate = (t: DateTime.Utc, timeZone: string): string =>
  new Intl.DateTimeFormat(LANG, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(DateTime.toEpochMillis(t))

const formatDateTime = (t: DateTime.Utc, timeZone: string): string =>
  new Intl.DateTimeFormat(LANG, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(DateTime.toEpochMillis(t))

const percent = (x: number) => `${Math.round(x * 100)}%`

/** Weekday × hour heatmap as inline SVG (no chart library). */
export const heatmapSvg = (grid: Stats["activityGrid"], t: Messages): Raw => {
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
        ><title>${t.weekdays[w]} ${String(h).padStart(2, "0")}:00 · ${n}</title></rect
      >`
    }),
  )
  const hours = [0, 3, 6, 9, 12, 15, 18, 21].map(
    (h) =>
      html`<text x="${left + h * (cell + gap) + cell / 2}" y="14" text-anchor="middle" class="axis"
        >${String(h).padStart(2, "0")}</text
      >`,
  )
  const days = t.weekdays.map(
    (d, w) =>
      html`<text
        x="${left - 8}"
        y="${top + w * (cell + gap) + cell / 2 + 4}"
        text-anchor="end"
        class="axis"
        >${d}</text
      >`,
  )
  return html`<svg
    viewBox="0 0 ${width} ${height}"
    role="img"
    aria-label="${t.heatmap}"
    class="heatmap"
  >
    ${hours}${days}${cells}
  </svg>`
}

const evidenceList = (evidence: ReadonlyArray<Evidence>, t: Messages): Raw =>
  evidence.length === 0
    ? html``
    : html`<details>
        <summary>${t.showEvidence(evidence.length)}</summary>
        <ul class="evidence">
          ${evidence.map((e) => html`<li><blockquote>${e.quote}</blockquote></li>`)}
        </ul>
      </details>`

const traitCard = (trait: Trait, t: Messages): Raw =>
  html`<article class="card trait">
    <header>
      <h3>${trait.name}</h3>
      <span class="badge ${trait.confidence}">${t.confidence[trait.confidence]}</span>
    </header>
    <p>${trait.description}</p>
    ${evidenceList(trait.evidence, t)}
  </article>`

const dimensionCard = (d: Dimension, t: Messages): Raw =>
  html`<article class="card dimension">
    <p class="eyebrow">${t.dimensionNames[d.key]}</p>
    <h3>${d.title}</h3>
    <p>${d.summary}</p>
    ${
      d.evidence.length === 0
        ? html`<p class="warning">${t.insufficientEvidence}</p>`
        : evidenceList(d.evidence, t)
    }
  </article>`

const statTile = (label: string, value: string): Raw =>
  html`<div class="stat">
    <div class="value">${value}</div>
    <div class="label">${label}</div>
  </div>`

const STYLE = `
:root{color-scheme:light dark;--bg:#f7f7f5;--fg:#1d1d1f;--muted:#6b6b70;--card:#fff;--border:#e4e4e0;--accent:#5b5bd6;--accent-soft:#ececfb;--warn:#a15c00;--empty:#ececea}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--fg:#ececee;--muted:#9a9aa2;--card:#1c1c20;--border:#2c2c33;--accent:#9d9dff;--accent-soft:#25254a;--warn:#f0b35a;--empty:#26262c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif}
main{max-width:960px;margin:0 auto;padding:48px 20px 64px}
h1,h2,h3{line-height:1.25;margin:0}
h1{font-size:clamp(28px,5vw,44px);margin:8px 0 12px}
h2{font-size:22px;margin:56px 0 16px}
h3{font-size:18px}
p{margin:8px 0}
.eyebrow{color:var(--accent);font-weight:600;font-size:13px;letter-spacing:.04em;text-transform:uppercase;margin:0}
.hero .archetype{font-size:20px;font-weight:600}
.meta{color:var(--muted);font-size:14px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.stat,.card{background:var(--card);border:1px solid var(--border);border-radius:14px}
.stat{padding:16px}
.stat .value{font-size:24px;font-weight:700}
.stat .label{color:var(--muted);font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.card{padding:18px 20px}
.card header{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.badge{font-size:12px;padding:2px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent);white-space:nowrap}
.badge.low{opacity:.7}
details{margin-top:10px}
summary{cursor:pointer;color:var(--accent);font-size:14px}
.evidence{list-style:none;padding:0;margin:8px 0 0}
blockquote{margin:6px 0;padding:6px 12px;border-left:3px solid var(--accent);color:var(--muted);font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}
.warning{color:var(--warn);font-size:14px}
.heatmap{width:100%;height:auto}
.heatmap .cell{fill:var(--accent)}
.heatmap .cell[data-empty="true"]{fill:var(--empty)}
.heatmap .axis{fill:var(--muted);font-size:11px}
.facts{padding-left:20px}
.facts li{margin:6px 0}
footer{margin-top:64px;padding-top:20px;border-top:1px solid var(--border);color:var(--muted);font-size:13px}
footer p{margin:4px 0}
`

const tokens = (t: ReportTokens) =>
  `--bg:${t.bg};--fg:${t.fg};--muted:${t.muted};--card:${t.card};--border:${t.border};--accent:${t.accent};--accent-soft:${t.accentSoft};--warn:${t.warn};--empty:${t.empty}`

/** A look's overrides on top of STYLE: colors, the embedded display font, the identity hero. */
const lookStyle = (look: Look): string => {
  const id = look.identity
  return `
@font-face{font-family:Bricolage;src:url(${displayFontDataUrl()}) format("woff");font-weight:800}
:root{${tokens(look.light)}}
@media (prefers-color-scheme:dark){:root{${tokens(look.dark)}}}
h1,h2{font-family:Bricolage,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:800;letter-spacing:-.02em}
.identity{position:relative;overflow:hidden;background:${id.background};color:${id.text};border-radius:24px;padding:40px;margin-top:8px}
.identity .split{position:absolute;right:0;top:0;bottom:0;width:34%;background:${id.split ?? "transparent"}}
.identity .copy{position:relative;max-width:62%}
.identity .eyebrow,.identity .meta,.identity .headline{color:${id.muted}}
.identity h1{font-size:clamp(34px,6vw,64px);line-height:1;margin:12px 0 16px}
.identity .headline{font-size:19px}
.identity .graphic{position:absolute;right:32px;top:50%;transform:translateY(-50%);width:min(30%,300px);height:auto}
@media (max-width:640px){.identity{padding:28px 22px}.identity .copy{max-width:none}.identity .graphic{position:static;transform:none;display:block;width:60%;margin:20px 0 0 auto}.identity .split{display:none}}
`
}

const meta = (profile: Profile, t: Messages, period: string | null): Raw => {
  const c = profile.coverage
  return html`<p class="meta">
    ${period}${period ? " · " : ""}${t.coverage(c.promptsAnalyzed, c.sessionsAnalyzed)}${
      c.sampled ? html` · ${t.sampled(c.chunksAnalyzed, c.chunksTotal)}` : ""
    }
  </p>`
}

/** The first section of a look: archetype first, on the look's identity colors. */
const identityHero = (profile: Profile, look: Look, t: Messages, period: string | null): Raw => {
  const g = graphicSvg(look.identity.graphic, profile.stats.hourHistogram, look.identity)
  return html`<section class="hero identity">
    ${look.identity.split ? html`<div class="split"></div>` : ""}
    <div class="copy">
      <p class="eyebrow">${t.title}</p>
      <h1>${profile.archetype.name}</h1>
      <p class="headline">${profile.headline}</p>
      <p>${profile.archetype.description}</p>
      ${meta(profile, t, period)}
    </div>
    <img class="graphic" src="${svgDataUrl(g.svg)}" alt="${t.graphicAlt}" />
  </section>`
}

/** Render a self-contained, offline HTML report (no external requests, no JavaScript). */
export const renderHtml = (
  profile: Profile,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
): string => {
  const look = lookOf(options.look)
  const t = messages
  const s = profile.stats
  const tz = s.timezone
  const c = profile.coverage
  const peak = peakHour(s)
  const period = s.dateRange
    ? t.period(formatDate(s.dateRange.from, tz), formatDate(s.dateRange.to, tz))
    : null
  const page = html`<!doctype html>
    <html lang="${LANG}"${look ? raw(` data-look="${look.id}"`) : ""}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="referrer" content="no-referrer" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src 'unsafe-inline'; img-src data:${look ? "; font-src data:" : ""}"
        />
        <title>${t.title} · ${profile.archetype.name}</title>
        <style>
          ${raw(STYLE)}${look ? raw(lookStyle(look)) : ""}
        </style>
      </head>
      <body>
        <main>
          ${
            look
              ? identityHero(profile, look, t, period)
              : html`<section class="hero">
                  <p class="eyebrow">${t.title}</p>
                  <h1>${profile.headline}</h1>
                  <p class="archetype">${profile.archetype.name}</p>
                  <p>${profile.archetype.description}</p>
                  ${meta(profile, t, period)}
                </section>`
          }

          <h2>${t.numbers}</h2>
          <section class="stats">
            ${statTile(t.totalPrompts, s.totalPrompts.toLocaleString(LANG))}
            ${statTile(t.peakHour, peak === null ? t.none : `${String(peak).padStart(2, "0")}:00`)}
            ${statTile(t.languageMix, `${percent(s.languageMix.zh)} / ${percent(s.languageMix.en)} / ${percent(s.languageMix.mixed)}`)}
            ${statTile(t.longestStreak, t.days(s.longestStreakDays))}
            ${statTile(t.latestTime, s.latestTime ?? t.none)}
            ${statTile(t.activeDays, t.days(s.activeDays))}
            ${statTile(t.correctionRate, percent(s.correctionRate))}
          </section>

          <h2>${t.heatmap}</h2>
          <section class="card">${heatmapSvg(s.activityGrid, t)}</section>

          <h2>${t.traits}</h2>
          <section class="grid">${profile.traits.map((x) => traitCard(x, t))}</section>

          <h2>${t.dimensions}</h2>
          <section class="grid">${profile.dimensions.map((d) => dimensionCard(d, t))}</section>

          ${
            profile.funFacts.length > 0
              ? html`<h2>${t.funFacts}</h2>
                  <ul class="facts">
                    ${profile.funFacts.map((f) => html`<li>${f}</li>`)}
                  </ul>`
              : ""
          }

          <footer>
            <p>
              ${t.engine(RUNNER_NAMES[profile.engine.runner], profile.engine.model)} ·
              ${t.generatedAt(formatDateTime(profile.generatedAt, tz))}
            </p>
            <p>
              ${t.evidenceVerified(c.evidenceKept, c.evidenceDropped)}${c.chunksFailed > 0 ? html` · ${t.chunksSkipped(c.chunksFailed)}` : ""}
            </p>
            <p>${t.privacy}</p>
            <p>${t.project} · npx prompt-profile</p>
          </footer>
        </main>
      </body>
    </html> `
  return page.value
}
