import { Effect, Option } from "effect"
import type { SafePrompt } from "../domain/SafePrompt.ts"
import { PIPELINE_VERSION } from "../pipeline/version.ts"
import { AnalysisCache, type CacheKeyParts } from "./cache.ts"
import { buildChunks, DEFAULT_MAX_CHUNKS, sampleChunks, type Chunk } from "./chunk.ts"
import { ANALYSIS_VERSION } from "./version.ts"

/** LLM calls in flight, to stay clear of subscription rate limits. */
export const DEFAULT_CONCURRENCY = 3

export interface AnalyzeOptions {
  readonly timezone: string
  /** `--full`: no chunk limit. */
  readonly full: boolean
  readonly maxChunks?: number
  /** LLM calls in flight (default DEFAULT_CONCURRENCY). */
  readonly concurrency?: number
  /** `--no-cache`: skip cache reads (results are still written). */
  readonly noCache: boolean
  /** `--model` passed to the runner; part of the cache key. */
  readonly model: string | null
  /** Observations above this many characters are merged first (default REDUCE_INPUT_LIMIT). */
  readonly reduceInputLimit?: number
}

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

export const keyParts = (
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
