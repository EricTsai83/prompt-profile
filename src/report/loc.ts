import type { Language, Profile } from "../domain/Profile.ts"
import { contentIn, type Content } from "./content.ts"
import { escapeHtml, html, raw, type Raw } from "./html-template.ts"
import { MESSAGES, type Messages } from "./messages.ts"

/** `lang` attribute per report language (zh-TW content is Traditional Chinese). */
export const LANG_TAGS: Record<Language, string> = { en: "en", "zh-TW": "zh-Hant-TW" }

/**
 * Text in every report language. With several languages each version is a `[data-l]` span
 * and CSS shows the selected one (no JavaScript); with one language it is plain text.
 */
export interface Loc {
  readonly langs: ReadonlyArray<Language>
  readonly text: (pick: (m: Messages, c: Content, lang: Language) => string) => Raw
  /** An SVG `<text>` per language (spans cannot be toggled inside SVG text). */
  readonly svgText: (
    attrs: string,
    pick: (m: Messages, c: Content, lang: Language) => string,
  ) => Raw
  /** Default-language string for attributes (aria-label, title). */
  readonly attr: (pick: (m: Messages, c: Content, lang: Language) => string) => string
  /** `data-tip-<lang>` attributes for a CSS tooltip in every language. */
  readonly tip: (pick: (m: Messages, c: Content, lang: Language) => string) => Raw
}

export const makeLoc = (p: Profile): Loc => {
  const langs = p.languages
  const contents = new Map(langs.map((l) => [l, contentIn(p, l)]))
  const one = langs.length === 1
  const value = (l: Language, pick: (m: Messages, c: Content, lang: Language) => string) =>
    pick(MESSAGES[l], contents.get(l)!, l)
  return {
    langs,
    text: (pick) =>
      one
        ? html`${value(langs[0]!, pick)}`
        : html`${langs.map(
            (l) => html`<span data-l="${l}" lang="${LANG_TAGS[l]}">${value(l, pick)}</span>`,
          )}`,
    svgText: (attrs, pick) =>
      html`${langs.map(
        (l) =>
          html`<text ${raw(attrs)} ${one ? "" : raw(`data-l="${l}"`)}>${value(l, pick)}</text>`,
      )}`,
    attr: (pick) => value(langs[0]!, pick),
    tip: (pick) => raw(langs.map((l) => `data-tip-${l}="${escapeHtml(value(l, pick))}"`).join(" ")),
  }
}
