import type { Observation } from "../domain/ChunkObservations.ts"

/** Observations above this many characters are merged in groups before the final reduce. */
export const REDUCE_INPUT_LIMIT = 100_000

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
