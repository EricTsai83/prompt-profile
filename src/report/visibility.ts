import type { Language, Profile } from "../domain/Profile.ts"
import { excludedParts, type RenderOptions, type ReportPart } from "./looks.ts"
import { MESSAGES } from "./messages.ts"

/**
 * What the report shows, from `--exclude` (plan 18). Everything by default: the report stays
 * on the user's machine, and they choose what to leave out before sharing it.
 */
export interface Visibility {
  readonly quotes: boolean
  /** Real project names; otherwise "Project A", "Project B"… */
  readonly projects: boolean
  /** Exact dates; otherwise months only and no calendar. */
  readonly dates: boolean
  readonly coaching: boolean
  readonly funFacts: boolean
  /** Names and descriptions of personal / project skills, custom agents and other servers. */
  readonly customNames: boolean
}

export const visibilityOf = (options: RenderOptions): Visibility => {
  const out = new Set<ReportPart>(excludedParts(options))
  return {
    quotes: !out.has("quotes"),
    projects: !out.has("projects"),
    dates: !out.has("dates"),
    coaching: !out.has("coaching"),
    funFacts: !out.has("funfacts"),
    customNames: !out.has("custom-names"),
  }
}

/** Replaces project names in generated text (the model may mention them). */
export type Scrub = (text: string, lang: Language) => string

/** Identity when project names are shown; "Project A"… otherwise, as in the charts. */
export const makeScrub = (p: Profile, v: Visibility): Scrub => {
  if (v.projects) return (text) => text
  const names = [
    ...new Set([...p.stats.activity.projects, ...p.stats.topProjects.map((x) => x.name)]),
  ].toSorted((a, b) => b.length - a.length)
  return (text, lang) =>
    names.reduce((out, name, i) => {
      const index = p.stats.activity.projects.indexOf(name)
      const label = `${MESSAGES[lang].projectAnon} ${"ABCDEFGHIJ"[index === -1 ? i : index] ?? "?"}`
      return name.length < 3
        ? out
        : out.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), label)
    }, text)
}

/** The card's text (identity and traits) with project names scrubbed for one language. */
export const scrubIdentity = (p: Profile, scrub: Scrub, lang: Language): Profile => {
  const s = (text: string) => scrub(text, lang)
  const t = p.translations[lang]
  return {
    ...p,
    headline: s(p.headline),
    archetype: {
      ...p.archetype,
      name: s(p.archetype.name),
      description: s(p.archetype.description),
    },
    traits: p.traits.map((x) => ({ ...x, name: s(x.name), description: s(x.description) })),
    translations:
      t === undefined
        ? p.translations
        : {
            ...p.translations,
            [lang]: {
              ...t,
              headline: s(t.headline),
              archetype: { name: s(t.archetype.name), description: s(t.archetype.description) },
              traits: t.traits.map((x) => ({ name: s(x.name), description: s(x.description) })),
            },
          },
  }
}
