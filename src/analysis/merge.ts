import type { Observation } from "../domain/ChunkObservations.ts"

/** Observations above this many characters are merged in groups before the final reduce. */
export const REDUCE_INPUT_LIMIT = 100_000

/**
 * Quotes kept per observation. Quotes make up most of the merge / reduce input: keeping
 * all of them meant merging barely shrank it, and merge calls slow enough to time out.
 * The reduce step needs at least 2 per trait.
 */
export const MAX_EVIDENCE_PER_OBSERVATION = 4

/** A round that shrinks the observations by less than this is the last one. */
export const MIN_MERGE_SHRINK = 0.2

/** Merges aim at this share of the reduce input limit, leaving room for restored observations. */
export const MERGE_TARGET = 0.8

/**
 * How many observations a merge of `n` (out of `total` characters in the round) may return so
 * that the round lands at MERGE_TARGET of `limit`. Without a number the model merged only a
 * few near-duplicates and large histories did not fit. It is never below one observation per
 * MAX_EVIDENCE_PER_OBSERVATION inputs: every input keeps a quote, and a merged observation
 * holds at most that many, so nothing has to be dropped whole.
 */
export const mergeBudget = (n: number, total: number, limit: number): number =>
  Math.max(
    Math.ceil(n / MAX_EVIDENCE_PER_OBSERVATION),
    Math.min(n, Math.floor((n * limit * MERGE_TARGET) / total)),
  )

/** How observations are sent to the merge / reduce steps (also what the limit measures). */
export const observationsText = (obs: ReadonlyArray<Observation>): string =>
  JSON.stringify(
    obs.map((o) => ({ dimension: o.dimension, claim: o.claim, evidence: o.evidence })),
    null,
    0,
  )

/**
 * Split observations, in order, into groups of about `limit / 2` characters each (a single
 * larger observation forms its own group). Merging a group should roughly halve it.
 */
export const groupForMerge = (
  observations: ReadonlyArray<Observation>,
  limit: number,
): ReadonlyArray<ReadonlyArray<Observation>> => {
  const groups: Array<Array<Observation>> = [[]]
  let size = 0
  for (const o of observations) {
    const len = observationsText([o]).length
    if (size + len > limit / 2 && groups.at(-1)!.length > 0) {
      groups.push([])
      size = 0
    }
    groups.at(-1)!.push(o)
    size += len
  }
  return groups
}

/**
 * Keep at most `max` evidence items per observation, in their original order: one per
 * session first, then one per prompt (different conversations, then different prompts, are
 * stronger evidence), then repeats if room is left. A recurring pattern is not reduced to the
 * opening quotes of one long conversation.
 */
export const capEvidence = (
  observations: ReadonlyArray<Observation>,
  max: number = MAX_EVIDENCE_PER_OBSERVATION,
  sessionOf: (promptId: string) => string = (id) => id,
): ReadonlyArray<Observation> =>
  observations.map((o) => {
    if (o.evidence.length <= max) return o
    const firstOf = (key: (e: Observation["evidence"][number]) => string) => {
      const seen = new Set<string>()
      return o.evidence.map((e) => {
        const first = !seen.has(key(e))
        seen.add(key(e))
        return first
      })
    }
    const passes = [firstOf((e) => sessionOf(e.promptId)), firstOf((e) => e.promptId), null]
    const keep = new Set<number>()
    for (const pass of passes) {
      for (const i of o.evidence.keys()) {
        if (keep.size < max && (pass === null || pass[i])) keep.add(i)
      }
    }
    return { ...o, evidence: o.evidence.filter((_, i) => keep.has(i)) }
  })

/**
 * A cap or LLM merge must not silently erase a whole observation: when none of an
 * observation's quotes survive, restore it with its claim and context. A claim that keeps at
 * least one quote may lose its other quotes; restoring those too meant merging could not
 * shrink the input of a large history (every merge drops quotes). Contrary examples are kept
 * as their own observations by the map and merge prompts.
 */
export const retainOmittedEvidence = (
  original: ReadonlyArray<Observation>,
  merged: ReadonlyArray<Observation>,
): ReadonlyArray<Observation> => {
  const key = (e: Observation["evidence"][number]) => JSON.stringify([e.promptId, e.quote])
  const retained = new Set(merged.flatMap((o) => o.evidence.map(key)))
  return [...merged, ...original.filter((o) => o.evidence.every((e) => !retained.has(key(e))))]
}
