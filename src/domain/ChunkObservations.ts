import { Schema } from "effect"
import { Evidence, ObservationKey } from "./Profile.ts"

export const Observation = Schema.Struct({
  /** One of the five dimensions, or `prompting` (how the prompts could be better). */
  dimension: ObservationKey,
  claim: Schema.String,
  evidence: Schema.Array(Evidence),
})
export type Observation = typeof Observation.Type

/** Intermediate result of the map step (plan 07). */
export const ChunkObservations = Schema.Struct({
  chunkId: Schema.String,
  observations: Schema.Array(Observation),
})
export type ChunkObservations = typeof ChunkObservations.Type
