import { Schema } from "effect"
import { SourceId } from "./Source.ts"

/**
 * A cleaned and redacted prompt. `text` is exactly what is sent to the LLM, and what
 * evidence quotes are verified against. Never contains the raw text.
 */
export const SafePrompt = Schema.Struct({
  id: Schema.String,
  sessionId: Schema.String,
  source: SourceId,
  timestamp: Schema.DateTimeUtcFromString,
  /** Last path segment only, redacted. */
  project: Schema.NullOr(Schema.String),
  text: Schema.String,
})
export type SafePrompt = typeof SafePrompt.Type
