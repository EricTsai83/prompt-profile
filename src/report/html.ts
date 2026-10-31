import type { DateTime } from "effect"
import type { Profile } from "../domain/index.ts"
import {
  chaptersSection,
  chronotypeText,
  measuredPanels,
  rhythmSection,
  signatureTiles,
} from "./activity.ts"
import { avatarFor, avatarPortrait, avatarStyle } from "./avatar.ts"
import { chartStyle, radialClock, type ChartView } from "./charts.ts"
import { coachingSection } from "./coaching.ts"
import { understandingSection, collaborationStyle } from "./collaboration.ts"
import { contentIn } from "./content.ts"
import { defined, definition, definitionStyle, disclosureStyle, defText } from "./definition.ts"
import { chronotype } from "./derive.ts"
import { documentLayoutStyle } from "./document-layout.ts"
import { episodesSection, episodesStyle } from "./episodes.ts"
import { isLimitedEvidence, limitedView } from "./evidence.ts"
import { daysBetween, formatDate, formatDateTime, formatMonth, RUNNER_NAMES } from "./format.ts"
import { generationSection } from "./generation.ts"
import { graphicSvg, svgDataUrl } from "./graphic.ts"
import { historySection, historyStyle } from "./history.ts"
import { html, raw, type Raw } from "./html-template.ts"
import { LANG_TAGS, makeLoc, type Loc } from "./loc.ts"
import {
  DEFAULT_RENDER_OPTIONS,
  excludedParts,
  type ReportPart,
  type RenderOptions,
} from "./looks.ts"
import {
  AVATAR_MESSAGES,
  HISTORY_MESSAGES,
  LIBRARY_MESSAGES,
  MESSAGES,
  NARRATION_MESSAGES,
  viewMessages,
  type Messages,
} from "./messages.ts"
import { workflowCharts, viewStyle } from "./overview.ts"
import { BASE_STYLE, languageStyle } from "./page-style.ts"
import { portraitStory, portraitStyle, preferenceEvidence } from "./portrait.ts"
import { steeringSection, steeringStyle } from "./steering.ts"
import { techniquesSection, techniqueStyle } from "./techniques.ts"
import { identityMoves, identitySignatures, variantStyle } from "./templates.ts"
import { lookOf, type Theme } from "./theme.ts"
import { displayStyle, generationStyle, themeAttributes, themeCss } from "./theme-css.ts"
import { dimensionsSection, makeVerbatim, traitsSection } from "./traits.ts"
import { usageSection, usageStyle } from "./usage.ts"
import { makeScrub, visibilityOf, type Visibility } from "./visibility.ts"

/** How the report was measured: engine, evidence kept, parts left out and privacy. */
const aboutSection = (
  profile: Profile,
  loc: Loc,
  v: Visibility,
  excluded: ReadonlyArray<ReportPart>,
): Raw => {
  const c = profile.coverage
  const tz = profile.stats.timezone
  return html`<section class="about">
                  <h2>${loc.text((m) => m.howMeasured)}</h2>
                  <p>
                    ${loc.text(
                      (m, _c, l) =>
                        `${m.engine(RUNNER_NAMES[profile.engine.runner], profile.engine.model, profile.engine.effort)} · ${m.generatedAt((v.dates ? formatDateTime : formatMonth)(profile.generatedAt, tz, m.locale))}${profile.engine.model && profile.engine.modelSource !== "reported" ? ` · ${HISTORY_MESSAGES[l].unverifiedModel}` : ""}`,
                    )}
                  </p>
                  <p>
                    ${loc.text(
                      (m) =>
                        `${m.evidenceVerified(c.evidenceKept, c.evidenceDropped)}${c.chunksFailed > 0 ? ` · ${m.chunksSkipped(c.chunksFailed)}` : ""}`,
                    )}
                  </p>
                  ${(c.narrativeRejected ?? 0) > 0 ? html`<p class="note">${loc.text((_m, _c, l) => HISTORY_MESSAGES[l].narrativeLimit)}</p>` : ""}
                  ${excluded.length > 0 ? html`<p>${loc.text((m) => m.leftOut(excluded.join(", ")))}</p>` : ""}
                  <p>${loc.text((m) => m.privacy)}</p>
                </section>`
}

