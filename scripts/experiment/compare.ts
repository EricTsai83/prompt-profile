/**
 * Structured differences between profiles of the same input (plan 22 §4–5). Wording changes,
 * structured decisions and missing content are kept apart; nothing here ranks a winner, and
 * longer prose or more claims is never treated as better.
 */
import { roleCode } from "../../src/domain/Interaction.ts"
import type { Language, Profile } from "../../src/domain/Profile.ts"
import type { CaseResult } from "./execute.ts"

/** The decisions a profile makes, independent of wording. */
export interface Structure {
  readonly role: string | null
  readonly axes: Readonly<Record<string, string>>
  readonly traits: ReadonlyArray<string>
  readonly traitCount: number
  readonly improvementCount: number
  readonly dimensionsWithoutEvidence: number
  readonly quotes: number
  readonly hasPortrait: boolean
}

export const structureOf = (p: Profile): Structure => {
  const portrait = p.portrait ?? null
  const quotes =
    p.traits.reduce((n, t) => n + t.evidence.length, 0) +
    p.dimensions.reduce((n, d) => n + d.evidence.length, 0) +
    p.improvements.reduce((n, i) => n + i.evidence.length, 0) +
    (portrait?.chapters.reduce((n, c) => n + c.evidence.length, 0) ?? 0) +
    (portrait?.axes.reduce((n, a) => n + a.evidence.length + a.counterEvidence.length, 0) ?? 0)
  return {
    role: portrait ? roleCode(portrait.axes) : null,
    axes: Object.fromEntries((portrait?.axes ?? []).map((a) => [a.key, a.pole])),
    traits: p.traits.map((t) => t.name),
    traitCount: p.traits.length,
    improvementCount: p.improvements.length,
    dimensionsWithoutEvidence: p.dimensions.filter((d) => d.evidence.length === 0).length,
    quotes,
    hasPortrait: portrait !== null,
  }
}

/** Generated text in one language: English fields, or the stored translation. */
export const textIn = (p: Profile, lang: Language) => {
  const t = lang === "en" ? null : (p.translations[lang] ?? null)
  const portrait = t ? (t.portrait ?? null) : (p.portrait ?? null)
  return {
    available: lang === "en" || t !== null,
    headline: t?.headline ?? p.headline,
    archetype: t?.archetype.name ?? p.archetype.name,
    introduction: portrait?.introduction ?? null,
    traits: (t?.traits ?? p.traits).map((x) => x.name),
    improvements: (t?.improvements ?? p.improvements).map((x) => x.title),
  }
}

export interface Change {
  readonly field: string
  readonly baseline: string
  readonly candidate: string
}

export interface ProfileDiff {
  /** Same decision, different words. */
  readonly wording: ReadonlyArray<Change>
  /** Different structured decisions (role, axis poles, traits kept, counts). */
  readonly decisions: ReadonlyArray<Change>
  /** Content one side has and the other lacks. */
  readonly missing: ReadonlyArray<Change>
}

const list = (xs: ReadonlyArray<string>) => (xs.length === 0 ? "(none)" : xs.join("; "))
const or = (x: string | null) => x ?? "(none)"

