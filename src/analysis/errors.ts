import { Data } from "effect"
import type { LlmError } from "../llm/LlmRunner.ts"

/** Analysis could not produce a profile (other than a fatal LlmError). */
export class AnalysisFailed extends Data.TaggedError("AnalysisFailed")<{
  readonly reason: "no-prompts" | "too-many-chunk-failures" | "reduce-failed"
  readonly chunksFailed: number
  readonly chunksTotal: number
  /** The underlying LLM error when there was one (for --verbose). */
  readonly cause?: LlmError | undefined
}> {}

export type AnalyzeError = AnalysisFailed | LlmError
