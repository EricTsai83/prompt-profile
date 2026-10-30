import { sourceLabel } from "./evidence-origin.ts"
import { axisState, INTERACTION_AXES, MIN_SIDE_SESSIONS, roleCode } from "../domain/Interaction.ts"
import type { Language, Profile } from "../domain/Profile.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { PORTRAIT_MESSAGES, ROLE_CATALOG_MESSAGES, VIEW_MESSAGES } from "./messages.ts"
import type { Scrub, Visibility } from "./visibility.ts"
import { defined, definition } from "./definition.ts"

type Portrait = NonNullable<Profile["portrait"]>

/** Expanded quotes; nothing when quotes are excluded. */
const evidenceList = (
  items: Portrait["chapters"][number]["evidence"],
  loc: Loc,
  v: Visibility,
  scrub: Scrub,
  p: Profile,
): Raw =>
  !v.quotes || items.length === 0
    ? html``
    : html`<details open class="portrait-evidence">
      <summary>${loc.text((m) => m.showEvidence(items.length))}</summary>
      ${items.map((e) => html`<blockquote>${loc.text((_m, _c, l) => scrub(e.quote, l))}${sourceLabel(p, e.promptId, loc, v)}</blockquote>`)}
    </details>`

/** The identity view's story: the introduction and chapters, each with its own quotes. */
export const portraitStory = (p: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw | null => {
  const portrait = p.portrait
  if (!portrait || portrait.chapters.length === 0) return null
  const text = (pick: (t: Portrait) => string, index?: number) =>
    loc.text((_m, _c, l) => {
      const translated = p.translations[l]?.portrait
      if (!translated) return scrub(pick(portrait), l)
      const chapter = index === undefined ? undefined : translated.chapters[index]
      return scrub(
        index === undefined ? translated.introduction : (chapter?.body ?? pick(portrait)),
        l,
      )
    })
  return html`<section class="portrait">
    <h2>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].title)}</h2>
    <p class="portrait-intro">${text((t) => t.introduction)}</p>
    ${portrait.chapters.map(
      (chapter, i) => html`<article class="portrait-chapter">
      <h3>${loc.text((_m, _c, l) => scrub(p.translations[l]?.portrait?.chapters[i]?.title ?? chapter.title, l))}</h3>
      <p>${text(() => chapter.body, i)}</p>
      ${evidenceList(chapter.evidence, loc, v, scrub, p)}
    </article>`,
    )}
  </section>`
}

/**
 * The factual view's record of each preference: its explanation, then every observed way of
 * working with its context, its conversations and its quotes. Ways seen once are listed as such.
 */
export const preferenceEvidence = (
  p: Profile,
  loc: Loc,
  v: Visibility,
  scrub: Scrub,
): Raw | null => {
  const portrait = p.portrait
  if (!portrait || portrait.chapters.length === 0) return null
  const code = roleCode(portrait.axes)
  return html`<section class="preference-evidence">
    ${defined(
      html`<h2>${loc.text((_m, _c, l) => VIEW_MESSAGES[l].preferenceEvidence)} ${code ? html`<small>${code}</small>` : ""}</h2>`,
      definition(
        loc,
        loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].note),
        loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].rule),
      ),
    )}
    ${
      code
        ? html`<article class="role-catalog">
      <h3>${loc.text((_m, c) => c.archetype.name)}</h3>
      <p class="note">${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].catalogNote)}</p>
      ${(["rhythm", "contexts", "friction"] as const)
        .filter((part) => v.coaching || part !== "friction")
        .map(
          (part) => html`<h4>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l][part])}</h4>
        <p>${loc.text((_m, _c, l) => INTERACTION_AXES.map((axis, i) => ROLE_CATALOG_MESSAGES[l][part][axis.key][code[i] === axis.codes[0] ? 0 : 1]).join(" "))}</p>`,
        )}
    </article>`
        : ""
    }
    ${portrait.axes.map((axis, a) => {
      const state = axisState(axis)
      const translated = (l: Language) => p.translations[l]?.portrait?.axes[a]
      return html`<div class="portrait-axis">
      <b>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[axis.key][0])}</b>
      <span>${loc.text((_m, _c, l) => (state === "none" ? PORTRAIT_MESSAGES[l].notObserved : state === "both" ? PORTRAIT_MESSAGES[l].both : PORTRAIT_MESSAGES[l].axes[axis.key][state === "first" ? 1 : 2]))}</span>
      ${axis.explanation ? html`<p>${loc.text((_m, _c, l) => scrub(translated(l)?.explanation ?? axis.explanation, l))}</p>` : ""}
      ${axis.coverage ? html`<p class="note">${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].choiceCoverage(axis.coverage!.citedSessions, axis.coverage!.analysedSessions, axis.coverage!.periods))}</p>` : ""}
      ${axis.sides.map(
        (side, i) => html`<div class="axis-side">
        <h3>${loc.text((_m, _c, l) => {
          const m = PORTRAIT_MESSAGES[l]
          const context = translated(l)?.sides[i]?.context ?? side.context
          const seen = side.sessions >= MIN_SIDE_SESSIONS ? m.seenIn(side.sessions) : m.seenOnce
          return [
            m.axes[axis.key][side.pole === "first" ? 1 : 2],
            context ? scrub(context, l) : null,
            seen,
          ]
            .filter((x) => x !== null)
            .join(" · ")
        })}</h3>
        <p class="note">${loc.text((_m, _c, l) => `${PORTRAIT_MESSAGES[l].independent}: ${PORTRAIT_MESSAGES[l].coverage(side.sessions, p.coverage.sessionsAnalyzed)}`)}</p>
        ${evidenceList(side.evidence, loc, v, scrub, p)}
      </div>`,
      )}
    </div>`
    })}
  </section>`
}

export const portraitStyle = `
.portrait{margin:48px 0 64px}
.portrait-intro,.portrait-chapter{max-width:740px}
.portrait h2{font-size:clamp(var(--text-xl),4vw,var(--text-2xl));letter-spacing:-.03em}
.portrait-intro{font-size:var(--text-xl);line-height:1.85;margin-top:24px}
.portrait-chapter{margin-top:36px}
.portrait-chapter h3{font-size:var(--text-xl);margin-bottom:14px}
.portrait-chapter>p{font-size:var(--text-lg);line-height:1.95;white-space:pre-line}
.portrait-evidence{margin-top:14px;color:var(--muted)}
.portrait-evidence summary{cursor:pointer;font-size:var(--text-sm)}
.portrait-evidence blockquote{margin:14px 0;padding:4px 20px;border-left:2px solid var(--accent);line-height:1.8;overflow-wrap:anywhere}
.preference-evidence>h2{font-size:var(--text-xl);margin:36px 0 0}.preference-evidence>h2 small{font-size:var(--text-sm);color:var(--muted);font-weight:600}
.preference-evidence>.note{margin:12px 0 20px;max-width:var(--reading);color:var(--muted);font-size:var(--text-sm)}
.preference-evidence h3{font-size:var(--text-sm);margin-top:12px}
.portrait-axis{padding:16px 0;border-top:1px solid var(--border)}
.portrait-axis>span{float:right;font-size:var(--text-sm);color:var(--muted)}
.portrait-axis>p{clear:both;margin-top:8px;line-height:1.8}
@media(max-width:520px){.portrait-axis>span{float:none;display:block;margin-top:6px}}
`
