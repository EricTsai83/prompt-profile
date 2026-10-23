import { Clock, DateTime, Effect, Option, Ref } from "effect"
import type { ChunkObservations, Observation } from "../domain/ChunkObservations.ts"
import { encodeStats } from "../domain/Stats.ts"
import type { Language, Profile } from "../domain/Profile.ts"
import type { SafePrompt } from "../domain/SafePrompt.ts"
import type { Stats } from "../domain/Stats.ts"
import {
  fromLlmChunkObservations,
  fromLlmProfileDraft,
  LlmChunkObservations,
  LlmProfileDraft,
} from "../domain/llm/LlmSchemas.ts"
import { LlmRunner, makeLlmSchema, type LlmError } from "../llm/LlmRunner.ts"
import { PIPELINE_VERSION } from "../pipeline/version.ts"
import { AnalysisCache, type CacheKeyParts } from "./cache.ts"
import { buildChunks, DEFAULT_MAX_CHUNKS, sampleChunks, type Chunk } from "./chunk.ts"
import { AnalysisFailed, type AnalyzeError } from "./errors.ts"
import { sha256 } from "./hash.ts"
import { Progress } from "./progress.ts"
import { loadPrompt } from "./prompts.ts"
import {
  verifyDimensions,
  verifyObservations,
  verifyTraits,
  type EvidenceCounts,
} from "./verify.ts"
import { ANALYSIS_VERSION } from "./version.ts"

export { AnalysisFailed, type AnalyzeError } from "./errors.ts"

export interface AnalyzeOptions {
  readonly language: Language
  readonly timezone: string
  /** `--full`: no chunk limit. */
  readonly full: boolean
  readonly maxChunks?: number
  /** Map calls in flight (default 3, to stay clear of subscription rate limits). */
  readonly concurrency?: number
  /** `--no-cache`: skip cache reads (results are still written). */
  readonly noCache: boolean
  /** `--model` passed to the runner; part of the cache key. */
  readonly model: string | null
}

/** Observations above this many characters are merged in groups before the final reduce. */
export const REDUCE_INPUT_LIMIT = 100_000

const OBSERVATIONS_SCHEMA = makeLlmSchema("LlmChunkObservations", LlmChunkObservations)
const DRAFT_SCHEMA = makeLlmSchema("LlmProfileDraft", LlmProfileDraft)

/** LLM errors that will not succeed on a retry: stop everything immediately. */
const FATAL: ReadonlySet<LlmError["_tag"]> = new Set(["NotInstalled", "NotLoggedIn", "Interrupted"])

// ---------------------------------------------------------------------------------------
// Plan

export interface AnalysisPlan {
  readonly chunksTotal: number
  readonly chunks: ReadonlyArray<Chunk>
  readonly sampled: boolean
  readonly cacheHits: number
  /** Map calls for uncached chunks + at least one reduce call. */
  readonly llmCalls: number
  /** Characters that will be sent (uncached chunks only). */
  readonly charsToSend: number
  readonly promptsAnalyzed: number
  readonly sessionsAnalyzed: number
}

const keyParts = (
  kind: CacheKeyParts["kind"],
  inputId: string,
  runner: string,
  options: AnalyzeOptions,
): CacheKeyParts => ({
  kind,
  inputId,
  analysisVersion: ANALYSIS_VERSION,
  pipelineVersion: PIPELINE_VERSION,
  runner,
  model: options.model,
  language: options.language,
})

export const selectChunks = (prompts: ReadonlyArray<SafePrompt>, options: AnalyzeOptions) => {
  const all = buildChunks(prompts, options.timezone)
  const { chunks, sampled } = options.full
    ? { chunks: all, sampled: false }
    : sampleChunks(all, options.maxChunks ?? DEFAULT_MAX_CHUNKS)
  return { all, chunks, sampled }
}

