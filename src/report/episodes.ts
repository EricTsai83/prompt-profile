import type { DateTime } from "effect"
import type { Episode } from "../domain/Episode.ts"
import type { Language, Profile } from "../domain/Profile.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { EPISODE_MESSAGES } from "./messages.ts"
import type { Scrub, Visibility } from "./visibility.ts"
import { defined, definition } from "./definition.ts"

type EpisodeMessages = (typeof EPISODE_MESSAGES)[Language]

/** A turn's date as the report shows it: exact, or the month with `--exclude dates`. */
export type When = (t: DateTime.Utc, lang: Language) => string

/** The user's turns in order, with the prompts between and around them marked as not shown. */
const turnList = (e: Episode, loc: Loc, v: Visibility, scrub: Scrub, when: When): Raw => {
  const gap = (pick: (m: EpisodeMessages) => string) =>
    html`<li class="turn-gap">${loc.text((_m, _c, l) => pick(EPISODE_MESSAGES[l]))}</li>`
  const first = e.turns[0]?.turn ?? 1
  const last = e.turns.at(-1)?.turn ?? e.sessionTurns
  return html`<ol class="episode-turns">
    ${first > 1 ? gap((m) => m.earlier(first - 1)) : ""}
    ${e.turns.map(
      (
        t,
        i,
      ) => html`${i > 0 && t.turn - e.turns[i - 1]!.turn > 1 ? gap((m) => m.gap(t.turn - e.turns[i - 1]!.turn - 1)) : ""}<li>
        <p class="turn-meta">${loc.text((_m, _c, l) => `${EPISODE_MESSAGES[l].turn(t.turn, e.sessionTurns)} · ${EPISODE_MESSAGES[l].roles[t.role]} · ${when(t.time, l)}`)}</p>
        ${v.quotes ? html`<blockquote>${loc.text((_m, _c, l) => scrub(t.quote, l))}</blockquote>` : ""}
      </li>`,
    )}
    ${last < e.sessionTurns ? gap((m) => m.later(e.sessionTurns - last)) : ""}
  </ol>`
}

const endingText = (e: Episode, l: Language): string => {
  const m = EPISODE_MESSAGES[l].ending
  const turn = e.turns.find((t) => t.promptId === e.ending.promptId)?.turn
  return e.ending.kind === "unknown" || turn === undefined ? m.unknown() : m[e.ending.kind](turn)
}

/**
 * The facts page's record of how selected conversations unfolded, and the habits recurring
 * across them. Null for profiles from before episodes were analysed.
 */
export const episodesSection = (
  p: Profile,
  loc: Loc,
  v: Visibility,
  scrub: Scrub,
  when: When,
): Raw | null => {
  const coverage = p.coverage.episodes
  if (coverage === null && p.episodes.length === 0) return null
  const sessions = [...new Set(p.episodes.map((e) => e.session))]
  const rejected = coverage ? Object.values(coverage.rejected).reduce((sum, n) => sum + n, 0) : 0
  const text = (pick: (m: EpisodeMessages, l: Language) => string) =>
    loc.text((_m, _c, l) => pick(EPISODE_MESSAGES[l], l))
  const notes = [
    ...(p.episodes.length === 0
      ? []
      : [
          (m: EpisodeMessages) =>
            m.note(
              p.episodes.length,
              coverage?.kept ?? p.episodes.length,
              p.coverage.sessionsAnalyzed,
              p.stats.totalSessions,
            ),
        ]),
    (m: EpisodeMessages) => m.userOnly,
    ...(rejected > 0 ? [(m: EpisodeMessages) => m.rejected(rejected)] : []),
    ...(coverage && coverage.endingsWithdrawn > 0
      ? [(m: EpisodeMessages) => m.withdrawn(coverage.endingsWithdrawn)]
      : []),
  ]
  const links = (ids: ReadonlyArray<string>) =>
    ids
      .flatMap((id) => {
        const index = p.episodes.findIndex((e) => e.id === id)
        if (index < 0) return []
        return [
          html`<a href="#episode-${id}">${loc.text((_m, _c, l) => scrub(p.translations[l]?.episodes[index]?.task ?? p.episodes[index]!.task, l))}</a>`,
        ]
      })
      .map((link, i) => html`${i > 0 ? ", " : ""}${link}`)
  return html`<section class="episodes">
    ${defined(html`<h2>${text((m) => m.title)}</h2>`, definition(loc, ...notes.map((pick) => text(pick))))}
    ${p.episodes.length === 0 ? html`<p class="note">${text((m) => m.none)}</p>` : ""}
    ${
      p.patterns.length > 0
        ? html`<h3>${text((m) => m.patterns)}</h3>
          <ul class="episode-patterns">
            ${p.patterns.map(
              (pattern, i) => html`<li>
                <p>${loc.text((_m, _c, l) => scrub(p.translations[l]?.patterns[i]?.claim ?? pattern.claim, l))}</p>
                <p class="note">${text((m) => m.spread(pattern.support.sessions, pattern.support.weeks))} · ${text((m) => m.shownIn)}: ${links(pattern.episodeIds)}${pattern.counterEpisodeIds.length > 0 ? html` · ${text((m) => m.against)}: ${links(pattern.counterEpisodeIds)}` : ""}</p>
              </li>`,
            )}
          </ul>`
        : ""
    }
    ${
      p.episodes.length > 0
        ? html`<ol class="episode-list">
          ${p.episodes.map(
            (e, i) => html`<li class="episode" id="episode-${e.id}">
              <h3>${loc.text((_m, _c, l) => scrub(p.translations[l]?.episodes[i]?.task ?? e.task, l))}</h3>
              <p class="episode-meta">${text((m) => [m.taskTypes[e.taskType], m.conversation(sessions.indexOf(e.session) + 1, e.sessionTurns), ...(e.split ? [m.split] : [])].join(" · "))}</p>
              ${turnList(e, loc, v, scrub, when)}
              <p class="episode-ending">${text((_m, l) => endingText(e, l))}</p>
            </li>`,
          )}
        </ol>`
        : ""
    }
  </section>`
}

export const episodesStyle = `
.episodes>h2{font-size:var(--text-xl);margin:36px 0 0}
.episodes>.note{margin:8px 0 0;max-width:var(--reading);color:var(--muted);font-size:var(--text-sm)}
.episodes h3{font-size:var(--text-base);margin:20px 0 8px}
.episode-patterns,.episode-list,.episode-turns{list-style:none;margin:0;padding:0}
.episode-patterns>li{padding:12px 0;border-top:1px solid var(--border)}
.episode-patterns .note{margin-top:4px;color:var(--muted);font-size:var(--text-sm)}
.episode{padding:16px 0;border-top:1px solid var(--border);break-inside:avoid}
.episode-id{font-size:var(--text-sm);color:var(--muted);margin-right:6px}
.episode-meta,.turn-meta,.turn-gap,.episode-ending{color:var(--muted);font-size:var(--text-sm)}
.episode-turns{margin:10px 0 0 4px;padding-left:16px;border-left:2px solid var(--border)}
.episode-turns>li{margin:10px 0}
.episode-turns blockquote{margin:4px 0 0;line-height:1.7;overflow-wrap:anywhere}
.turn-gap{font-style:italic}
.episode-ending{margin-top:8px}
`
