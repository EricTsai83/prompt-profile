import { RUN_ID, type LibraryIndex } from "../domain/Library.ts"
import { ROLE_NAMES } from "../domain/Interaction.ts"
import { html } from "./html-template.ts"
import { LIBRARY_MESSAGES, MESSAGES, ROLE_NAMES_ZH } from "./messages.ts"

/** Offline bilingual index; IDs, not supplied file paths, determine every report link. */
export const renderLibrary = (index: LibraryIndex): string => {
  const runs = index.runs.filter((r) => RUN_ID.test(r.id))
  const lang = (pick: (l: "en" | "zh-TW") => string) =>
    html`<span data-l="en" lang="en">${pick("en")}</span><span data-l="zh-TW" lang="zh-Hant-TW">${pick("zh-TW")}</span>`
  const firstZh = runs[0]?.languages[0] === "zh-TW"
  return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>prompt-profile · ${LIBRARY_MESSAGES[firstZh ? "zh-TW" : "en"].title}</title>
    <style>:root{color-scheme:light dark;font-family:system-ui,sans-serif;background:#f7f7f4;color:#202024}body{max-width:900px;margin:auto;padding:24px}nav{display:flex;gap:16px}main{margin-top:40px}h1{font-size:clamp(28px,6vw,46px)}h2{margin:24px 0 12px}article{border-top:1px solid #8886;padding:24px 0;overflow-wrap:anywhere}p{line-height:1.8}a{color:inherit;text-underline-offset:4px}a:focus-visible,label:focus-visible,#library-en:focus-visible~nav label[for=library-en],#library-zh:focus-visible~nav label[for=library-zh]{outline:3px solid #6b62de;outline-offset:4px}label{cursor:pointer}dl{display:grid;grid-template-columns:140px 1fr;gap:8px}dd{margin:0}.note{font-size:14px;opacity:.75}.lang-radio{position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden}#library-en:checked~main [data-l=zh-TW],#library-zh:checked~main [data-l=en]{display:none}#library-en:checked~nav label[for=library-en],#library-zh:checked~nav label[for=library-zh]{font-weight:700;text-decoration:underline}@media(prefers-color-scheme:dark){:root{background:#141416;color:#eeeef0}}@media(max-width:480px){dl{grid-template-columns:1fr}dd{margin-bottom:8px}}@media print{nav{display:none}article{break-inside:avoid}}</style></head><body>
    <input class="lang-radio" type="radio" name="library-language" id="library-en" ${firstZh ? "" : "checked"}><input class="lang-radio" type="radio" name="library-language" id="library-zh" ${firstZh ? "checked" : ""}>
    <nav aria-label="Language"><label for="library-en">${MESSAGES.en.languageName}</label><label for="library-zh">${MESSAGES["zh-TW"].languageName}</label></nav>
    <main><h1>${lang((l) => LIBRARY_MESSAGES[l].title)}</h1><p class="note">${lang((l) => LIBRARY_MESSAGES[l].note)}</p>
    ${runs.length === 0 ? html`<p>${lang((l) => LIBRARY_MESSAGES[l].empty)}</p>` : html`<h2>${lang((l) => LIBRARY_MESSAGES[l].latest)}</h2><p><a href="reports/${runs[0]!.id}/report.html">${lang((l) => LIBRARY_MESSAGES[l].open)}</a></p><h2>${lang((l) => LIBRARY_MESSAGES[l].history)}</h2>`}
    ${runs.map((r) => {
      const date = (value: string | null) =>
        value ? value.slice(0, r.excluded.includes("dates") ? 7 : 10) : "—"
      return html`<article><h3><a href="reports/${r.id}/report.html">${date(r.createdAt)} · ${lang((l) => (r.role ? ((l === "en" ? ROLE_NAMES : ROLE_NAMES_ZH)[r.role] ?? r.role) : LIBRARY_MESSAGES[l].noRole))}</a></h3>
        <dl><dt>${lang((l) => LIBRARY_MESSAGES[l].window)}</dt><dd>${date(r.window.from)} → ${date(r.window.to)}</dd><dt>${lang((l) => LIBRARY_MESSAGES[l].engine)}</dt><dd>${r.engine.runner}${r.engine.model ? ` · ${r.engine.model}` : ""}</dd><dt>${lang((l) => LIBRARY_MESSAGES[l].languages)}</dt><dd>${r.languages.join(", ")}</dd></dl>
        <p>${lang((l) => (r.sampling.sampled ? LIBRARY_MESSAGES[l].sampled : LIBRARY_MESSAGES[l].complete))} · ${lang((l) => LIBRARY_MESSAGES[l].coverage(r.sampling.prompts, r.sampling.sessions))}</p>
        <p><a href="reports/${r.id}/profile.json">${lang((l) => LIBRARY_MESSAGES[l].profile)}</a>${r.cards.some((c) => c.file === null) ? html` · ${lang((l) => LIBRARY_MESSAGES[l].cardMissing)}` : ""}</p>
      </article>`
    })}
    ${index.skipped ? html`<p class="note">${lang((l) => LIBRARY_MESSAGES[l].skipped(index.skipped))}</p>` : ""}
    </main></body></html>`.value
}
