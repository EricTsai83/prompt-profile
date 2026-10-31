import { type DateTime, Effect } from "effect"
import {
  DEFAULT_VOICE,
  encodeStats,
  fromLlmProfileDraft,
  LlmProfileDraft,
  roleCode,
  ROLE_NAMES,
  type EvidenceOrigin,
  type Observation,
  type Profile,
  type Stats,
  type Steering,
} from "../domain/index.ts"
import {
  LlmRunner,
  makeLlmSchema,
  type GenerateResult,
  type LlmError,
  type RunnerId,
} from "../llm/index.ts"
import { verifyCollaboration } from "./collaboration.ts"
import {
  episodeCoverage,
  episodesForReduce,
  toProfileEpisode,
  verifyPatterns,
  type EpisodeCounts,
  type SelectedEpisode,
} from "./episodes.ts"
import type { AnalyzeError } from "./errors.ts"
import { factsFromStats } from "./facts.ts"
import type { AnalyzedChunk, MapOutcome } from "./map.ts"
import { observationsText } from "./merge.ts"
import { verifyNarrative } from "./narrative.ts"
import type { AnalyzeOptions } from "./plan.ts"
import { verifyPortrait } from "./portrait.ts"
import { Progress } from "./progress.ts"
import { sourceContext } from "./source-context.ts"
import {
  verifyDimensions,
  verifyImprovements,
  verifyTraits,
  type EvidenceCounts,
} from "./verify.ts"
import { ANALYSIS_VERSION } from "./version.ts"
import { narrationPrompt } from "./voice.ts"

const DRAFT_SCHEMA = makeLlmSchema("LlmProfileDraft", LlmProfileDraft)

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

/**
 * Stats as sent to the reduce step. Weekday arrays become objects keyed by day name: a model
 * misread the Monday-first array as Sunday-first in the stage-3 comparison (plan 11).
 */
export const statsForReduce = (stats: Stats) => {
  // Per-project activity is for the charts only: it would add project names by day. The
  // monthly technique breakdown is chart data too; the totals stay.
  const { activity: _activity, techniques, ...encoded } = encodeStats(stats)
  const byDay = <A>(xs: ReadonlyArray<A>) =>
    Object.fromEntries(WEEKDAYS.map((day, i) => [day, xs[i]]))
  return {
    ...encoded,
    techniques:
      techniques === null || techniques === undefined
        ? null
        : {
            tools: techniques.tools,
            prompts: techniques.prompts,
            maxParallel: techniques.maxParallel,
          },
    weekdayHistogram: byDay(encoded.weekdayHistogram),
    activityGrid: byDay(encoded.activityGrid),
  }
}

/** The reduce input: the cited prompts' context, the episodes, the observations and the stats. */
export const reduceInput = (input: {
  readonly analyzed: ReadonlyArray<AnalyzedChunk>
  readonly observations: ReadonlyArray<Observation>
  readonly episodes: ReadonlyArray<SelectedEpisode>
  readonly stats: Stats
}): string => {
  const citedIds = new Set([
    ...input.observations.flatMap((o) => o.evidence.map((e) => e.promptId)),
    ...input.episodes.flatMap((e) => e.turns.map((t) => t.promptId)),
  ])
  const prompts = input.analyzed.flatMap((o) => o.chunk.prompts)
  const promptContext = prompts
    .filter((p) => citedIds.has(p.id))
    .map((p) => ({
      promptId: p.id,
      session: `${p.source}:${p.sessionId}`,
      time: p.timestamp.toString(),
    }))
  const contextSources = sourceContext(prompts, citedIds)
  return `sourceExcerpts:\n${JSON.stringify(contextSources)}\n\npromptContext:\n${JSON.stringify(promptContext)}\n\nepisodes:\n${JSON.stringify(episodesForReduce(input.episodes))}\n\nobservations:\n${observationsText(input.observations)}\n\nstats:\n${JSON.stringify(statsForReduce(input.stats))}`
}

