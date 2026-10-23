import { Schema } from "effect"

/** Outer envelope of every rollout line. */
export const RolloutLine = Schema.Struct({
  timestamp: Schema.optional(Schema.String),
  ordinal: Schema.optional(Schema.Number),
  type: Schema.optional(Schema.Unknown),
  payload: Schema.optional(Schema.Unknown),
})

export const SessionMeta = Schema.Struct({
  id: Schema.optional(Schema.String),
  session_id: Schema.optional(Schema.String),
  cwd: Schema.optional(Schema.NullOr(Schema.String)),
  originator: Schema.optional(Schema.NullOr(Schema.String)),
  source: Schema.optional(Schema.Unknown),
  git: Schema.optional(
    Schema.NullOr(Schema.Struct({ branch: Schema.optional(Schema.NullOr(Schema.String)) })),
  ),
})
export type SessionMeta = typeof SessionMeta.Type

export const UserMessage = Schema.Struct({
  type: Schema.Literal("message"),
  role: Schema.Literal("user"),
  content: Schema.Array(
    Schema.Struct({ type: Schema.String, text: Schema.optional(Schema.String) }),
  ),
})
export type UserMessage = typeof UserMessage.Type

/** `history.jsonl`: `ts` is epoch **seconds**. */
export const CodexHistoryLine = Schema.Struct({
  session_id: Schema.String,
  ts: Schema.Number,
  text: Schema.String,
})