/** Render a self-contained, offline HTML report (no external requests, no JavaScript). */
export const renderHtml = (
  input: Profile,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
  // Every look-specific choice comes from the theme; tests pass one that is not registered.
  theme: Theme = lookOf(options.look),
) => {
  // Limited evidence: no role or coaching, the hero states the limits instead (plan 24).
  const limited = isLimitedEvidence(input)
  const profile = limitedView(input)
  const identity = theme.identity
  const clock = theme.layout.hero === "clock"
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
  const windowText = chronotypeText(s, loc)
  const period = s.dateRange
  /** A period as the hero shows it: exact dates, or months with `--exclude dates`. */
  const periodOf =
    (range: { readonly from: DateTime.Utc; readonly to: DateTime.Utc } | null) =>
    (m: Messages): string => {
      if (range === null) return m.none
      const days = daysBetween(range.from, range.to, tz)
      return v.dates
        ? `${m.period(formatDate(range.from, tz, m.locale), formatDate(range.to, tz, m.locale))} · ${m.days(days)}`
        : `${m.period(formatMonth(range.from, tz, m.locale), formatMonth(range.to, tz, m.locale))} · ${days < 45 ? m.days(days) : m.months(Math.round(days / 30.44))}`
    }
  const periodText = periodOf(period)
  const def = defText(loc)
  const steering = steeringSection(profile, loc, v, scrub)
  // Coaching, like `--exclude coaching`, is the suggestions, signals and "since your last report".
  const coaching = v.coaching && !limited
  const story = portraitStory(profile, loc, v, scrub)
  const preferences = preferenceEvidence(profile, loc, v, scrub)
  const episodes = episodesSection(profile, loc, v, scrub, (t, l) =>
    v.dates ? formatDate(t, tz, MESSAGES[l].locale) : formatMonth(t, tz, MESSAGES[l].locale),
  )
  const tech = techniquesSection(s, loc, v, makeVerbatim(loc, v, scrub))
  // the usage's own period: it is summed over the whole window, not only the prompts' days
  const usagePeriod = periodOf(profile.usage?.range ?? null)
  const usage = usageSection(profile, loc, v, (l) => usagePeriod(MESSAGES[l]))
  const avatar = avatarFor(profile, options.avatar)
  const graphic =
    avatar ?? (!clock ? graphicSvg(identity.graphic, s.hourHistogram, identity) : null)

  const heroFacts = html`              <dl class="report-facts">
                <div>
                  <dt>${loc.text((m) => m.dataPeriod)} ${definition(
                    loc,
                    def((m) => m.dataPeriod),
                  )}</dt>
                  <dd>
                    ${loc.text(periodText)}
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
                  <dt>${loc.text((m) => m.analyzed)} ${definition(
                    loc,
                    def((m) => m.analyzed),
                  )}</dt>
                  <dd>
                    ${loc.text((m, _c, l) =>
                      [
                        m.coverage(c.promptsAnalyzed, c.sessionsAnalyzed),
                        profile.voice ? NARRATION_MESSAGES[l][profile.voice] : null,
                        profile.context
                          ? m.contextCoverage(
                              profile.context.selected,
                              profile.context.excluded,
                              profile.context.missing,
                            )
                          : null,
                        c.sampled ? m.sampled(c.chunksAnalyzed, c.chunksTotal) : null,
                        c.chunksFailed > 0 ? m.chunksSkipped(c.chunksFailed) : null,
                      ]
                        .filter((x) => x !== null)
                        .join(" · "),
                    )}
                  </dd>
                </div>
              </dl>`
  const page = html`<!doctype html>
    <html lang="${LANG_TAGS[loc.langs[0]!]}" ${raw(themeAttributes(theme))}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="referrer" content="no-referrer" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src 'unsafe-inline'; img-src data:${theme.type.display ? "; font-src data:" : ""}"
        />
        <title>${scrub(contentIn(profile, "en").archetype.name, "en")} · ${viewMessages(loc.langs[0]!, profile.voice).brand(options.name ?? null)}</title>
        <style>
          ${raw(themeCss(theme))}${raw(viewStyle)}${story ? raw(portraitStyle) : ""}${raw(BASE_STYLE)}${raw(generationStyle)}${raw(collaborationStyle)}${raw(historyStyle)}${raw(avatarStyle)}${raw(chartStyle(loc.langs))}${raw(techniqueStyle)}${usage ? raw(usageStyle) : ""}${episodes ? raw(episodesStyle) : ""}${steering ? raw(steeringStyle) : ""}${raw(displayStyle(theme))}${raw(languageStyle(loc.langs))}
        ${raw(definitionStyle)}${raw(disclosureStyle)}${raw(variantStyle)}${raw(documentLayoutStyle)}
.experiment-print-copy{display:none}
@media print{.experiment-print-copy{display:block;white-space:pre-wrap;overflow-wrap:anywhere}.improve textarea,.experiment-copy-help{display:none!important}}
</style>
      </head>
      <body>
        <input type="radio" name="report-view" id="report-overview" class="view-input" aria-label="${loc.attr((_m, _c, l) => viewMessages(l, profile.voice).overview)}" checked />
        <input type="radio" name="report-view" id="report-detail" class="view-input" aria-label="${loc.attr((_m, _c, l) => viewMessages(l, profile.voice).detail)}" />
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
            <span class="brand">${loc.text((_m, _c, l) => viewMessages(l, profile.voice).brand(options.name ?? null))}</span>
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
          ${options.libraryHref && /^(?:\.\.\/)+index\.html$/u.test(options.libraryHref) ? html`<p class="library-back"><a href="${options.libraryHref}">${loc.text((_m, _c, l) => LIBRARY_MESSAGES[l].back)}</a></p>` : ""}
          <nav class="view-nav" aria-label="${loc.attr((_m, _c, l) => viewMessages(l, profile.voice).navigation)}">
            <label for="report-overview">${loc.text((_m, _c, l) => viewMessages(l, profile.voice).overview)}</label>
            <label for="report-detail">${loc.text((_m, _c, l) => viewMessages(l, profile.voice).detail)}</label>
          </nav>
          <main>
          <section id="overview" class="report-view report-view-overview" aria-label="${loc.attr((_m, _c, l) => viewMessages(l, profile.voice).overview)}">
          <section class="hero">
            ${identity.split ? html`<div class="split"></div>` : ""}
            <div class="copy">
              <h1>${loc.text((_m, ct, l) => scrub(ct.archetype.name, l))}</h1>
              <p class="tagline">${loc.text((_m, ct, l) => scrub(ct.headline, l))}</p>
              <p class="desc">${loc.text((_m, ct, l) => scrub(ct.archetype.description, l))}</p>
              ${clock ? "" : html`<p class="chrono">${windowText}</p>`}
              ${avatar ? "" : heroFacts}
            </div>
            ${avatar ? heroFacts : ""}
            ${theme.layout.signatures === "none" ? "" : identitySignatures(profile, loc, scrub)}${
              graphic
                ? avatar
                  ? html`<picture class="graphic role-avatar" data-avatar="${avatar.id}">
                    <source media="(min-width:761px)" srcset="${svgDataUrl(avatarPortrait(avatar).svg)}" />
                    <img src="${svgDataUrl(avatar.svg)}" alt="${loc.attr((_m, _c, l) => AVATAR_MESSAGES[l].alt[avatar.kind])}" />
                  </picture>`
                  : html`<img class="graphic" src="${svgDataUrl(graphic.svg)}" alt="${loc.attr((m) => m.graphicAlt)}" />`
                : html`<div class="hero-clock">${radialClock(s, window, windowText)}</div>`
            }
          </section>


          <header class="view-heading"><h2>${loc.text((_m, _c, l) => viewMessages(l, profile.voice).overviewTitle)}</h2><p>${loc.text((_m, _c, l) => viewMessages(l, profile.voice).overviewNote)}</p></header>
          ${identityMoves(profile, loc, scrub, theme.layout.signatures === "none", v.quotes ? makeVerbatim(loc, v, scrub) : null)}
          ${story ?? ""}
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

          <label class="page-turn" for="report-detail">${loc.text((_m, _c, l) => viewMessages(l, profile.voice).next)}</label>
          </section>
          <section id="detail" class="report-view report-view-detail" aria-label="${loc.attr((_m, _c, l) => viewMessages(l, profile.voice).detail)}">
          <header class="view-heading"><h2>${loc.text((_m, _c, l) => viewMessages(l, profile.voice).detailTitle)}</h2><p>${loc.text((_m, _c, l) => viewMessages(l, profile.voice).detailNote)}</p></header>
          ${signatureTiles(profile, loc)}

          ${workflowCharts(profile, loc)}
          ${rhythmSection(profile.stats, loc, v, view)}

          ${chaptersSection(profile.stats, loc, view)}

                  ${measuredPanels(profile.stats, loc)}

          ${traitsSection(profile, loc, v, scrub)}

          ${preferences ?? ""}${historySection(profile, loc, v, scrub)}${understandingSection(profile, loc, v, scrub)}

          ${steering ?? ""}

          ${episodes ?? ""}

          ${dimensionsSection(profile, loc, v, scrub)}

          ${
            tech
              ? html`<section class="techniques">
                  <div class="section-head">
                    ${defined(
                      html`<h2>${loc.text((m) => m.techniques)}</h2>`,
                      definition(
                        loc,
                        loc.text((m) => m.techniquesNote),
                        ...(s.techniques
                          ? [loc.text((m) => m.coverageNote(s.techniques!.coveredSessions))]
                          : []),
                      ),
                    )}
                  </div>
                  ${tech}
                </section>`
              : ""
          }

          ${coaching ? coachingSection(profile, loc, v, scrub) : ""}

          ${usage ?? ""}
          ${generationSection(profile, loc, v) ?? ""}

          ${aboutSection(profile, loc, v, excluded)}
          <label class="page-turn" for="report-overview">${loc.text((_m, _c, l) => viewMessages(l, profile.voice).back)}</label>
          </section>
          </main>
          <footer class="foot">prompt-profile · npx prompt-profile</footer>
        </div>
      </body>
    </html> `
  return page.value.replace(/[ \t]+$/gm, "")
}
