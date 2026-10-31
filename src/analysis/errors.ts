import { Data } from "effect"
import type { LlmError } from "../llm/index.ts"

/** Analysis could not produce a profile (other than a fatal LlmError). */
export class AnalysisFailed extends Data.TaggedError("AnalysisFailed")<{
  readonly reason:
    | "no-prompts"
    | "too-many-chunk-failures"
    /** An intermediate merge failed (before the final profile call). */
    | "merge-failed"
    | "reduce-failed"
    | "input-too-large"
  readonly chunksFailed: number
  readonly chunksTotal: number
  /** The underlying LLM error when there was one (for --verbose). */
  readonly cause?: LlmError | undefined
}> {}

/** No requested output language survived bounded translation attempts. */
export class TranslationFailed extends Data.TaggedError("TranslationFailed")<{
  readonly language: string
}> {}

export type AnalyzeError = AnalysisFailed | TranslationFailed | LlmError

/** LLM errors that will not succeed on a retry: stop everything immediately. */
export const FATAL: ReadonlySet<LlmError["_tag"]> = new Set([
  "NotInstalled",
  "NotLoggedIn",
  "Interrupted",
  "CallBudgetExceeded",
  "CostBudgetExceeded",
  "AccountingUnavailable",
])

/** Fatal errors stop everything as-is; anything else means the `reason` stage failed. */
export const stageError =
  (reason: "merge-failed" | "reduce-failed", chunksFailed: number, chunksTotal: number) =>
  (cause: LlmError): AnalyzeError =>
    FATAL.has(cause._tag) ? cause : new AnalysisFailed({ reason, chunksFailed, chunksTotal, cause })
