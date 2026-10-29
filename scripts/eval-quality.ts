import { verifyEvidence } from "../src/analysis/verify.ts"
import type { Evidence } from "../src/domain/Profile.ts"
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
  /** At least this many verified improvements (plan 16); unset = not checked. */
  readonly minImprovements?: number
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
    ...profile.improvements.flatMap((i) => [i.title, i.pattern, i.impact, i.suggestion]),
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
  if (profile.improvements.length < (rubric.minImprovements ?? 0))
    failures.push("Too few improvements")
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

/** Mechanical evidence checks only; semantic judgments require a separate human review.
 * Available source counts describe the supplied evaluation slice, never full history.
 */
export const inspectClaimSupport = (
  evidence: ReadonlyArray<Evidence>,
  prompts: ReadonlyArray<{ readonly id: string; readonly session: string; readonly text: string }>,
) => {
  const source = new Map(prompts.map((prompt) => [prompt.id, prompt]))
  const counts = { kept: 0, dropped: 0 }
  const verified = verifyEvidence(
    evidence,
    new Map(prompts.map((prompt) => [prompt.id, prompt.text])),
    counts,
  )
  return {
    quoteValidity: counts,
    selectedEvidence: {
      prompts: new Set(verified.map((item) => item.promptId)).size,
      sessions: new Set(verified.map((item) => source.get(item.promptId)!.session)).size,
    },
    availableSource: {
      prompts: source.size,
      sessions: new Set([...source.values()].map((prompt) => prompt.session)).size,
    },
    manualReview: {
      semanticSupport: "unreviewed",
      specificity: "unreviewed",
      contradictions: "unreviewed",
      uncertainty: "unreviewed",
    },
  }
}
