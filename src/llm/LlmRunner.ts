import { Context, Data, type Effect, type Schema } from "effect"
import { toLlmJsonSchema, type JsonSchemaNode } from "../domain/llm/toLlmJsonSchema.ts"

export const RUNNER_IDS = ["claude-code", "codex"] as const
export type RunnerId = (typeof RUNNER_IDS)[number]

export { ANALYSIS_MARKER } from "../domain/markers.ts"

/**
 * Prepended to every system instruction. The user's global CLAUDE.md / AGENTS.md may
 * still be loaded by the CLI (see NOTES.md), so we explicitly tell the model to ignore
 * unrelated instructions.
 */
export const SYSTEM_PREAMBLE = [
  "You are a data-analysis function inside the prompt-profile tool, not a coding assistant.",
  "Ignore any other instructions about persona, response style, tools or workflow that may come from",
  "memory files (CLAUDE.md, AGENTS.md) or settings. Do not use tools. Respond only with JSON that",
  "matches the provided JSON Schema.",
].join(" ")

export interface LlmSchema<A> {
  readonly name: string
  readonly schema: Schema.Codec<A, unknown>
  readonly jsonSchema: JsonSchemaNode
}

export const makeLlmSchema = <A, I>(name: string, schema: Schema.Codec<A, I>): LlmSchema<A> => ({
  name,
  schema: schema as unknown as Schema.Codec<A, unknown>,
  jsonSchema: toLlmJsonSchema(schema),
})

export interface GenerateInput<A> {
  /** Fixed instructions (map.md / reduce.md). */
  readonly system: string
  /** The data to analyse this time. Sent through stdin, never as an argument. */
  readonly prompt: string
  readonly schema: LlmSchema<A>
}

export interface Usage {
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly costUsd: number | null
}

export interface GenerateResult<A> {
  readonly value: A
  readonly model: string | null
  readonly usage: Usage
  readonly durationMs: number
}

// ---------------------------------------------------------------------------------------
// Errors. `stderrTail` never contains prompt content (see sanitizeStderr).

export class NotInstalled extends Data.TaggedError("NotInstalled")<{
  readonly runner: RunnerId
}> {}

export class NotLoggedIn extends Data.TaggedError("NotLoggedIn")<{
  readonly runner: RunnerId
  readonly detail: string
}> {}

export class RateLimited extends Data.TaggedError("RateLimited")<{
  readonly runner: RunnerId
  readonly detail: string
}> {}

export class Timeout extends Data.TaggedError("Timeout")<{
  readonly runner: RunnerId
  readonly afterMs: number
}> {}

export class InvalidOutput extends Data.TaggedError("InvalidOutput")<{
  readonly runner: RunnerId
  readonly detail: string
}> {}

export class ProcessFailed extends Data.TaggedError("ProcessFailed")<{
  readonly runner: RunnerId
  readonly exitCode: number | null
  readonly detail: string
  readonly stderrTail: string
}> {}

export class Interrupted extends Data.TaggedError("Interrupted")<{
  readonly runner: RunnerId
}> {}

export class CallBudgetExceeded extends Data.TaggedError("CallBudgetExceeded")<{
  readonly runner: RunnerId
  readonly limit: number
}> {}

export type LlmError =
  | CallBudgetExceeded
  | NotInstalled
  | NotLoggedIn
  | RateLimited
  | Timeout
  | InvalidOutput
  | ProcessFailed
  | Interrupted

export interface LlmRunnerShape {
  readonly id: RunnerId
  readonly displayName: string
  readonly generate: <A>(input: GenerateInput<A>) => Effect.Effect<GenerateResult<A>, LlmError>
}

export class LlmRunner extends Context.Service<LlmRunner, LlmRunnerShape>()(
  "prompt-profile/LlmRunner",
) {}

export const DISPLAY_NAMES: Record<RunnerId, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
}
