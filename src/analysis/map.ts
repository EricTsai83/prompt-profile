import { Effect, Option, Ref } from "effect"
import {
  fromLlmChunkObservations,
  LlmChunkAnalysis,
  type ChunkObservations,
} from "../domain/index.ts"
import { LlmRunner, makeLlmSchema, type LlmError, type ModelSource } from "../llm/index.ts"
import { AnalysisCache } from "./cache.ts"
import type { Chunk } from "./chunk.ts"
import { AnalysisFailed, FATAL, type AnalyzeError } from "./errors.ts"
import { DEFAULT_CONCURRENCY, keyParts, type AnalyzeOptions } from "./plan.ts"
import { Progress } from "./progress.ts"
import { loadPrompt } from "./prompts.ts"

const ANALYSIS_SCHEMA = makeLlmSchema("LlmChunkAnalysis", LlmChunkAnalysis)

export interface MapOutcome {
  readonly chunk: Chunk
  readonly observations: ChunkObservations | null
  readonly fromCache: boolean
  readonly model: string | null
  readonly modelSource: ModelSource
  readonly error: LlmError | null
}

export interface AnalyzedChunk extends MapOutcome {
  readonly observations: ChunkObservations
}

export interface MapResult {
  /** One per chunk, in chunk order. */
  readonly outcomes: ReadonlyArray<MapOutcome>
  /** The chunks that produced observations, in chunk order. */
  readonly analyzed: ReadonlyArray<AnalyzedChunk>
  readonly failed: number
}

const unanalyzed = (chunk: Chunk, error: LlmError | null): MapOutcome => ({
  chunk,
  observations: null,
  fromCache: false,
  model: null,
  modelSource: null,
  error,
})

/**
 * The map stage: observe each chunk, reusing cached results. A fatal error stops everything;
 * after a rate limit no new chunk is sent and the stage fails with it; it also fails when more
 * than half of the chunks failed.
 */
export const mapChunks = (
  chunks: ReadonlyArray<Chunk>,
  options: AnalyzeOptions,
): Effect.Effect<MapResult, AnalyzeError, LlmRunner | AnalysisCache | Progress> =>
  Effect.gen(function* () {
    const runner = yield* LlmRunner
    const cache = yield* AnalysisCache
    const progress = yield* Progress
    const total = chunks.length
    const system = loadPrompt("map")
    const rateLimited = yield* Ref.make<LlmError | null>(null)

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
            modelSource: cached.value.producedSource ?? null,
            error: null,
          }
        }
        // after a rate limit, stop sending new chunks
        if ((yield* Ref.get(rateLimited)) !== null) return unanalyzed(chunk, null)
        yield* progress.onChunkStart(index, total)
        const result = yield* runner
          .generate({ stage: "map", system, prompt: chunk.text, schema: ANALYSIS_SCHEMA })
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
          return unanalyzed(chunk, error)
        }
        const observations = fromLlmChunkObservations(result.success.value, chunk.id)
        yield* cache.set({
          ...parts,
          producedBy: result.success.model,
          producedSource: result.success.modelSource ?? null,
          value: observations,
        })
        yield* progress.onChunkDone({
          index,
          total,
          fromCache: false,
          failed: false,
          durationMs: result.success.durationMs,
        })
        return {
          chunk,
          observations,
          fromCache: false,
          model: result.success.model,
          modelSource: result.success.modelSource ?? null,
          error: null,
        }
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
    return {
      outcomes,
      analyzed: outcomes.filter((o): o is AnalyzedChunk => o.observations !== null),
      failed: failed.length,
    }
  })