/** What `analyze` would do — shown before asking "continue?" and used by --dry-run. */
export const plan = (input: {
  readonly prompts: ReadonlyArray<SafePrompt>
  readonly options: AnalyzeOptions
  readonly runner: string
}): Effect.Effect<AnalysisPlan, never, AnalysisCache> =>
  Effect.gen(function* () {
    const cache = yield* AnalysisCache
    const { all, chunks, sampled } = selectChunks(input.prompts, input.options)
    let cacheHits = 0
    let charsToSend = 0
    for (const c of chunks) {
      const hit = input.options.noCache
        ? false
        : Option.isSome(yield* cache.get(keyParts("map", c.id, input.runner, input.options)))
      if (hit) cacheHits++
      else charsToSend += c.text.length
    }
    const prompts = chunks.flatMap((c) => c.prompts)
    return {
      chunksTotal: all.length,
      chunks,
      sampled,
      cacheHits,
      llmCalls: chunks.length - cacheHits + (chunks.length > 0 ? 1 : 0),
      charsToSend,
      promptsAnalyzed: prompts.length,
      sessionsAnalyzed: new Set(prompts.map((p) => `${p.source}:${p.sessionId}`)).size,
    }
  })

// ---------------------------------------------------------------------------------------
// Analyze

interface MapOutcome {
  readonly chunk: Chunk
  readonly observations: ChunkObservations | null
  readonly fromCache: boolean
  readonly model: string | null
  readonly error: LlmError | null
}

const observationsText = (obs: ReadonlyArray<Observation>): string =>
  JSON.stringify(
    obs.map((o) => ({ dimension: o.dimension, claim: o.claim, evidence: o.evidence })),
    null,
    0,
  )

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
      concurrency: options.concurrency ?? 3,
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
    let observations: ReadonlyArray<Observation> = verified.flatMap((v) => v.observations)

    // ---- intermediate merges when the reduce input is too large -----------------------
    const merge = (group: ReadonlyArray<Observation>) =>
      Effect.gen(function* () {
        const text = observationsText(group)
        const parts = keyParts("merge", sha256(text), runner.id, options)
        const cached = options.noCache ? Option.none() : yield* cache.get(parts)
        if (Option.isSome(cached)) return cached.value.value.observations
        const result = yield* runner.generate({
          system: loadPrompt("merge", options.language),
          prompt: text,
          schema: OBSERVATIONS_SCHEMA,
        })
        const value = fromLlmChunkObservations(result.value, parts.inputId)
        yield* cache.set({ ...parts, producedBy: result.model, value })
        return verifyObservations(value, texts).observations
      })
    for (
      let round = 0;
      round < 3 && observationsText(observations).length > REDUCE_INPUT_LIMIT;
      round++
    ) {
      const groups: Array<Array<Observation>> = [[]]
      let size = 0
      for (const o of observations) {
        const len = observationsText([o]).length
        if (size + len > REDUCE_INPUT_LIMIT / 2 && groups.at(-1)!.length > 0) {
          groups.push([])
          size = 0
        }
        groups.at(-1)!.push(o)
        size += len
      }
      yield* progress.onMergeStart(groups.length)
      const merged = yield* Effect.forEach(groups, merge, {
        concurrency: options.concurrency ?? 3,
      }).pipe(
        Effect.mapError(
          (cause) =>
            new AnalysisFailed({
              reason: "reduce-failed",
              chunksFailed: failed.length,
              chunksTotal: total,
              cause,
            }),
        ),
      )
      observations = merged.flat()
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
      .pipe(
        Effect.mapError((cause) =>
          FATAL.has(cause._tag)
            ? cause
            : new AnalysisFailed({
                reason: "reduce-failed",
                chunksFailed: failed.length,
                chunksTotal: total,
                cause,
              }),
        ),
      )
    yield* progress.onReduceDone(draft.durationMs)

    // ---- verify (reduce) ------------------------------------------------------------
    const counts: EvidenceCounts = { kept: 0, dropped: 0 }
    const generatedAt = DateTime.makeUnsafe(yield* Clock.currentTimeMillis)
    const analyzedPrompts = chunks
      .filter((c) => outcomes.some((o) => o.chunk === c && o.observations !== null))
      .flatMap((c) => c.prompts)
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
