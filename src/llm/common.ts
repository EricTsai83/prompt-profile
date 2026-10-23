import { Duration, Effect, FileSystem, Schema } from "effect"
import type { Scope } from "effect"
import {
  ANALYSIS_MARKER,
  InvalidOutput,
  Timeout,
  type LlmSchema,
  type RunnerId,
} from "./LlmRunner.ts"

export const DEFAULT_TIMEOUT: Duration.Input = "5 minutes"

export interface RunnerOptions {
  readonly model?: string | undefined
  readonly timeout?: Duration.Input | undefined
}

/** Prefix the analysis marker so adapters skip this prompt if it ever lands in history. */
export const withMarker = (text: string): string => `${ANALYSIS_MARKER}\n${text}`

/** A fresh empty working directory per call, deleted when the scope closes. */
export const scopedWorkdir: Effect.Effect<string, never, FileSystem.FileSystem | Scope.Scope> =
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    return yield* fs.makeTempDirectoryScoped({ prefix: "prompt-profile-" }).pipe(Effect.orDie)
  })

/** Final authority: the CLI followed the JSON Schema, but we always decode again. */
export const decodeValue = <A>(
  runner: RunnerId,
  schema: LlmSchema<A>,
  value: unknown,
): Effect.Effect<A, InvalidOutput> =>
  Schema.decodeUnknownEffect(schema.schema)(value).pipe(
    Effect.mapError(
      (e) => new InvalidOutput({ runner, detail: `${schema.name}: ${e.message}`.slice(0, 2000) }),
    ),
  )

export const parseJson = (runner: RunnerId, text: string): Effect.Effect<unknown, InvalidOutput> =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: () => new InvalidOutput({ runner, detail: "output is not valid JSON" }),
  })

export const withTimeout =
  (runner: RunnerId, timeout: Duration.Input) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E | Timeout, R> =>
    Effect.timeoutOrElse(self, {
      duration: timeout,
      orElse: () =>
        Effect.fail(
          new Timeout({ runner, afterMs: Duration.toMillis(Duration.fromInputUnsafe(timeout)) }),
        ),
    })

export const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}