export const diffProfiles = (base: Profile, cand: Profile, lang: Language): ProfileDiff => {
  const wording: Array<Change> = []
  const decisions: Array<Change> = []
  const missing: Array<Change> = []
  const a = structureOf(base)
  const b = structureOf(cand)
  const ta = textIn(base, lang)
  const tb = textIn(cand, lang)

  if (ta.available !== tb.available)
    missing.push({
      field: `${lang} text`,
      baseline: ta.available ? "present" : "missing",
      candidate: tb.available ? "present" : "missing",
    })
  if (a.hasPortrait !== b.hasPortrait)
    missing.push({
      field: "portrait",
      baseline: a.hasPortrait ? "present" : "missing",
      candidate: b.hasPortrait ? "present" : "missing",
    })
  for (const [field, x, y] of [
    ["improvements", a.improvementCount, b.improvementCount],
    ["traits", a.traitCount, b.traitCount],
  ] as const)
    if ((x === 0) !== (y === 0)) missing.push({ field, baseline: String(x), candidate: String(y) })

  for (const [field, x, y] of [
    ["headline", ta.headline, tb.headline],
    ["archetype", ta.archetype, tb.archetype],
    ["introduction", or(ta.introduction), or(tb.introduction)],
  ] as const)
    if (x !== y) wording.push({ field, baseline: x, candidate: y })

  if (a.role !== b.role)
    decisions.push({ field: "role", baseline: or(a.role), candidate: or(b.role) })
  for (const key of new Set([...Object.keys(a.axes), ...Object.keys(b.axes)]))
    if (a.axes[key] !== b.axes[key])
      decisions.push({
        field: `axis ${key}`,
        baseline: or(a.axes[key] ?? null),
        candidate: or(b.axes[key] ?? null),
      })
  for (const [field, x, y] of [
    ["trait count", a.traitCount, b.traitCount],
    ["improvement count", a.improvementCount, b.improvementCount],
    ["dimensions without evidence", a.dimensionsWithoutEvidence, b.dimensionsWithoutEvidence],
    ["verified quotes", a.quotes, b.quotes],
  ] as const)
    if (x !== y) decisions.push({ field, baseline: String(x), candidate: String(y) })
  // Trait names are generated wording; their set is compared in the chosen language.
  if (list(ta.traits) !== list(tb.traits))
    wording.push({ field: "trait names", baseline: list(ta.traits), candidate: list(tb.traits) })
  if (list(ta.improvements) !== list(tb.improvements))
    wording.push({
      field: "improvement titles",
      baseline: list(ta.improvements),
      candidate: list(tb.improvements),
    })
  return { wording, decisions, missing }
}

export interface Range {
  readonly min: number
  readonly max: number
  readonly n: number
}

export const rangeOf = (xs: ReadonlyArray<number | null>): Range | null => {
  const known = xs.filter((x): x is number => x !== null)
  return known.length === 0
    ? null
    : { min: Math.min(...known), max: Math.max(...known), n: known.length }
}

export interface VariantSummary {
  readonly variant: string
  readonly persona: string
  readonly cases: number
  readonly ok: number
  readonly durationMs: Range | null
  readonly attempts: Range | null
  readonly failedAttempts: Range | null
  readonly inputTokens: Range | null
  readonly outputTokens: Range | null
  readonly rubricPassed: number
  /** Within-variant agreement: how often each structured decision occurred across repeats. */
  readonly agreement: Readonly<Record<string, Readonly<Record<string, number>>>>
}

/** Repeat ranges and agreement for one persona/variant; `profiles` are its ok cases' profiles. */
export const summarizeVariant = (
  cases: ReadonlyArray<CaseResult>,
  profiles: ReadonlyArray<Profile>,
): VariantSummary => {
  const ok = cases.filter((c) => c.status === "ok")
  const agreement: Record<string, Record<string, number>> = {}
  const count = (field: string, value: string) => {
    agreement[field] ??= {}
    agreement[field][value] = (agreement[field][value] ?? 0) + 1
  }
  for (const p of profiles) {
    const s = structureOf(p)
    count("role", or(s.role))
    for (const [k, v] of Object.entries(s.axes)) count(`axis ${k}`, v)
    count("trait count", String(s.traitCount))
    count("improvement count", String(s.improvementCount))
  }
  return {
    variant: cases[0]?.variant ?? "",
    persona: cases[0]?.persona ?? "",
    cases: cases.length,
    ok: ok.length,
    durationMs: rangeOf(ok.map((c) => c.durationMs)),
    attempts: rangeOf(ok.map((c) => c.calls.attempts)),
    failedAttempts: rangeOf(ok.map((c) => c.calls.failedAttempts)),
    inputTokens: rangeOf(ok.map((c) => c.usage.inputTokens)),
    outputTokens: rangeOf(ok.map((c) => c.usage.outputTokens)),
    rubricPassed: ok.filter((c) => c.quality?.passed === true).length,
    agreement,
  }
}
