import { Effect, Option, Schema } from "effect"
import { LlmRunner, type GenerateInput, type GenerateResult, type LlmError } from "../llm/index.ts"
import { AnalysisCache, type GeneratedCacheEntry } from "./cache.ts"
import { sha256 } from "./hash.ts"
import { keyParts, type AnalyzeOptions } from "./plan.ts"
import { Progress } from "./progress.ts"

/** Checkpoint only successful output. Cache hits never replay historical consumption. */
export const generateCached = <A>(
  kind: GeneratedCacheEntry["kind"],
  input: GenerateInput<A>,
  options: AnalyzeOptions,
  accept: (value: A) => boolean = () => true,
  cachePrompt: string = input.prompt,
): Effect.Effect<GenerateResult<A>, LlmError, LlmRunner | AnalysisCache | Progress> =>
  Effect.gen(function* () {
    const runner = yield* LlmRunner
    const cache = yield* AnalysisCache
    const progress = yield* Progress
    const parts = {
      ...keyParts(
        kind,
        sha256(input.system, cachePrompt, JSON.stringify(input.schema.jsonSchema)),
        runner.id,
        options,
      ),
      kind,
    }
    const cached = options.noCache ? Option.none() : yield* cache.getGenerated(parts)
    if (Option.isSome(cached)) {
      const value = Schema.decodeUnknownOption(input.schema.schema)(cached.value.value)
      if (Option.isSome(value) && accept(value.value)) {
        yield* progress.onGeneratedCacheHit ?? Effect.void
        return {
          value: value.value,
          model: cached.value.producedBy,
          modelSource: cached.value.producedSource ?? null,
          durationMs: 0,
          usage: { inputTokens: null, outputTokens: null, costUsd: null },
        }
      }
    }
    const result = yield* runner.generate(input)
    if (accept(result.value))
      yield* cache.setGenerated({
        ...parts,
        producedBy: result.model,
        producedSource: result.modelSource ?? null,
        value: result.value,
      })
    return result
  })
