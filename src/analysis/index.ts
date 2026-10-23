import { Clock, DateTime, Effect, Option, Ref } from "effect"
import type { ChunkObservations, Observation } from "../domain/ChunkObservations.ts"
import { encodeStats } from "../domain/Stats.ts"
import type { Profile } from "../domain/Profile.ts"
import type { SafePrompt } from "../domain/SafePrompt.ts"
import type { Stats } from "../domain/Stats.ts"
import {
  fromLlmChunkObservations,
  fromLlmProfileDraft,
  LlmChunkObservations,
  LlmProfileDraft,
} from "../domain/llm/LlmSchemas.ts"
import { LlmRunner, makeLlmSchema, type LlmError } from "../llm/LlmRunner.ts"
import { AnalysisCache } from "./cache.ts"
import type { Chunk } from "./chunk.ts"
import { AnalysisFailed, type AnalyzeError } from "./errors.ts"
import { sha256 } from "./hash.ts"
import { Progress } from "./progress.ts"
import {
  capEvidence,
  groupForMerge,
  MIN_MERGE_SHRINK,
  observationsText,
  REDUCE_INPUT_LIMIT,
} from "./merge.ts"
import { DEFAULT_CONCURRENCY, keyParts, selectChunks, type AnalyzeOptions } from "./plan.ts"
import { loadPrompt } from "./prompts.ts"
import {
  verifyDimensions,
  verifyObservations,
  verifyTraits,
  type EvidenceCounts,
} from "./verify.ts"
import { ANALYSIS_VERSION } from "./version.ts"

export { AnalysisFailed, type AnalyzeError } from "./errors.ts"
export { REDUCE_INPUT_LIMIT } from "./merge.ts"
export {
  DEFAULT_CONCURRENCY,
  plan,
  selectChunks,
  type AnalysisPlan,
  type AnalyzeOptions,
} from "./plan.ts"

const OBSERVATIONS_SCHEMA = makeLlmSchema("LlmChunkObservations", LlmChunkObservations)
const DRAFT_SCHEMA = makeLlmSchema("LlmProfileDraft", LlmProfileDraft)

/** LLM errors that will not succeed on a retry: stop everything immediately. */
const FATAL: ReadonlySet<LlmError["_tag"]> = new Set(["NotInstalled", "NotLoggedIn", "Interrupted"])

// ---------------------------------------------------------------------------------------
// Analyze

interface MapOutcome {
  readonly chunk: Chunk
  readonly observations: ChunkObservations | null
  readonly fromCache: boolean
  readonly model: string | null
  readonly error: LlmError | null
}

