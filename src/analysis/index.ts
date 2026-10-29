import { verifyPortrait } from "./portrait.ts"
import { roleCode, ROLE_NAMES } from "../domain/Interaction.ts"
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
import { addTranslations } from "./translate.ts"
import {
  capEvidence,
  retainOmittedEvidence,
  groupForMerge,
  MIN_MERGE_SHRINK,
  observationsText,
  REDUCE_INPUT_LIMIT,
} from "./merge.ts"
import { DEFAULT_CONCURRENCY, keyParts, selectChunks, type AnalyzeOptions } from "./plan.ts"
import { loadPrompt } from "./prompts.ts"
import {
  verifyDimensions,
  verifyImprovements,
  verifyObservations,
  verifyTraits,
  type EvidenceCounts,
} from "./verify.ts"
import { ANALYSIS_VERSION } from "./version.ts"

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
const FATAL: ReadonlySet<LlmError["_tag"]> = new Set([
  "NotInstalled",
  "NotLoggedIn",
  "Interrupted",
  "CallBudgetExceeded",
])

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
    const mapSystem = loadPrompt("map")
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
      o.observations === null
        ? []
        : [
            verifyObservations(
              o.observations,
              new Map(o.chunk.prompts.map((p) => [p.id, p.text])),
              mapCounts,
            ),
          ],
    )
    const originalObservations = verified.flatMap((v) => v.observations)
    let observations: ReadonlyArray<Observation> = retainOmittedEvidence(
      originalObservations,
      capEvidence(originalObservations),
    )

    // ---- intermediate merges when the reduce input is too large -----------------------
    /** Fatal errors stop everything as-is; anything else means that stage failed. */
    const stageError =
      (reason: "merge-failed" | "reduce-failed") =>
      (cause: LlmError): AnalyzeError =>
        FATAL.has(cause._tag)
          ? cause
          : new AnalysisFailed({ reason, chunksFailed: failed.length, chunksTotal: total, cause })
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
                system: loadPrompt("merge"),
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
        const merged = verifyObservations(value, texts).observations
        return retainOmittedEvidence(group, retainOmittedEvidence(merged, capEvidence(merged)))
      })
    for (let round = 0; round < 3; round++) {
      const before = observationsText(observations).length
      if (before <= limit) break
      const groups = groupForMerge(observations, limit)
      yield* progress.onMergeStart(groups.length)
      const merged = yield* Effect.forEach(groups, merge, {
        concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
      }).pipe(Effect.mapError(stageError("merge-failed")))
      observations = merged.flat()
      // another round would not get much smaller either
      if (observationsText(observations).length > before * (1 - MIN_MERGE_SHRINK)) break
    }

    if (observationsText(observations).length > limit) {
      return yield* new AnalysisFailed({
        reason: "input-too-large",
        chunksFailed: failed.length,
        chunksTotal: total,
      })
    }

    // ---- reduce ---------------------------------------------------------------------
    yield* progress.onReduceStart
    const citedIds = new Set(observations.flatMap((o) => o.evidence.map((e) => e.promptId)))
    const promptContext = outcomes
      .filter((o) => o.observations !== null)
      .flatMap((o) =>
        o.chunk.prompts
          .filter((p) => citedIds.has(p.id))
          .map((p) => ({
            promptId: p.id,
            session: `${p.source}:${p.sessionId}`,
            time: p.timestamp.toString(),
          })),
      )
    const reducePrompt = `promptContext:\n${JSON.stringify(promptContext)}\n\nobservations:\n${observationsText(observations)}\n\nstats:\n${JSON.stringify(statsForReduce(input.stats))}`
    const draft = yield* runner
      .generate({
        system: loadPrompt("reduce"),
        prompt: reducePrompt,
        schema: DRAFT_SCHEMA,
      })
      .pipe(Effect.mapError(stageError("reduce-failed")))
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
    const origins = new Map(
      outcomes
        .filter((o) => o.observations !== null)
        .flatMap((o) =>
          o.chunk.prompts.map(
            (p) => [p.id, { session: `${p.source}:${p.sessionId}`, week: o.chunk.id }] as const,
          ),
        ),
    )
    const finalTexts = new Map(analyzedPrompts.map((p) => [p.id, p.text]))
    const portrait = verifyPortrait(profile.portrait, finalTexts, origins, counts)
    const code = portrait ? roleCode(portrait.axes) : null
    const traits = verifyTraits(
      profile.traits,
      finalTexts,
      counts,
      new Map(
        outcomes.flatMap((o) =>
          o.chunk.prompts.map((p) => [
            p.id,
            { session: `${p.source}:${p.sessionId}`, week: o.chunk.id },
          ]),
        ),
      ),
    )
    const dimensions = verifyDimensions(profile.dimensions, finalTexts, counts)
    const improvements = verifyImprovements(profile.improvements, finalTexts, counts)
    yield* progress.onVerified(counts.kept, counts.dropped)
    const summariesUnsafe =
      counts.dropped > 0 ||
      !(
        portrait ||
        traits.length ||
        improvements.length ||
        dimensions.some((d) => d.evidence.length)
      )
    const verifiedProfile: Profile = {
      ...profile,
      // Global summaries have no direct citations: conservatively reset them after rejection.
      headline: summariesUnsafe ? "Collaboration observations" : profile.headline,
      portrait: summariesUnsafe ? null : portrait,
      archetype: summariesUnsafe
        ? { name: "Collaboration observations", description: "" }
        : portrait
          ? { ...profile.archetype, name: code ? ROLE_NAMES[code]! : "Collaboration Portrait" }
          : profile.archetype,
      traits,
      dimensions,
      improvements,
      coverage: { ...profile.coverage, evidenceKept: counts.kept, evidenceDropped: counts.dropped },
    }
    // ---- translate (verified text only) ---------------------------------------------
    return yield* addTranslations(verifiedProfile, options.languages ?? ["en"])
  })
