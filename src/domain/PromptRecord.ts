import { Schema } from "effect"
import { Origin, SourceId } from "./Source.ts"

/** The unified output of every source adapter: one prompt the user typed. */
export const PromptRecord = Schema.Struct({
  /** `${source}:${sessionId}:${uuid | ordinal}` — must be stable across runs. */
  id: Schema.String,
  source: SourceId,
  sessionId: Schema.String,
  timestamp: Schema.DateTimeUtcFromString,
  /** Full cwd path. Local use only; reduced to the last segment before reaching the LLM. */
  project: Schema.NullOr(Schema.String),
  gitBranch: Schema.NullOr(Schema.String),
  /** Raw text as typed by the user (not yet redacted). */
  text: Schema.String,
  hasImage: Schema.Boolean,
  origin: Origin,
  /** Raw client marker, e.g. Claude `entrypoint` or Codex `originator`. */
  client: Schema.NullOr(Schema.String),
})
export type PromptRecord = typeof PromptRecord.Type