export interface Drafts {
  readonly initial: GenerateResult<LlmProfileDraft>
  readonly reviewed: GenerateResult<LlmProfileDraft>
}

/**
 * The reduce stage: draft the profile, then review the draft against the same input.
 * Reviewing only the draft could not recover omissions, so the original context stays. A
 * failed review fails the stage: the unreviewed draft is never published as a fallback.
 */
export const draftProfile = (
  prompt: string,
  options: AnalyzeOptions,
  onError: (cause: LlmError) => AnalyzeError,
): Effect.Effect<Drafts, AnalyzeError, LlmRunner | Progress> =>
  Effect.gen(function* () {
    const runner = yield* LlmRunner
    const progress = yield* Progress
    const system = narrationPrompt("reduce", options.voice)
    const initial = yield* runner
      .generate({ stage: "draft", system, prompt, schema: DRAFT_SCHEMA })
      .pipe(Effect.mapError(onError))
    yield* progress.onReviewStart ?? Effect.void
    const reviewed = yield* runner
      .generate({
        stage: "review",
        system: `${system}\n\n${narrationPrompt("review", options.voice)}`,
        prompt: `draft:\n${JSON.stringify(initial.value)}\n\n${prompt}`,
        schema: DRAFT_SCHEMA,
      })
      .pipe(Effect.mapError(onError))
    yield* progress.onReduceDone(initial.durationMs + reviewed.durationMs)
    return { initial, reviewed }
  })

const sessionKey = (p: { readonly source: string; readonly sessionId: string }) =>
  `${p.source}:${p.sessionId}`

/**
 * Turn the reviewed draft into the profile, keeping only what its evidence supports. Global
 * summaries have no direct citations: they are conservatively reset when anything was rejected.
 */
