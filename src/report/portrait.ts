import { roleCode } from "../domain/Interaction.ts"
import type { Profile } from "../domain/Profile.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { PORTRAIT_MESSAGES } from "./messages.ts"
import type { Scrub, Visibility } from "./visibility.ts"

export const portraitSection = (p: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw | null => {
  const portrait = p.portrait
  if (!portrait || portrait.chapters.length === 0) return null
  const text = (pick: (t: NonNullable<typeof p.portrait>) => string, index?: number) =>
    loc.text((_m, _c, l) => {
      const translated = p.translations[l]?.portrait
      if (!translated) return scrub(pick(portrait), l)
      const chapter = index === undefined ? undefined : translated.chapters[index]
      return scrub(
        index === undefined ? translated.introduction : (chapter?.body ?? pick(portrait)),
        l,
      )
    })
  const evidence = (items: (typeof portrait.chapters)[number]["evidence"]): Raw =>
    !v.quotes || items.length === 0
      ? html``
      : html`<details open class="portrait-evidence">
      <summary>${loc.text((m) => m.showEvidence(items.length))}</summary>
      ${items.map((e) => html`<blockquote>${loc.text((_m, _c, l) => scrub(e.quote, l))}</blockquote>`)}
    </details>`
  const code = roleCode(portrait.axes)
  return html`<section class="portrait">
    <h2>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].title)}</h2>
    <p class="portrait-intro">${text((t) => t.introduction)}</p>
    ${portrait.chapters.map(
      (chapter, i) => html`<article class="portrait-chapter">
      <h3>${loc.text((_m, _c, l) => scrub(p.translations[l]?.portrait?.chapters[i]?.title ?? chapter.title, l))}</h3>
      <p>${text(() => chapter.body, i)}</p>
      ${evidence(chapter.evidence)}
    </article>`,
    )}
    <aside class="portrait-preferences">
      <h3>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].preferences)} ${code ? html`<small>${code}</small>` : ""}</h3>
      <p class="note">${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].note)}</p>
      ${portrait.axes.map(
        (axis) => html`<div class="portrait-axis">
        <b>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].axes[axis.key][0])}</b>
        <span>${loc.text((_m, _c, l) => (axis.pole === "unclear" ? PORTRAIT_MESSAGES[l].unclear : PORTRAIT_MESSAGES[l].axes[axis.key][axis.pole === "first" ? 1 : 2]))}</span>
        ${axis.evidence.length > 0 ? html`<p>${loc.text((_m, _c, l) => scrub(p.translations[l]?.portrait?.axes.find((a) => a.key === axis.key)?.explanation ?? axis.explanation, l))}</p>` : ""}
        ${axis.evidence.length > 0 && v.quotes ? html`<div class="supporting-evidence"><h4>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].evidenceFor)}</h4>${evidence(axis.evidence)}</div>` : ""}
        ${axis.counterEvidence.length > 0 && v.quotes ? html`<div class="counter-evidence"><h4>${loc.text((_m, _c, l) => PORTRAIT_MESSAGES[l].evidenceAgainst)}</h4>${evidence(axis.counterEvidence)}</div>` : ""}
      </div>`,
      )}
    </aside>
  </section>`
}

export const portraitStyle = `
.portrait{max-width:740px;margin:48px auto 64px}
.portrait h2{font-size:clamp(24px,4vw,36px);letter-spacing:-.03em}
.portrait-intro{font-size:20px;line-height:1.85;margin-top:24px}
.portrait-chapter{margin-top:36px}
.portrait-chapter h3{font-size:21px;margin-bottom:14px}
.portrait-chapter>p{font-size:17px;line-height:1.95;white-space:pre-line}
.portrait-evidence{margin-top:14px;color:var(--muted)}
.portrait-evidence summary{cursor:pointer;font-size:13px}
.portrait-evidence blockquote{margin:14px 0;padding:4px 20px;border-left:2px solid var(--accent);line-height:1.8;overflow-wrap:anywhere}
.portrait-preferences{margin-top:40px;padding-top:28px;border-top:1px solid var(--border)}
.portrait-preferences .note{margin:12px 0 20px}
.portrait-axis{padding:16px 0;border-top:1px solid var(--border)}
.portrait-axis>span{float:right;font-size:13px;color:var(--muted)}
.portrait-axis>p{clear:both;margin-top:8px;line-height:1.8}
@media(max-width:520px){.portrait-axis>span{float:none;display:block;margin-top:6px}}
`
