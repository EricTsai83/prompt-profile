import { generateCached } from "./generated.ts"
import type { AnalysisCache } from "./cache.ts"
import { instructionEvidence, type SafePrompt } from "../domain/index.ts"
import { projectConversations, verifyAbilities } from "./abilities.ts"
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
  type AxisBalance,
} from "../domain/index.ts"
import {
  type LlmRunner,
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
import { verifyFunFacts } from "./facts.ts"
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
  keepRecurringTraits,
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
  // Selection-clock metadata changes on every retry; observed dateRange remains evidence.
  const { activity: _activity, window: _window, techniques, ...encoded } = encodeStats(stats)
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
  readonly axisBalance?: AxisBalance
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
      project: p.project,
    }))
  const contextSources = sourceContext(prompts, citedIds)
  return `instructionContexts:\n${JSON.stringify(instructionContextForReduce(prompts))}\n\nprojectConversations:\n${JSON.stringify([...projectConversations(prompts)])}\n\nsourceExcerpts:\n${JSON.stringify(contextSources)}\n\npromptContext:\n${JSON.stringify(promptContext)}${input.axisBalance ? `\n\naxisBalance:\n${JSON.stringify(input.axisBalance)}` : ""}\n\nepisodes:\n${JSON.stringify(episodesForReduce(input.episodes))}\n\nobservations:\n${observationsText(input.observations)}\n\nstats:\n${JSON.stringify(statsForReduce(input.stats))}`
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
): Effect.Effect<Drafts, AnalyzeError, LlmRunner | AnalysisCache | Progress> =>
  Effect.gen(function* () {
    const progress = yield* Progress
    const system = narrationPrompt("reduce", options.voice)
    const initial = yield* generateCached(
      "draft",
      { stage: "draft", system, prompt, schema: DRAFT_SCHEMA },
      options,
    ).pipe(Effect.mapError(onError))
    yield* progress.onReviewStart ?? Effect.void
    const reviewed = yield* generateCached(
      "review",
      {
        stage: "review",
        system: `${system}\n\n${narrationPrompt("review", options.voice)}`,
        prompt: `draft:\n${JSON.stringify(initial.value)}\n\n${prompt}`,
        schema: DRAFT_SCHEMA,
      },
      options,
    ).pipe(Effect.mapError(onError))
    yield* progress.onReduceDone(initial.durationMs + reviewed.durationMs)
    return { initial, reviewed }
  })

const instructionContextForReduce = (prompts: ReadonlyArray<SafePrompt>) => {
  const all = prompts
    .flatMap((p) => p.instructionContexts ?? [])
    .map((c) => (c.selection === "user_explicit" ? c : { ...c, content: null }))
  let size = 0
  const included = all.filter((c) => {
    const length = JSON.stringify(c).length
    if (size + length > 20_000) return false
    size += length
    return true
  })
  return { included, eligible: all.length, omitted: all.length - included.length }
}

const sessionKey = (p: { readonly source: string; readonly sessionId: string }) =>
  `${p.source}:${p.sessionId}`

/**
 * Turn the reviewed draft into the profile, keeping only what its evidence supports. Global
 * summaries have no direct citations: they are conservatively reset when anything was rejected.
 */
/** Share of cited evidence that may fail verification before the summaries are withheld. */
export const MAX_DROPPED_SHARE = 0.2

/** Longest role name, in words (English, before translation). */
export const MAX_ROLE_NAME_WORDS = 5

/** Role names that say nothing about the person: one of these words, with "The" at most. */
export const GENERIC_ROLE_WORDS: ReadonlyArray<string> = [
  "developer",
  "engineer",
  "programmer",
  "coder",
  "collaborator",
  "user",
  "builder",
  "maker",
  "professional",
]

/** A role name is kept when it has 1–MAX_ROLE_NAME_WORDS words and is not a generic label. */
export const validRoleName = (name: string): boolean => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w !== "")
  if (words.length === 0 || words.length > MAX_ROLE_NAME_WORDS) return false
  const meaningful = words.filter((w) => !/^the$/i.test(w))
  return !(
    meaningful.length === 1 &&
    GENERIC_ROLE_WORDS.includes(meaningful[0]!.toLowerCase().replace(/[^a-z]/g, ""))
  )
}

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
  readonly axisBalance: AxisBalance
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
        o.chunk.prompts.flatMap((p) =>
          instructionEvidence(p).map(
            ([id]) => [id, { session: sessionKey(p), week: o.chunk.id }] as const,
          ),
        ),
      ),
    )
  const origins = originOf(analyzed)
  const texts = new Map(analyzedPrompts.flatMap(instructionEvidence))
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
  const traits = keepRecurringTraits(
    verifyTraits(profile.traits, texts, counts, originOf(outcomes)),
  )
  const abilities = verifyAbilities(
    draft.value.abilities,
    {
      texts,
      origins,
      projectOf: new Map(
        analyzedPrompts.flatMap((p) =>
          instructionEvidence(p).map(([id]) => [id, p.project] as const),
        ),
      ),
      projects: projectConversations(analyzedPrompts),
    },
    counts,
  )
  const dimensions = verifyDimensions(profile.dimensions, texts, counts)
  const improvements = verifyImprovements(profile.improvements.slice(0, 2), texts, counts)
  // A fabricated quote drops its own item; only a large share of them, a rejected narrative
  // or nothing supported at all makes the summaries (headline, role, portrait) unsafe.
  const summariesUnsafe =
    narrativeRejected ||
    counts.dropped > MAX_DROPPED_SHARE * (counts.kept + counts.dropped) ||
    !(portrait || traits.length || improvements.length || dimensions.some((d) => d.evidence.length))
  return {
    counts,
    profile: {
      ...profile,
      headline: summariesUnsafe ? "Collaboration observations" : profile.headline,
      portrait: summariesUnsafe ? null : portrait,
      archetype: summariesUnsafe
        ? { name: "Collaboration observations", description: "" }
        : {
            ...profile.archetype,
            // the model's synthesized name; the stable names only fill an empty answer
            name: validRoleName(profile.archetype.name)
              ? profile.archetype.name.trim()
              : (traits[0]?.name ?? (code ? ROLE_NAMES[code]! : "Collaboration Portrait")),
          },
      traits,
      instructionContexts: analyzedPrompts.flatMap((p) => p.instructionContexts ?? []),
      abilities,
      collaboration,
      narrative: summariesUnsafe ? null : narrative,
      funFacts: verifyFunFacts(profile.funFacts, input.stats),
      dimensions,
      improvements,
      episodes: episodes.map(toProfileEpisode),
      patterns,
      steering: input.steering,
      axisBalance: input.axisBalance,
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
    ...profile.abilities.flatMap((a) =>
      [...a.evidence, ...a.byProject.flatMap((p) => p.evidence)].map((e) => e.promptId),
    ),
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
      .filter((p) => instructionEvidence(p).some(([id]) => cited.has(id)))
      .flatMap((p) => {
        const position = o.chunk.positions.get(p.id)
        return position
          ? instructionEvidence(p)
              .filter(([id]) => cited.has(id))
              .map(([id]) => ({
                promptId: id,
                session: position.session,
                time: p.timestamp,
                turn: position.turn,
                of: position.of,
              }))
          : []
      }),
  )
}
