import {
  roleCode,
  ROLE_NAMES,
  type DimensionKey,
  type Language,
  type Profile,
} from "../domain/index.ts"
import { ROLE_NAMES_ZH } from "./messages.ts"

/** The generated text in one language: English is the base, others come from `translations`. */
export interface Content {
  readonly headline: string
  readonly archetype: { readonly name: string; readonly description: string }
  readonly dimension: (key: DimensionKey) => { readonly title: string; readonly summary: string }
  readonly trait: (i: number) => { readonly name: string; readonly description: string }
  readonly funFacts: ReadonlyArray<string>
  readonly improvement: (i: number) => {
    readonly title: string
    readonly pattern: string
    readonly impact: string
    readonly experiment?: { readonly when: string; readonly observe: string } | null
    readonly suggestion: string
  }
}

export const contentIn = (p: Profile, lang: Language): Content => {
  const t = lang === "en" ? undefined : p.translations[lang]
  const code = p.portrait ? roleCode(p.portrait.axes) : null
  const archetype = t?.archetype ?? p.archetype
  return {
    headline: t?.headline ?? p.headline,
    archetype: code
      ? { ...archetype, name: (lang === "en" ? ROLE_NAMES : ROLE_NAMES_ZH)[code]! }
      : archetype,
    dimension: (key) => {
      const base = p.dimensions.find((d) => d.key === key)!
      return t?.dimensions.find((d) => d.key === key) ?? base
    },
    trait: (i) => t?.traits[i] ?? p.traits[i]!,
    funFacts: t?.funFacts ?? p.funFacts,
    improvement: (i) => t?.improvements[i] ?? p.improvements[i]!,
  }
}

/** The share card names recurring moves when available, otherwise supported legacy traits. */
export const signatureNames = (p: Profile, lang: Language): ReadonlyArray<string> => {
  if (p.collaboration?.moves.length)
    return p.collaboration.moves
      .slice(0, 2)
      .map((m, i) => p.translations[lang]?.collaboration?.moves[i]?.name ?? m.name)
  const content = contentIn(p, lang)
  return p.traits
    .flatMap((t, i) =>
      t.confidence !== "low" && t.evidence.length > 0 ? [content.trait(i).name] : [],
    )
    .slice(0, 2)
}
