import { Context, Effect, Layer } from "effect"

export interface ProgressShape {
  readonly onChunkStart: (index: number, total: number) => Effect.Effect<void>
  readonly onChunkDone: (info: {
    readonly index: number
    readonly total: number
    readonly fromCache: boolean
    readonly failed: boolean
    readonly durationMs: number | null
  }) => Effect.Effect<void>
  readonly onMergeStart: (groups: number) => Effect.Effect<void>
  readonly onReduceStart: Effect.Effect<void>
  readonly onReduceDone: (durationMs: number) => Effect.Effect<void>
  readonly onVerified: (kept: number, dropped: number) => Effect.Effect<void>
}

/** Progress reporting (the CLI renders a progress bar; tests record calls). */
export class Progress extends Context.Service<Progress, ProgressShape>()(
  "prompt-profile/Progress",
) {}

export const silentProgress: ProgressShape = {
  onChunkStart: () => Effect.void,
  onChunkDone: () => Effect.void,
  onMergeStart: () => Effect.void,
  onReduceStart: Effect.void,
  onReduceDone: () => Effect.void,
  onVerified: () => Effect.void,
}

export const silentProgressLayer = Layer.succeed(Progress, silentProgress)
