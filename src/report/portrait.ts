import { roleCode } from "../domain/Interaction.ts"
import type { Profile } from "../domain/Profile.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { PORTRAIT_MESSAGES, VIEW_MESSAGES } from "./messages.ts"
import type { Scrub, Visibility } from "./visibility.ts"

type Portrait = NonNullable<Profile["portrait"]>

/** Expanded quotes; nothing when quotes are excluded. */
const evidenceList = (
  items: Portrait["chapters"][number]["evidence"],
  loc: Loc,
  v: Visibility,
  scrub: Scrub,
): Raw =>
  !v.quotes || items.length === 0
    ? html``
    : html`<details open class="portrait-evidence">
      <summary>${loc.text((m) => m.showEvidence(items.length))}</summary>
      ${items.map((e) => html`<blockquote>${loc.text((_m, _c, l) => scrub(e.quote, l))}</blockquote>`)}
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
      ${evidenceList(chapter.evidence, loc, v, scrub)}
    </article>`,
    )}
  </section>`
}

/** The factual view's record of each preference: its explanation, supporting and contrary quotes. */
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
    <h2>${loc.text((_m, _c, l) => VIEW_MESSAGES[l].preferenceEvidence)} ${code ? html`<small>${code}</small>` : ""}</h2>
    <p class="note">${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].note)}</p>
    ${portrait.axes.map(
      (axis) => html`<div class="portrait-axis">
      <b>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[axis.key][0])}</b>
      <span>${loc.text((_m, _c, l) => (axis.pole === "unclear" ? PORTRAIT_MESSAGES[l].unclear : PORTRAIT_MESSAGES[l].axes[axis.key][axis.pole === "first" ? 1 : 2]))}</span>
      ${axis.evidence.length > 0 ? html`<p>${loc.text((_m, _c, l) => scrub(p.translations[l]?.portrait?.axes.find((a) => a.key === axis.key)?.explanation ?? axis.explanation, l))}</p>` : ""}
      ${axis.evidence.length > 0 && v.quotes ? html`<div class="supporting-evidence"><h3>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].evidenceFor)}</h3>${evidenceList(axis.evidence, loc, v, scrub)}</div>` : ""}
      ${axis.counterEvidence.length > 0 && v.quotes ? html`<div class="counter-evidence"><h3>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].evidenceAgainst)}</h3>${evidenceList(axis.counterEvidence, loc, v, scrub)}</div>` : ""}
    </div>`,
    )}
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
