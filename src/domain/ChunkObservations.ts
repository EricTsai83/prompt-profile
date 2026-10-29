import { Effect, Schema } from "effect"
import { EndingKind, TaskType, TurnRole } from "./Episode.ts"
import { InterventionKind } from "./Steering.ts"
import { Evidence, ObservationKey } from "./Profile.ts"

export const Observation = Schema.Struct({
  /** One of the five dimensions, or `prompting` (how the prompts could be better). */
  dimension: ObservationKey,
  claim: Schema.String,
  evidence: Schema.Array(Evidence),
})
export type Observation = typeof Observation.Type

/** An episode as the map step proposed it: not verified yet (see `analysis/episodes.ts`). */
export const ChunkEpisode = Schema.Struct({
  session: Schema.String,
  taskType: TaskType,
  task: Schema.String,
  turns: Schema.Array(
    Schema.Struct({ promptId: Schema.String, quote: Schema.String, role: TurnRole }),
  ),
  ending: Schema.Struct({ kind: EndingKind, promptId: Schema.NullOr(Schema.String) }),
})
export type ChunkEpisode = typeof ChunkEpisode.Type

/** Intermediate result of the map step (plan 07); merges carry no episodes. */
export const ChunkObservations = Schema.Struct({
  chunkId: Schema.String,
  observations: Schema.Array(Observation),
  episodes: Schema.Array(ChunkEpisode).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  /** Follow-up prompts the map step labelled as steering or repairs (not verified yet). */
  interventions: Schema.Array(
    Schema.Struct({ promptId: Schema.String, kind: InterventionKind, quote: Schema.String }),
  ).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
})
export type ChunkObservations = typeof ChunkObservations.Type
