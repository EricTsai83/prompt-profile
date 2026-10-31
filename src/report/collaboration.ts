import { sourceLabel } from "./evidence-origin.ts"
import { UNDERSTANDING_KINDS, type Profile } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { COLLABORATION_MESSAGES, EPISODE_MESSAGES } from "./messages.ts"
import type { Scrub, Visibility } from "./visibility.ts"
import { defined, definition } from "./definition.ts"

type Signal = NonNullable<Profile["collaboration"]>["signals"][number]
/** Conversations a signal needs to be shown as recurring rather than folded as a one-off. */
const MIN_SIGNAL_SESSIONS = 2

export const structuredMoves = (
  p: Profile,
  loc: Loc,
  scrub: Scrub,
  quote: ((s: string) => Raw | string) | null,
): Raw | null => {
  const moves = p.collaboration?.moves
  if (!moves?.length) return null
  // each conversation illustrates one habit here; the facts view lists every episode
  const shown = new Set<string>()
  return html`<section class="identity-moves structured-moves">
    <h2>${loc.text((_m, _c, l) => COLLABORATION_MESSAGES[l].moveTitle)}</h2>
    <p class="note">${loc.text((_m, _c, l) => COLLABORATION_MESSAGES[l].habitIntro)}</p>
    <ul>${moves.map((m, i) => {
      const supporting = p.episodes.filter((e) => m.episodeIds.includes(e.id))
      const selected = supporting
        .filter((e, index) => supporting.findIndex((x) => x.session === e.session) === index)
        .filter((e) => !shown.has(e.session))
        .slice(0, 2)
      for (const e of selected) shown.add(e.session)
      return html`<li>
        <h3>${loc.text((_m, _c, l) => scrub(p.translations[l]?.collaboration?.moves[i]?.name ?? m.name, l))}</h3>
        <p>${loc.text((_m, _c, l) => scrub(p.translations[l]?.collaboration?.moves[i]?.description ?? m.description, l))}</p>
        <p>${loc.text((_m, _c, l) => EPISODE_MESSAGES[l].spread(m.support.sessions, m.support.weeks))}</p>
        ${selected.map(
          (
            e,
          ) => html`<article><h4>${loc.text((_m, _c, l) => scrub(p.translations[l]?.episodes[p.episodes.indexOf(e)]?.task ?? e.task, l))}</h4>
          ${quote ? html`<ul>${e.turns.map((t) => html`<li>${quote(t.quote)}</li>`)}</ul>` : ""}
        </article>`,
        )}
        ${(["benefit", "cost"] as const).map((key) => (m[key] ? html`<p><b>${loc.text((_m, _c, l) => COLLABORATION_MESSAGES[l][key])}</b>: ${loc.text((_m, _c, l) => scrub(p.translations[l]?.collaboration?.moves[i]?.[key]?.claim ?? m[key]!.claim, l))}</p>` : ""))}
        <p class="note">${loc.text((_m, _c, l) => (m.benefit || m.cost ? COLLABORATION_MESSAGES[l].effectNote : COLLABORATION_MESSAGES[l].effectsUnknown))}</p>
      </li>`
    })}</ul>
  </section>`
}

export const understandingSection = (
  p: Profile,
  loc: Loc,
  v: Visibility,
  scrub: Scrub,
): Raw => html`<section class="understanding">
  ${defined(
    html`<h2>${loc.text((_m, _c, l) => COLLABORATION_MESSAGES[l].title)}</h2>`,
    definition(
      loc,
      loc.text((_m, _c, l) => COLLABORATION_MESSAGES[l].note),
    ),
  )}
  ${
    !p.collaboration
      ? html`<p class="note">${loc.text((_m, _c, l) => COLLABORATION_MESSAGES[l].legacy)}</p>`
      : UNDERSTANDING_KINDS.map((kind) => {
          const signals = p.collaboration!.signals.filter((s) => s.kind === kind)
          const signal = (s: Signal) => {
            const index = p.collaboration!.signals.indexOf(s)
            return html`<p>${loc.text((_m, _c, l) => scrub(p.translations[l]?.collaboration?.signals[index]?.observation ?? s.observation, l))}</p>
          <p class="note">${loc.text((_m, _c, l) => `${s.basis === "user_request" ? COLLABORATION_MESSAGES[l].requested : COLLABORATION_MESSAGES[l].reported} · ${scrub(p.translations[l]?.collaboration?.signals[index]?.context ?? s.context, l)} · ${EPISODE_MESSAGES[l].spread(s.support.sessions, s.support.weeks)}`)}</p>
          ${v.quotes ? s.evidence.map((e) => html`<blockquote>${loc.text((_m, _c, l) => scrub(e.quote, l))}${sourceLabel(p, e.promptId, loc, v)}</blockquote>`) : ""}`
          }
          // one conversation is an event, not a recurring signal: kept, but folded away
          const recurring = signals.filter((s) => s.support.sessions >= MIN_SIGNAL_SESSIONS)
          const once = signals.filter((s) => s.support.sessions < MIN_SIGNAL_SESSIONS)
          return html`<article><h3>${loc.text((_m, _c, l) => COLLABORATION_MESSAGES[l].kinds[kind])}</h3>
      ${recurring.length === 0 ? html`<p class="note">${loc.text((_m, _c, l) => COLLABORATION_MESSAGES[l].none)}</p>` : recurring.map(signal)}
      ${once.length === 0 ? "" : html`<details class="signal-once"><summary>${loc.text((_m, _c, l) => COLLABORATION_MESSAGES[l].once(once.length))}</summary>${once.map(signal)}</details>`}
    </article>`
        })
  }
</section>`

export const collaborationStyle = `.understanding{margin:36px 0}.understanding h2{font-size:var(--text-xl)}.understanding article{border-top:1px solid var(--border);padding:16px 0}.understanding h3{font-size:var(--text-base);margin-bottom:8px}.understanding p{line-height:1.8}.understanding .note,.structured-moves .note{font-size:var(--text-sm);color:var(--muted)}.understanding blockquote{margin:12px 0;padding-left:16px;border-left:2px solid var(--accent);overflow-wrap:anywhere;line-height:1.8}.signal-once{margin-top:8px;color:var(--muted)}.signal-once summary{cursor:pointer;font-size:var(--text-sm)}`