export const verifyProfile = (input: {
  readonly drafts: Drafts
  readonly runnerId: RunnerId
  readonly options: AnalyzeOptions
  readonly stats: Stats
  readonly generatedAt: DateTime.Utc
  readonly outcomes: ReadonlyArray<MapOutcome>
  readonly analyzed: ReadonlyArray<AnalyzedChunk>
  readonly chunksTotal: number
  readonly sampled: boolean
  readonly episodes: ReadonlyArray<SelectedEpisode>
  readonly episodeCounts: EpisodeCounts
  readonly steering: Steering
}): { readonly profile: Profile; readonly counts: EvidenceCounts } => {
  const { drafts, options, outcomes, analyzed, episodes } = input
  const draft = drafts.reviewed
  const counts: EvidenceCounts = { kept: 0, dropped: 0 }
  const analyzedPrompts = analyzed.flatMap((o) => o.chunk.prompts)
  const profile = fromLlmProfileDraft(draft.value, {
    generatedAt: input.generatedAt,
    voice: options.voice ?? DEFAULT_VOICE,
    engine: {
      runner: input.runnerId,
      model: draft.model ?? outcomes.find((o) => o.model !== null)?.model ?? options.model,
      modelSource:
        draft.model !== null ? (draft.modelSource ?? null) : options.model ? "requested" : null,
      modelsUsed: [
        ...new Set([
          ...analyzed.map((o) => (o.modelSource === "reported" ? o.model : null)),
          drafts.initial.modelSource === "reported" ? drafts.initial.model : null,
          draft.modelSource === "reported" ? draft.model : null,
        ]),
      ],
      effort: options.effort ?? null,
      analysisVersion: ANALYSIS_VERSION,
    },
    stats: input.stats,
    coverage: {
      chunksTotal: input.chunksTotal,
      chunksAnalyzed: analyzed.length,
      chunksFromCache: outcomes.filter((o) => o.fromCache).length,
      chunksFailed: outcomes.length - analyzed.length,
      sampled: input.sampled,
      sessionsAnalyzed: new Set(analyzedPrompts.map(sessionKey)).size,
      promptsAnalyzed: analyzedPrompts.length,
      evidenceKept: 0,
      evidenceDropped: 0,
      episodes: null,
    },
  })
  const originOf = (chunks: ReadonlyArray<MapOutcome>) =>
    new Map(
      chunks.flatMap((o) =>
        o.chunk.prompts.map((p) => [p.id, { session: sessionKey(p), week: o.chunk.id }] as const),
      ),
    )
  const origins = originOf(analyzed)
  const texts = new Map(analyzedPrompts.map((p) => [p.id, p.text]))
  const collaboration = verifyCollaboration(
    draft.value.collaboration,
    episodes,
    texts,
    origins,
    counts,
  )
  const patterns = verifyPatterns(draft.value.patterns, episodes, input.episodeCounts)
  const narrative = verifyNarrative(
    draft.value.narrative,
    profile.portrait,
    episodes,
    patterns,
    texts,
  )
  const narrativeRejected = profile.portrait !== null && !narrative
  const portraitStart = counts.kept
  const checkedPortrait = verifyPortrait(profile.portrait, texts, origins, counts)
  if (narrativeRejected) {
    counts.dropped += counts.kept - portraitStart
    counts.kept = portraitStart
  }
  const portrait = narrativeRejected ? null : checkedPortrait
  const code = portrait ? roleCode(portrait.axes) : null
  const traits = verifyTraits(profile.traits, texts, counts, originOf(outcomes))
  const dimensions = verifyDimensions(profile.dimensions, texts, counts)
  const improvements = verifyImprovements(profile.improvements.slice(0, 2), texts, counts)
  const summariesUnsafe =
    narrativeRejected ||
    counts.dropped > 0 ||
    !(portrait || traits.length || improvements.length || dimensions.some((d) => d.evidence.length))
  return {
    counts,
    profile: {
      ...profile,
      headline: summariesUnsafe ? "Collaboration observations" : profile.headline,
      portrait: summariesUnsafe ? null : portrait,
      archetype: summariesUnsafe
        ? { name: "Collaboration observations", description: "" }
        : { ...profile.archetype, name: code ? ROLE_NAMES[code]! : "Collaboration Portrait" },
      traits,
      collaboration,
      narrative: summariesUnsafe ? null : narrative,
      funFacts: factsFromStats(input.stats),
      dimensions,
      improvements,
      episodes: episodes.map(toProfileEpisode),
      patterns,
      steering: input.steering,
      coverage: {
        ...profile.coverage,
        narrativeRejected: narrativeRejected ? 1 : 0,
        evidenceKept: counts.kept,
        evidenceDropped: counts.dropped,
        episodes: episodeCoverage(input.episodeCounts, episodes.length),
      },
    },
  }
}

/** Where each prompt the profile cites sits in its conversation. */
export const evidenceOriginsOf = (
  profile: Profile,
  analyzed: ReadonlyArray<AnalyzedChunk>,
): Array<EvidenceOrigin> => {
  const cited = new Set([
    ...profile.traits.flatMap((t) => t.evidence.map((e) => e.promptId)),
    ...profile.dimensions.flatMap((t) => t.evidence.map((e) => e.promptId)),
    ...profile.improvements.flatMap((t) => t.evidence.map((e) => e.promptId)),
    ...(profile.portrait?.chapters.flatMap((t) => t.evidence.map((e) => e.promptId)) ?? []),
    ...(profile.portrait?.axes.flatMap((a) =>
      a.sides.flatMap((t) => t.evidence.map((e) => e.promptId)),
    ) ?? []),
    ...(profile.collaboration?.signals.flatMap((t) => t.evidence.map((e) => e.promptId)) ?? []),
    ...profile.episodes.flatMap((e) => e.turns.map((t) => t.promptId)),
  ])
  return analyzed.flatMap((o) =>
    o.chunk.prompts
      .filter((p) => cited.has(p.id))
      .flatMap((p) => {
        const position = o.chunk.positions.get(p.id)
        return position
          ? [
              {
                promptId: p.id,
                session: position.session,
                time: p.timestamp,
                turn: position.turn,
                of: position.of,
              },
            ]
          : []
      }),
  )
}
