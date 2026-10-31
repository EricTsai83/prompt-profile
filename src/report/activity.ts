import { nightShare, type Profile, type Stats } from "../domain/index.ts"
import {
  calendar,
  chapterStrip,
  donut,
  heatmap,
  projectRanking,
  projectWeeks,
  ring,
  shareBars,
  type ChartView,
} from "./charts.ts"
import { defined, definition, defText } from "./definition.ts"
import { chapters, chronotype, correctionEvery, promptsPerSession } from "./derive.ts"
import { hh, percent, RUNNER_NAMES } from "./format.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { STEERING_MESSAGES } from "./messages.ts"
import type { Visibility } from "./visibility.ts"

/** The busiest window of the day, as text ("none" without one). */
export const chronotypeText = (s: Stats, loc: Loc): Raw => {
  const window = chronotype(s)
  return loc.text((m) =>
    window === null ? m.none : m.chronotype(hh(window.start), hh(window.end)),
  )
}

/** A headline number with its label and, folded behind an ⓘ, its definition. */
const signatureTile = (value: Raw, label: Raw, def: Raw): Raw =>
  html`<div class="sig">
    <b>${value}</b><span class="sig-label">${label} ${def}</span>
  </div>`

/** The headline numbers: night share, median prompt, steering (or corrections), per session. */
export const signatureTiles = (profile: Profile, loc: Loc): Raw => {
  const s = profile.stats
  const steer = profile.steering
  const def = defText(loc)
  const every = correctionEvery(s)
  const perSession = promptsPerSession(s)
  return html`<section class="sigs" aria-label="${loc.attr((m) => m.signature)}">
            ${signatureTile(
              html`${percent(nightShare(s))}%`,
              loc.text((m) => m.nightShare),
              definition(
                loc,
                def((m) => m.nightShare),
              ),
            )}
            ${signatureTile(
              loc.text((m) => m.characters(Math.round(s.promptLength.median))),
              loc.text((m) => m.medianPrompt),
              definition(
                loc,
                def((m) => m.medianPrompt),
              ),
            )}
            ${
              // per conversation when measured; the rule-based rate for older profiles
              steer
                ? signatureTile(
                    loc.text((_m, _c, l) =>
                      STEERING_MESSAGES[l].tile(steer.steer.conversations, steer.withFollowUps),
                    ),
                    loc.text((_m, _c, l) => STEERING_MESSAGES[l].tileLabel),
                    definition(
                      loc,
                      loc.text((_m, _c, l) => STEERING_MESSAGES[l].tileDef),
                      loc.text((_m, _c, l) =>
                        STEERING_MESSAGES[l].denominator(steer.withFollowUps, steer.conversations),
                      ),
                    ),
                  )
                : signatureTile(
                    loc.text((m) => m.corrections(every)),
                    loc.text((m) => m.correctionsLabel),
                    definition(
                      loc,
                      def((m) => m.corrections),
                    ),
                  )
            }
            ${signatureTile(
              html`${perSession === null ? "—" : perSession}`,
              loc.text((m) => m.perSession),
              definition(
                loc,
                def((m) => m.perSession),
              ),
            )}
          </section>`
}

/** Daily volume (with dates only) and the weekday × hour heatmap. */
export const rhythmSection = (s: Stats, loc: Loc, v: Visibility, view: ChartView): Raw => {
  const def = defText(loc)
  const cal = v.dates ? calendar(s, loc, view) : null
  const window = chronotype(s)
  const windowText = chronotypeText(s, loc)
  return html`<section>
            <h2>${loc.text((m) => m.rhythm)}</h2>
            ${
              cal
                ? html`<article class="panel wide">
                    <div class="panel-head">
                      ${defined(
                        html`<h3>${loc.text((m) => m.daily)}</h3>`,
                        definition(
                          loc,
                          def((m) => m.volume),
                        ),
                      )}
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
                ${defined(
                  html`<h3>${loc.text((m) => m.heatmap)}</h3>`,
                  definition(
                    loc,
                    def((m) => m.heatmap),
                  ),
                )}
              </div>
              ${heatmap(s, loc, view)}
              ${
                window
                  ? html`<div class="note def-head">
                      <span>${windowText} · ${loc.text((m) => m.chronotypeShare(percent(window.share)))}</span>
                      ${definition(
                        loc,
                        def((m) => m.window),
                      )}
                    </div>`
                  : ""
              }
            </article>
          </section>`
}

/** Projects: the ranking, the chapters strip and the projects by week; "" without projects. */
export const chaptersSection = (s: Stats, loc: Loc, view: ChartView): Raw | "" => {
  const def = defText(loc)
  const ranking = projectRanking(s, loc, view)
  const weekly = projectWeeks(s, loc, view)
  const strip = chapterStrip(s, chapters(s), loc, view)
  return ranking && weekly && strip
    ? html`<section>
                  <h2>${loc.text((m) => m.chapters)}</h2>
                  <div class="grid g-2r">
                    <article class="panel">
                      ${defined(
                        html`<h3>${loc.text((m) => m.projects)}</h3>`,
                        definition(
                          loc,
                          def((m) => m.projects),
                        ),
                      )}
                      ${ranking}
                    </article>
                    <article class="panel">
                      ${strip}
                      ${defined(
                        html`<h3>${loc.text((m) => m.projectsByWeek)}</h3>`,
                        definition(
                          loc,
                          def((m) => m.projectsByWeek),
                        ),
                      )}
                      ${weekly}
                    </article>
                  </div>
                </section>`
    : ""
}

/** Language mix, sources and prompt habits. */
export const measuredPanels = (s: Stats, loc: Loc): Raw => {
  const def = defText(loc)
  return html`<div class="grid g-3 measured">
                    <article class="panel">
                      ${defined(
                        html`<h3>${loc.text((m) => m.languageMix)}</h3>`,
                        definition(
                          loc,
                          def((m) => m.languageMix),
                        ),
                      )}
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
                      ${defined(
                        html`<h3>${loc.text((m) => m.sources)}</h3>`,
                        definition(
                          loc,
                          def((m) => m.sources),
                        ),
                      )}
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
                      ${defined(
                        html`<h3>${loc.text((m) => m.habits)}</h3>`,
                        definition(
                          loc,
                          def((m) => m.habits),
                        ),
                      )}
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
                  </div>`
}
