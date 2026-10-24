import type { Profile } from "../src/domain/Profile.ts"

/** Deterministic regression checks, not a substitute for reading the persona's expected.md. */
export interface QualityRubric {
  readonly requiredConcepts: ReadonlyArray<{
    readonly name: string
    readonly patterns: ReadonlyArray<string>
  }>
  readonly forbiddenPatterns: ReadonlyArray<string>
  readonly minTraits: number
  readonly minEvidenceRetention: number
  readonly maxEmptyDimensions: number
  /** Fails above this many universal claims; unset = counted only (see plan 13). */
  readonly maxOvergeneralisations?: number
}

/** Universal quantifiers that a handful of prompts rarely supports ("every change", "never"). */
const UNIVERSAL = /\b(?:every|always|never|all of your|none of your|each of your)\b/gi

export const scoreProfile = (profile: Profile, rubric: QualityRubric) => {
  // Inspect generated claims, not copied quotes or statistics.
  const claims = [
    profile.headline,
    profile.archetype.name,
    profile.archetype.description,
    ...profile.traits.flatMap((t) => [t.name, t.description]),
    ...profile.dimensions.flatMap((d) => [d.title, d.summary]),
    ...profile.funFacts,
  ].join("\n")
  const failures: Array<string> = []
  for (const concept of rubric.requiredConcepts) {
    if (!concept.patterns.some((p) => new RegExp(p, "im").test(claims))) {
      failures.push(`Missing concept: ${concept.name}`)
    }
  }
  for (const pattern of rubric.forbiddenPatterns) {
    if (new RegExp(pattern, "im").test(claims)) failures.push(`Forbidden inference: ${pattern}`)
  }
  const { evidenceKept, evidenceDropped } = profile.coverage
  const evidenceRetention = evidenceKept / Math.max(1, evidenceKept + evidenceDropped)
  const emptyDimensions = profile.dimensions.filter((d) => d.evidence.length === 0).length
  if (profile.traits.length < rubric.minTraits) failures.push("Too few traits")
  if (evidenceRetention < rubric.minEvidenceRetention)
    failures.push("Evidence retention below threshold")
  if (emptyDimensions > rubric.maxEmptyDimensions)
    failures.push("Too many dimensions without evidence")
  const overgeneralisations = claims.match(UNIVERSAL)?.length ?? 0
  const maxUniversal = rubric.maxOvergeneralisations
  if (maxUniversal !== undefined && overgeneralisations > maxUniversal)
    failures.push(`Too many universal claims (${overgeneralisations} > ${maxUniversal})`)
  return {
    passed: failures.length === 0,
    failures,
    evidenceRetention,
    emptyDimensions,
    overgeneralisations,
  }
}
