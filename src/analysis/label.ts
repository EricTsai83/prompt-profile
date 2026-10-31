import { Effect, Ref } from "effect"
import { LlmTraitLabels, type TraitFrequency } from "../domain/index.ts"
import { LlmRunner, makeLlmSchema, type LlmError } from "../llm/index.ts"
import type { Chunk } from "./chunk.ts"
import { FATAL } from "./errors.ts"
import { DEFAULT_CONCURRENCY, type AnalyzeOptions } from "./plan.ts"
import { loadPrompt } from "./prompts.ts"
import { matchQuote } from "./verify.ts"

const LABELS_SCHEMA = makeLlmSchema("LlmTraitLabels", LlmTraitLabels)

/** Errors after which no new chunk is labelled, without failing the analysis. */
const STOPS_LABELLING: ReadonlySet<LlmError["_tag"]> = new Set([
  "RateLimited",
  "CallBudgetExceeded",
  "CostBudgetExceeded",
])

type Labels = LlmTraitLabels["labels"]

export interface LabelOutcome {
  readonly chunk: Chunk
  /** null when the chunk could not be labelled. */
  readonly labels: Labels | null
}

export interface TraitMeasurement {
  /** One per trait, in trait order; null when no chunk was labelled. */
  readonly frequencies: ReadonlyArray<TraitFrequency | null>
  readonly chunksLabelled: number
  readonly chunksFailed: number
  /** Labels on an unknown prompt or trait, misquotes. */
  readonly rejected: number
}

const nameKey = (name: string) => name.trim().toLowerCase()

/**
 * How many analysed conversations show each trait, overall and per project, from the labels of
 * every chunk that was labelled. A label must cite a prompt of its chunk with a verbatim quote
 * and name a listed trait. The denominator is the conversations of the labelled chunks, so a
 * trait no label names is measured as zero.
 */
export const measureTraitFrequency = (
  outcomes: ReadonlyArray<LabelOutcome>,
  traits: ReadonlyArray<string>,
): TraitMeasurement => {
  const index = new Map(traits.map((t, i) => [nameKey(t), i]))
  const analysed = new Set<string>()
  const analysedByProject = new Map<string, Set<string>>()
  const shown = traits.map(() => new Set<string>())
  const shownByProject = traits.map(() => new Map<string, Set<string>>())
  const add = (map: Map<string, Set<string>>, key: string, value: string) =>
    map.set(key, (map.get(key) ?? new Set()).add(value))
  let rejected = 0
  let labelled = 0
  for (const { chunk, labels } of outcomes) {
    if (labels === null) continue
    labelled++
    const prompts = new Map(chunk.prompts.map((p) => [p.id, p]))
    for (const p of chunk.prompts) {
      const session = chunk.positions.get(p.id)!.session
      analysed.add(session)
      if (p.project) add(analysedByProject, p.project, session)
    }
    for (const label of labels) {
      const prompt = prompts.get(label.promptId)
      const trait = index.get(nameKey(label.trait))
      if (!prompt || trait === undefined || matchQuote(label.quote, prompt.text) === null) {
        rejected++
        continue
      }
      const session = chunk.positions.get(prompt.id)!.session
      shown[trait]!.add(session)
      if (prompt.project) add(shownByProject[trait]!, prompt.project, session)
    }
  }
  return {
    frequencies: traits.map((_, i) =>
      labelled === 0
        ? null
        : {
            sessions: shown[i]!.size,
            analysedSessions: analysed.size,
            byProject: [...analysedByProject].map(([project, sessions]) => ({
              project,
              sessions: shownByProject[i]!.get(project)?.size ?? 0,
              analysedSessions: sessions.size,
            })),
          },
    ),
    chunksLabelled: labelled,
    chunksFailed: outcomes.length - labelled,
    rejected,
  }
}

/** The trait list the labelling prompt receives. */
const traitList = (
  traits: ReadonlyArray<{ readonly name: string; readonly description: string }>,
) => JSON.stringify(traits.map((t) => ({ name: t.name, description: t.description })))

/**
 * The labelling pass: one call per analysed chunk, asking which prompts show each verified
 * trait. It only enriches a finished profile, so a rate limit or a spent call / cost budget
 * stops sending new chunks and keeps what was labelled; a login, install or interruption
 * error still stops everything; any other failure leaves that chunk unlabelled. Not cached:
 * the trait list differs from run to run.
 */
export const labelTraits = (
  chunks: ReadonlyArray<Chunk>,
  traits: ReadonlyArray<{ readonly name: string; readonly description: string }>,
  options: AnalyzeOptions,
): Effect.Effect<ReadonlyArray<LabelOutcome>, LlmError, LlmRunner> =>
  Effect.gen(function* () {
    if (traits.length === 0) return []
    const runner = yield* LlmRunner
    const system = `${loadPrompt("label")}\n\ntraits:\n${traitList(traits)}`
    const stopped = yield* Ref.make(false)
    return yield* Effect.forEach(
      chunks,
      (chunk) =>
        Effect.gen(function* () {
          if (yield* Ref.get(stopped)) return { chunk, labels: null }
          const result = yield* runner
            .generate({ stage: "label", system, prompt: chunk.text, schema: LABELS_SCHEMA })
            .pipe(Effect.result)
          if (result._tag === "Success") return { chunk, labels: result.success.value.labels }
          const error = result.failure
          if (STOPS_LABELLING.has(error._tag)) yield* Ref.set(stopped, true)
          else if (FATAL.has(error._tag)) return yield* Effect.fail(error)
          return { chunk, labels: null }
        }),
      { concurrency: options.concurrency ?? DEFAULT_CONCURRENCY },
    )
  })
