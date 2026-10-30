import { SIGNAL_BASES, UNDERSTANDING_KINDS } from "../Collaboration.ts"
import { AXIS_KEYS } from "../Interaction.ts"
import { Effect, Schema } from "effect"
import type { ChunkObservations } from "../ChunkObservations.ts"
import { ENDINGS, TASK_TYPES, TURN_ROLES } from "../Episode.ts"
import { INTERVENTION_KINDS } from "../Steering.ts"
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

/** What the map step returns: observations plus interaction episodes (plan 20 B). */
export const LlmChunkAnalysis = Schema.Struct({
  observations: LlmChunkObservations.fields.observations,
  episodes: Schema.Array(
    Schema.Struct({
      session: Schema.String,
      taskType: Schema.Literals(TASK_TYPES),
      task: Schema.String,
      turns: Schema.Array(
        Schema.Struct({
          promptId: Schema.String,
          quote: Schema.String,
          role: Schema.Literals(TURN_ROLES),
        }),
      ),
      /** `promptId` of the turn that shows the ending; an empty string when unknown. */
      ending: Schema.Struct({ kind: Schema.Literals(ENDINGS), promptId: Schema.String }),
    }),
  ),
  /** Every follow-up prompt of the batch that steers the AI or asks it for a repair. */
  interventions: Schema.Array(
    Schema.Struct({
      promptId: Schema.String,
      kind: Schema.Literals(INTERVENTION_KINDS),
      quote: Schema.String,
    }),
  ),
})
export type LlmChunkAnalysis = typeof LlmChunkAnalysis.Type

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
      explanation: Schema.String,
      /** Each way of working observed, at most one per pole, with the context it shows in. */
      sides: Schema.Array(
        Schema.Struct({
          pole: Schema.Literals(["first", "second"]),
          context: Schema.String,
          evidence: Schema.Array(LlmEvidence),
        }),
      ),
    }),
  ),
})

const LlmNarrativeClaim = Schema.Struct({
  text: Schema.String,
  evidence: Schema.Array(LlmEvidence),
})
export const LlmNarrative = Schema.Struct({
  thread: LlmNarrativeClaim,
  representativeEpisodeId: Schema.NullOr(Schema.String),
  chapters: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      focus: LlmNarrativeClaim,
      episodeIds: Schema.Array(Schema.String),
      patternClaims: Schema.Array(Schema.String),
    }),
  ),
  nuance: LlmNarrativeClaim,
  closing: LlmNarrativeClaim,
})

const LlmEffect = Schema.NullOr(
  Schema.Struct({ claim: Schema.String, evidence: Schema.Array(LlmEvidence) }),
)
export const LlmCollaboration = Schema.Struct({
  moves: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.String,
      episodeIds: Schema.Array(Schema.String),
      benefit: LlmEffect,
      cost: LlmEffect,
    }),
  ),
  signals: Schema.Array(
    Schema.Struct({
      kind: Schema.Literals(UNDERSTANDING_KINDS),
      basis: Schema.Literals(SIGNAL_BASES),
      observation: Schema.String,
      context: Schema.String,
      evidence: Schema.Array(LlmEvidence),
    }),
  ),
})
export type LlmCollaboration = typeof LlmCollaboration.Type

export const LlmProfileDraft = Schema.Struct({
  narrative: Schema.NullOr(LlmNarrative).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  collaboration: Schema.NullOr(LlmCollaboration).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
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
  /** Habits recurring across the given episodes, cited by episode id. */
  patterns: Schema.Array(
    Schema.Struct({
      claim: Schema.String,
      episodeIds: Schema.Array(Schema.String),
      counterEpisodeIds: Schema.Array(Schema.String),
    }),
  ),
  improvements: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      pattern: Schema.String,
      impact: Schema.String,
      suggestion: Schema.String,
      evidence: Schema.Array(LlmEvidence),
      /** `promptId` of one evidence prompt and the suggested prompt; empty strings for none. */
      experiment: Schema.NullOr(
        Schema.Struct({ when: Schema.String, observe: Schema.String }),
      ).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
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
  llm: LlmChunkObservations | LlmChunkAnalysis,
  chunkId: string,
): ChunkObservations => ({
  chunkId,
  observations: llm.observations.map((o) => ({
    dimension: o.dimension,
    claim: o.claim,
    evidence: o.evidence.map(toEvidence),
  })),
  episodes:
    "episodes" in llm
      ? llm.episodes.map((e) => ({
          ...e,
          turns: e.turns.map((t) => ({ ...t, quote: truncateQuote(t.quote) })),
          ending: {
            kind: e.ending.kind,
            promptId:
              e.ending.kind === "unknown" || e.ending.promptId === "" ? null : e.ending.promptId,
          },
        }))
      : [],
  interventions:
    "interventions" in llm
      ? llm.interventions.map((i) => ({ ...i, quote: truncateQuote(i.quote) }))
      : [],
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
  narrative: null,
  historyComparison: null,
  evidenceOrigins: [],
  collaboration: null,
  portrait:
    draft.portrait === null
      ? null
      : {
          ...draft.portrait,
          chapters: draft.portrait.chapters.map((c) => ({
            ...c,
            evidence: c.evidence.map(toEvidence),
          })),
          // `sessions` is counted by the analysis when it verifies the evidence
          axes: draft.portrait.axes.map((a) => ({
            ...a,
            sides: a.sides.map((side) => ({
              ...side,
              evidence: side.evidence.map(toEvidence),
              sessions: 0,
            })),
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
    experiment: i.experiment,
    rewrite: i.rewrite.promptId === "" || i.rewrite.after.trim() === "" ? null : i.rewrite,
  })),
  // the analysis fills both after verifying them against the map step's episodes
  episodes: [],
  patterns: [],
  // measured by the analysis from the map step's verified labels
  steering: null,
  previous: null,
  // the CLI fills it from local logs; the analysis never sees usage
  usage: null,
  stats: extras.stats,
})
