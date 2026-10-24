import type { DimensionKey, Language, Profile } from "../domain/Profile.ts"

/** The generated text in one language: English is the base, others come from `translations`. */
export interface Content {
  readonly headline: string
  readonly archetype: { readonly name: string; readonly description: string }
  readonly dimension: (key: DimensionKey) => { readonly title: string; readonly summary: string }
  readonly trait: (i: number) => { readonly name: string; readonly description: string }
  readonly funFacts: ReadonlyArray<string>
}

export const contentIn = (p: Profile, lang: Language): Content => {
  const t = lang === "en" ? undefined : p.translations[lang]
  return {
    headline: t?.headline ?? p.headline,
    archetype: t?.archetype ?? p.archetype,
    dimension: (key) => {
      const base = p.dimensions.find((d) => d.key === key)!
      return t?.dimensions.find((d) => d.key === key) ?? base
    },
    trait: (i) => t?.traits[i] ?? p.traits[i]!,
    funFacts: t?.funFacts ?? p.funFacts,
  }
}
