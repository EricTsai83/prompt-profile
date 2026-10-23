import { createHash } from "node:crypto"
import { Effect } from "effect"
import { decodeValue } from "./common.ts"
import {
  DISPLAY_NAMES,
  InvalidOutput,
  type GenerateInput,
  type LlmError,
  type LlmRunnerShape,
  type RunnerId,
} from "./LlmRunner.ts"

export const fakeHash = (system: string, prompt: string): string =>
  createHash("sha256").update(system).update("\u0000").update(prompt).digest("hex").slice(0, 16)

export interface FakeOptions {
  readonly id?: RunnerId
  /** Responses keyed by `fakeHash(system, prompt)`. */
  readonly responses?: Readonly<Record<string, unknown>>
  /** Used when no hash matches (tests that generate responses from the input). */
  readonly respond?: (input: { system: string; prompt: string; schemaName: string }) => unknown
  /** Call number (1-based) → error to return, or "hang" to never complete. */
  readonly failures?: ReadonlyMap<number, LlmError | "hang">
  readonly model?: string | null
}

export interface FakeLlmRunner extends LlmRunnerShape {
  readonly calls: () => number
  readonly log: ReadonlyArray<{
    readonly system: string
    readonly prompt: string
    readonly schema: string
  }>
}

export const makeFakeLlmRunner = (options: FakeOptions = {}): FakeLlmRunner => {
  const id = options.id ?? "claude-code"
  const log: Array<{ system: string; prompt: string; schema: string }> = []
  const generate = <A>(input: GenerateInput<A>) =>
    Effect.suspend(() => {
      log.push({ system: input.system, prompt: input.prompt, schema: input.schema.name })
      const failure = options.failures?.get(log.length)
      if (failure === "hang") return Effect.never
      if (failure !== undefined) return Effect.fail(failure)
      const hash = fakeHash(input.system, input.prompt)
      const raw =
        options.responses?.[hash] ??
        options.respond?.({
          system: input.system,
          prompt: input.prompt,
          schemaName: input.schema.name,
        })
      if (raw === undefined) {
        return Effect.fail(
          new InvalidOutput({ runner: id, detail: `FakeLlmRunner: no response for hash ${hash}` }),
        )
      }
      return decodeValue(id, input.schema, raw).pipe(
        Effect.map((value) => ({
          value,
          model: options.model ?? "fake-model",
          usage: { inputTokens: null, outputTokens: null, costUsd: null },
          durationMs: 0,
        })),
      )
    })
  return { id, displayName: DISPLAY_NAMES[id], generate, calls: () => log.length, log }
}
