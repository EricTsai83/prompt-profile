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
 * prompt first (different prompts are stronger evidence), then repeats if room is left.
 */
export const capEvidence = (
  observations: ReadonlyArray<Observation>,
  max: number = MAX_EVIDENCE_PER_OBSERVATION,
): ReadonlyArray<Observation> =>
  observations.map((o) => {
    if (o.evidence.length <= max) return o
    const seen = new Set<string>()
    const firstPerPrompt = o.evidence.map((e) => {
      const first = !seen.has(e.promptId)
      seen.add(e.promptId)
      return first
    })
    const keep = new Set<number>()
    for (const pass of [true, false]) {
      for (const [i, isFirst] of firstPerPrompt.entries()) {
        if (keep.size < max && (isFirst || !pass)) keep.add(i)
      }
    }
    return { ...o, evidence: o.evidence.filter((_, i) => keep.has(i)) }
  })

/** A cap/LLM merge must not silently erase a counterexample or its source context.
 * Quote validity does not tell us which quotes are contrary, so restore the full source
 * observation whenever any of its quotes disappears. Oversized inputs fail explicitly.
 */
export const retainOmittedEvidence = (
  original: ReadonlyArray<Observation>,
  merged: ReadonlyArray<Observation>,
): ReadonlyArray<Observation> => {
  const key = (e: Observation["evidence"][number]) => JSON.stringify([e.promptId, e.quote])
  const retained = new Set(merged.flatMap((o) => o.evidence.map(key)))
  return [...merged, ...original.filter((o) => o.evidence.some((e) => !retained.has(key(e))))]
}