export const analyze = (input: {
  readonly prompts: ReadonlyArray<SafePrompt>
  readonly stats: Stats
  readonly options: AnalyzeOptions
}): Effect.Effect<Profile, AnalyzeError, LlmRunner | AnalysisCache | Progress> =>
  Effect.gen(function* () {
    const runner = yield* LlmRunner
    const cache = yield* AnalysisCache
    const progress = yield* Progress
    const { options } = input
    if (input.prompts.length === 0) {
      return yield* new AnalysisFailed({ reason: "no-prompts", chunksFailed: 0, chunksTotal: 0 })
    }
    const texts = new Map(input.prompts.map((p) => [p.id, p.text]))
    const { all, chunks, sampled } = selectChunks(input.prompts, options)
    const total = chunks.length
    const mapSystem = loadPrompt("map", options.language)
    const rateLimited = yield* Ref.make<LlmError | null>(null)

    // ---- map ------------------------------------------------------------------------
    const mapChunk = (chunk: Chunk, index: number): Effect.Effect<MapOutcome, LlmError> =>
      Effect.gen(function* () {
        const parts = keyParts("map", chunk.id, runner.id, options)
        const cached = options.noCache ? Option.none() : yield* cache.get(parts)
        if (Option.isSome(cached)) {
          yield* progress.onChunkDone({
            index,
            total,
            fromCache: true,
            failed: false,
            durationMs: null,
          })
          return {
            chunk,
            observations: cached.value.value,
            fromCache: true,
            model: cached.value.producedBy,
            error: null,
          }
        }
        // after a rate limit, stop sending new chunks
        if ((yield* Ref.get(rateLimited)) !== null) {
          return { chunk, observations: null, fromCache: false, model: null, error: null }
        }
        yield* progress.onChunkStart(index, total)
        const result = yield* runner
          .generate({ system: mapSystem, prompt: chunk.text, schema: OBSERVATIONS_SCHEMA })
          .pipe(Effect.result)
        if (result._tag === "Failure") {
          const error = result.failure
          if (FATAL.has(error._tag)) return yield* Effect.fail(error)
          if (error._tag === "RateLimited") yield* Ref.set(rateLimited, error)
          yield* progress.onChunkDone({
            index,
            total,
            fromCache: false,
            failed: true,
            durationMs: null,
          })
          return { chunk, observations: null, fromCache: false, model: null, error }
        }
        const observations = fromLlmChunkObservations(result.success.value, chunk.id)
        yield* cache.set({ ...parts, producedBy: result.success.model, value: observations })
        yield* progress.onChunkDone({
          index,
          total,
          fromCache: false,
          failed: false,
          durationMs: result.success.durationMs,
        })
        return { chunk, observations, fromCache: false, model: result.success.model, error: null }
      })

    const outcomes = yield* Effect.forEach(chunks, mapChunk, {
      concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
    })

    const limited = yield* Ref.get(rateLimited)
    if (limited !== null) return yield* Effect.fail(limited)

    const failed = outcomes.filter((o) => o.observations === null)
    if (failed.length * 2 > total) {
      return yield* new AnalysisFailed({
        reason: "too-many-chunk-failures",
        chunksFailed: failed.length,
        chunksTotal: total,
        cause: failed.find((o) => o.error !== null)?.error ?? undefined,
      })
    }

    // ---- verify (map) ---------------------------------------------------------------
    const mapCounts: EvidenceCounts = { kept: 0, dropped: 0 }
    const verified = outcomes.flatMap((o) =>
      o.observations === null ? [] : [verifyObservations(o.observations, texts, mapCounts)],
    )
    let observations: ReadonlyArray<Observation> = capEvidence(
      verified.flatMap((v) => v.observations),
    )

    // ---- intermediate merges when the reduce input is too large -----------------------
    /** Fatal errors stop everything as-is; anything else means the reduce stage failed. */
    const reduceError = (cause: LlmError): AnalyzeError =>
      FATAL.has(cause._tag)
        ? cause
        : new AnalysisFailed({
            reason: "reduce-failed",
            chunksFailed: failed.length,
            chunksTotal: total,
            cause,
          })
    const limit = options.reduceInputLimit ?? REDUCE_INPUT_LIMIT
    const merge = (group: ReadonlyArray<Observation>) =>
      Effect.gen(function* () {
        const text = observationsText(group)
        const parts = keyParts("merge", sha256(text), runner.id, options)
        const cached = options.noCache ? Option.none() : yield* cache.get(parts)
        // The cache stores raw LLM output: verify on every path, cached or not.
        const value = Option.isSome(cached)
          ? cached.value.value
          : yield* runner
              .generate({
                system: loadPrompt("merge", options.language),
                prompt: text,
                schema: OBSERVATIONS_SCHEMA,
              })
              .pipe(
                Effect.flatMap((result) => {
                  const fresh = fromLlmChunkObservations(result.value, parts.inputId)
                  return cache
                    .set({ ...parts, producedBy: result.model, value: fresh })
                    .pipe(Effect.as(fresh))
                }),
              )
        return capEvidence(verifyObservations(value, texts).observations)
      })
    for (let round = 0; round < 3; round++) {
      const before = observationsText(observations).length
      if (before <= limit) break
      const groups = groupForMerge(observations, limit)
      yield* progress.onMergeStart(groups.length)
      const merged = yield* Effect.forEach(groups, merge, {
        concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
      }).pipe(Effect.mapError(reduceError))
      observations = merged.flat()
      // another round would not get much smaller either
      if (observationsText(observations).length > before * (1 - MIN_MERGE_SHRINK)) break
    }

    // ---- reduce ---------------------------------------------------------------------
    yield* progress.onReduceStart
    const reducePrompt = `observations:\n${observationsText(observations)}\n\nstats:\n${JSON.stringify(encodeStats(input.stats))}`
    const draft = yield* runner
      .generate({
        system: loadPrompt("reduce", options.language),
        prompt: reducePrompt,
        schema: DRAFT_SCHEMA,
      })
      .pipe(Effect.mapError(reduceError))
    yield* progress.onReduceDone(draft.durationMs)

    // ---- verify (reduce) ------------------------------------------------------------
    const counts: EvidenceCounts = { kept: 0, dropped: 0 }
    const generatedAt = DateTime.makeUnsafe(yield* Clock.currentTimeMillis)
    // outcomes are in chunk order
    const analyzedPrompts = outcomes
      .filter((o) => o.observations !== null)
      .flatMap((o) => o.chunk.prompts)
    const profile = fromLlmProfileDraft(draft.value, {
      generatedAt,
      engine: {
        runner: runner.id,
        model: draft.model ?? outcomes.find((o) => o.model !== null)?.model ?? options.model,
        analysisVersion: ANALYSIS_VERSION,
      },
      language: options.language,
      stats: input.stats,
      coverage: {
        chunksTotal: all.length,
        chunksAnalyzed: total - failed.length,
        chunksFromCache: outcomes.filter((o) => o.fromCache).length,
        chunksFailed: failed.length,
        sampled,
        sessionsAnalyzed: new Set(analyzedPrompts.map((p) => `${p.source}:${p.sessionId}`)).size,
        promptsAnalyzed: analyzedPrompts.length,
        evidenceKept: 0,
        evidenceDropped: 0,
      },
    })
    const traits = verifyTraits(profile.traits, texts, counts)
    const dimensions = verifyDimensions(profile.dimensions, texts, counts)
    yield* progress.onVerified(counts.kept, counts.dropped)
    return {
      ...profile,
      traits,
      dimensions,
      coverage: { ...profile.coverage, evidenceKept: counts.kept, evidenceDropped: counts.dropped },
    }
  })
