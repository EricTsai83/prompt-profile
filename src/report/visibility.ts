import type { Language, Profile } from "../domain/index.ts"
import { excludedParts, type RenderOptions, type ReportPart } from "./looks.ts"
import { MESSAGES } from "./messages.ts"
import { limitedView } from "./evidence.ts"

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
  /** Plans, token counts and API list-price equivalents (plan 23). */
  readonly usage: boolean
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
    usage: !out.has("usage"),
  }
}

/** Replaces project names in generated text (the model may mention them). */
export type Scrub = (text: string, lang: Language) => string

/** Identity when project names are shown; "Project A"… otherwise, including short names. */
export const makeScrub = (p: Profile, v: Visibility): Scrub => {
  if (v.projects) return (text) => text
  const names = [
    ...new Set([
      ...p.stats.activity.projects,
      ...p.stats.topProjects.map((x) => x.name),
      ...(p.historyComparison?.previousProjects ?? []),
    ]),
  ].toSorted((a, b) => b.length - a.length)
  return (text, lang) =>
    names.reduce((out, name, i) => {
      const index = p.stats.activity.projects.indexOf(name)
      const label = `${MESSAGES[lang].projectAnon} ${"ABCDEFGHIJ"[index === -1 ? i : index] ?? "?"}`
      return name.length === 0
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
    ...(p.collaboration
      ? {
          collaboration: {
            ...p.collaboration,
            moves: p.collaboration.moves.map((m) => ({
              ...m,
              name: s(m.name),
              description: s(m.description),
            })),
          },
        }
      : {}),
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
              ...(t.collaboration
                ? {
                    collaboration: {
                      ...t.collaboration,
                      moves: t.collaboration.moves.map((m) => ({
                        ...m,
                        name: s(m.name),
                        description: s(m.description),
                      })),
                    },
                  }
                : {}),
              traits: t.traits.map((x) => ({ name: s(x.name), description: s(x.description) })),
            },
          },
  }
}

/** What a rendered report shows, for the CLI's "Contains" line. */
export interface ReportContents {
  readonly quotes: number
  /** Distinct real project names (0 when shown as "Project A"…). */
  readonly projects: number
  readonly exactDates: boolean
  readonly improvements: number
  readonly funFacts: number
  /** Plans, tokens and API list-price equivalents are shown. */
  readonly usage: boolean
}

export const reportContents = (profile: Profile, options: RenderOptions): ReportContents => {
  const v = visibilityOf(options)
  // A limited profile renders without suggestions (plan 24).
  const p = limitedView(profile)
  const evidence = (xs: ReadonlyArray<{ readonly evidence: ReadonlyArray<unknown> }>) =>
    xs.reduce((sum, x) => sum + x.evidence.length, 0)
  const names = new Set([
    ...p.stats.activity.projects,
    ...p.stats.topProjects.map((x) => x.name),
    ...(p.historyComparison?.previousProjects ?? []),
  ])
  return {
    quotes: v.quotes
      ? evidence(p.traits) +
        (p.historyComparison?.changes.reduce(
          (n, c) => n + c.previousEvidence.length + c.evidence.length,
          0,
        ) ?? 0) +
        evidence(p.collaboration?.signals ?? []) +
        evidence(p.dimensions) +
        (v.coaching ? evidence(p.improvements) : 0) +
        (p.portrait
          ? evidence(p.portrait.chapters) +
            p.portrait.axes.reduce(
              (n, a) => n + a.sides.reduce((m, s) => m + s.evidence.length, 0),
              0,
            )
          : 0) +
        p.episodes.reduce((n, e) => n + e.turns.length, 0) +
        (p.steering ? p.steering.steer.examples.length + p.steering.repair.examples.length : 0)
      : 0,
    projects: v.projects ? names.size : 0,
    exactDates: v.dates,
    improvements: v.coaching ? p.improvements.length : 0,
    funFacts: v.funFacts ? p.funFacts.length : 0,
    usage: v.usage && p.usage !== null,
  }
}
