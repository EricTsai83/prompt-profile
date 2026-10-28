import { AXIS_KEYS } from "../Interaction.ts"
import { Schema } from "effect"
import type { ChunkObservations } from "../ChunkObservations.ts"
import {
  CONFIDENCES,
  DIMENSION_KEYS,
  MAX_QUOTE_LENGTH,
  OBSERVATION_KEYS,
  type Coverage,
  type Engine,
  type Evidence,
  PROFILE_SCHEMA_VERSION,
  type Profile,
} from "../Profile.ts"
import type { Stats } from "../Stats.ts"
import type { DateTime } from "effect"

/*
 * LLM-facing schemas. These only use the JSON Schema subset both `claude --json-schema`
 * and Codex structured outputs (strict mode) accept: see `toLlmJsonSchema.ts`.
 * Length / count limits live in the prompts and are enforced when converting to the
 * internal formats below.
 */

const LlmEvidence = Schema.Struct({
  promptId: Schema.String,
  quote: Schema.String,
})

export const LlmChunkObservations = Schema.Struct({
  observations: Schema.Array(
    Schema.Struct({
      dimension: Schema.Literals(OBSERVATION_KEYS),
      claim: Schema.String,
      evidence: Schema.Array(LlmEvidence),
    }),
  ),
})
export type LlmChunkObservations = typeof LlmChunkObservations.Type

const LlmPortrait = Schema.Struct({
  introduction: Schema.String,
  chapters: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      body: Schema.String,
      evidence: Schema.Array(LlmEvidence),
    }),
  ),
  axes: Schema.Array(
    Schema.Struct({
      key: Schema.Literals(AXIS_KEYS),
      pole: Schema.Literals(["first", "second", "unclear"]),
      explanation: Schema.String,
      evidence: Schema.Array(LlmEvidence),
      counterEvidence: Schema.Array(LlmEvidence),
    }),
  ),
})

export const LlmProfileDraft = Schema.Struct({
  portrait: Schema.NullOr(LlmPortrait),
  headline: Schema.String,
  archetype: Schema.Struct({ name: Schema.String, description: Schema.String }),
  dimensions: Schema.Array(
    Schema.Struct({
      key: Schema.Literals(DIMENSION_KEYS),
      title: Schema.String,
      summary: Schema.String,
      evidence: Schema.Array(LlmEvidence),
    }),
  ),
  traits: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.String,
      confidence: Schema.Literals(CONFIDENCES),
      evidence: Schema.Array(LlmEvidence),
    }),
  ),
  funFacts: Schema.Array(Schema.String),
  improvements: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      pattern: Schema.String,
      impact: Schema.String,
      suggestion: Schema.String,
      evidence: Schema.Array(LlmEvidence),
      /** `promptId` of one evidence prompt and the suggested prompt; empty strings for none. */
      rewrite: Schema.Struct({ promptId: Schema.String, after: Schema.String }),
    }),
  ),
})
export type LlmProfileDraft = typeof LlmProfileDraft.Type

/** Truncate to at most `MAX_QUOTE_LENGTH` characters (code points, not UTF-16 units). */
export const truncateQuote = (quote: string): string => {
  const chars = Array.from(quote.trim())
  return chars.length <= MAX_QUOTE_LENGTH
    ? chars.join("")
    : chars.slice(0, MAX_QUOTE_LENGTH - 1).join("") + "…"
}

const toEvidence = (e: { readonly promptId: string; readonly quote: string }): Evidence => ({
  promptId: e.promptId,
  quote: truncateQuote(e.quote),
})

export const fromLlmChunkObservations = (
  llm: LlmChunkObservations,
  chunkId: string,
): ChunkObservations => ({
  chunkId,
  observations: llm.observations.map((o) => ({
    dimension: o.dimension,
    claim: o.claim,
    evidence: o.evidence.map(toEvidence),
  })),
})

export interface ProfileExtras {
  readonly generatedAt: DateTime.Utc
  readonly engine: Engine
  readonly coverage: Coverage
  readonly stats: Stats
}

/**
 * Convert an LLM draft into a `Profile`. Dimensions are normalised to exactly one per
 * key (first wins; missing keys get an empty placeholder so the report can flag them).
 */
export const fromLlmProfileDraft = (draft: LlmProfileDraft, extras: ProfileExtras): Profile => ({
  schemaVersion: PROFILE_SCHEMA_VERSION,
  portrait:
    draft.portrait === null
      ? null
      : {
          ...draft.portrait,
          chapters: draft.portrait.chapters.map((c) => ({
            ...c,
            evidence: c.evidence.map(toEvidence),
          })),
          axes: draft.portrait.axes.map((a) => ({
            ...a,
            evidence: a.evidence.map(toEvidence),
            counterEvidence: a.counterEvidence.map(toEvidence),
          })),
        },
  // English only; the analysis adds translations afterwards.
  languages: ["en"],
  translations: {},
  generatedAt: extras.generatedAt,
  engine: extras.engine,
  coverage: extras.coverage,
  headline: draft.headline,
  archetype: draft.archetype,
  dimensions: DIMENSION_KEYS.map((key) => {
    const d = draft.dimensions.find((x) => x.key === key)
    return d
      ? { key, title: d.title, summary: d.summary, evidence: d.evidence.map(toEvidence) }
      : { key, title: key, summary: "", evidence: [] }
  }),
  traits: draft.traits.map((t) => ({
    name: t.name,
    description: t.description,
    confidence: t.confidence,
    evidence: t.evidence.map(toEvidence),
    support: null,
  })),
  funFacts: draft.funFacts,
  improvements: draft.improvements.map((i) => ({
    title: i.title,
    pattern: i.pattern,
    impact: i.impact,
    suggestion: i.suggestion,
    evidence: i.evidence.map(toEvidence),
    rewrite: i.rewrite.promptId === "" || i.rewrite.after.trim() === "" ? null : i.rewrite,
  })),
  previous: null,
  stats: extras.stats,
})
