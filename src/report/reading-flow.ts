import { html, Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { READING_MESSAGES } from "./messages.ts"

type ChapterKey = keyof (typeof READING_MESSAGES)["en"]["chapters"]
interface Chapter {
  readonly key: ChapterKey
  readonly parts: ReadonlyArray<Raw | null | "">
}

/** A chapter and its navigation link exist only when at least one section has content. */
export const readingPath = (
  chapters: ReadonlyArray<Chapter>,
  loc: Loc,
  view: "overview" | "detail",
): Raw => {
  const shown = chapters
    .map((c) => ({
      ...c,
      parts: c.parts.filter((p): p is Raw => p instanceof Raw && p.value.trim().length > 0),
    }))
    .filter((c) => c.parts.length > 0)
  const title = (key: ChapterKey) =>
    loc.text((_m, _c, l) => READING_MESSAGES[l].chapters[key].title)
  return html`${shown.length > 1 ? html`<nav class="reading-nav" aria-label="${loc.attr((_m, _c, l) => READING_MESSAGES[l].navigation)}">${shown.map((c) => html`<a href="#reading-${view}-${c.key}">${title(c.key)}</a>`)}</nav>` : ""}
  ${shown.map(
    (c, i) => html`<section class="reading-chapter" id="reading-${view}-${c.key}">
    <header class="reading-heading"><p class="reading-title"><span aria-hidden="true">${String(i + 1).padStart(2, "0")} · </span>${title(c.key)}</p><p>${loc.text((_m, _c, l) => READING_MESSAGES[l].chapters[c.key].note)}</p></header>
    ${c.parts}
  </section>`,
  )}`
}

export const readingStyle = `
.reading-nav{display:flex;flex-wrap:wrap;gap:var(--space-2) var(--space-6);margin:var(--space-4) 0 var(--space-8);font-size:var(--text-sm)}
.reading-nav a{color:var(--muted);text-underline-offset:4px}.reading-nav a:hover{color:var(--accent)}.reading-nav a:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
.reading-chapter{margin:var(--space-8) 0;scroll-margin-top:var(--space-6)}
.reading-heading{border-top:1px solid var(--border);padding-top:var(--space-4);margin-bottom:var(--space-6)}
.reading-heading .reading-title{font-size:var(--text-base);font-weight:700;color:var(--fg)}
.reading-heading>p+p,.reading-limit{margin-top:var(--space-2);max-width:var(--reading);font-size:var(--text-sm);line-height:1.7;color:var(--muted)}
.reading-chapter .portrait{margin-top:0}
.portrait-sources>article{margin:var(--space-6) 0}.portrait-sources article>h3{font-size:var(--text-lg);line-height:1.4;margin-bottom:var(--space-2)}
.ability-evidence .radar-values{margin:var(--space-4) 0;gap:var(--space-6)}
@media print{.reading-nav{display:none}.reading-heading{break-after:avoid}.reading-chapter{margin:8mm 0}}
`
