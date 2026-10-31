import { Clock, DateTime, Effect } from "effect"
import type { Observation, Profile, SafePrompt, Stats } from "../domain/index.ts"
import { LlmRunner } from "../llm/index.ts"
import type { AnalysisCache } from "./cache.ts"
import { emptyEpisodeCounts, selectEpisodes, verifyEpisodes } from "./episodes.ts"
import { AnalysisFailed, stageError, type AnalyzeError } from "./errors.ts"
import { mapChunks } from "./map.ts"
import {
  capEvidence,
  mergeObservations,
  observationsText,
  REDUCE_INPUT_LIMIT,
  retainOmittedEvidence,
} from "./merge.ts"
import { selectChunks, type AnalyzeOptions } from "./plan.ts"
import { Progress } from "./progress.ts"
import { draftProfile, evidenceOriginsOf, reduceInput, verifyProfile } from "./reduce.ts"
import { measureSteering } from "./steering.ts"
import { addTranslations } from "./translate.ts"
import { verifyObservations, type EvidenceCounts } from "./verify.ts"

/**
 * Prompts → `Profile`: map each chunk to observations, verify them against the prompts,
 * merge them until they fit the reduce input, draft and review the profile, verify it, then
 * translate the verified text.
 */
export const analyze = (input: {
  readonly prompts: ReadonlyArray<SafePrompt>
  readonly stats: Stats
  readonly options: AnalyzeOptions
}): Effect.Effect<Profile, AnalyzeError, LlmRunner | AnalysisCache | Progress> =>
  Effect.gen(function* () {
    const runner = yield* LlmRunner
    const progress = yield* Progress
    const { options } = input
    if (input.prompts.length === 0) {
      return yield* new AnalysisFailed({ reason: "no-prompts", chunksFailed: 0, chunksTotal: 0 })
    }
    const { all, chunks, sampled } = selectChunks(input.prompts, options)
    const { outcomes, analyzed, failed } = yield* mapChunks(chunks, options)

    // ---- verify the observations, per chunk -----------------------------------------------
    const mapCounts: EvidenceCounts = { kept: 0, dropped: 0 }
    const original = analyzed.flatMap(
      (o) =>
        verifyObservations(
          o.observations,
          new Map(o.chunk.prompts.map((p) => [p.id, p.text])),
          mapCounts,
        ).observations,
    )
    const sessionOf = new Map(
      outcomes.flatMap((o) => o.chunk.prompts.map((p) => [p.id, `${p.source}:${p.sessionId}`])),
    )
    const cap = (obs: ReadonlyArray<Observation>) =>
      capEvidence(obs, undefined, (id) => sessionOf.get(id) ?? id)

    // ---- steering and episodes, per conversation ------------------------------------------
    const steering = measureSteering(analyzed)
    const episodeCounts = emptyEpisodeCounts()
    const episodes = selectEpisodes(
      analyzed.map((o) => verifyEpisodes(o.observations.episodes, o.chunk, episodeCounts)),
    )

    // ---- merge until the observations fit the reduce input --------------------------------
    const observations = yield* mergeObservations({
      observations: retainOmittedEvidence(original, cap(original)),
      texts: new Map(input.prompts.map((p) => [p.id, p.text])),
      cap,
      options,
      onError: stageError("merge-failed", failed, chunks.length),
    })
    if (observationsText(observations).length > (options.reduceInputLimit ?? REDUCE_INPUT_LIMIT)) {
      return yield* new AnalysisFailed({
        reason: "input-too-large",
        chunksFailed: failed,
        chunksTotal: chunks.length,
      })
    }

    // ---- reduce, then keep only what the evidence supports --------------------------------
    yield* progress.onReduceStart
    const drafts = yield* draftProfile(
      reduceInput({ analyzed, observations, episodes, stats: input.stats }),
      options,
      stageError("reduce-failed", failed, chunks.length),
    )
    const { profile, counts } = verifyProfile({
      drafts,
      runnerId: runner.id,
      options,
      stats: input.stats,
      generatedAt: DateTime.makeUnsafe(yield* Clock.currentTimeMillis),
      outcomes,
      analyzed,
      chunksTotal: all.length,
      sampled,
      episodes,
      episodeCounts,
      steering,
    })
    yield* progress.onVerified(counts.kept, counts.dropped)

    // ---- translate (verified text only) ---------------------------------------------------
    return yield* addTranslations(
      { ...profile, evidenceOrigins: evidenceOriginsOf(profile, analyzed) },
      options.languages ?? ["en"],
    )
  })
