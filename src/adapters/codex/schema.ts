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

const Tokens = Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)))

/**
 * `total_token_usage` / `last_token_usage` of a `token_count` event. Input and output are
 * required: an empty or partial running total would reset the baseline the next delta is
 * taken from, and count everything before it again.
 */
export const CodexTokenUsage = Schema.Struct({
  input_tokens: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  cached_input_tokens: Tokens,
  cache_write_input_tokens: Tokens,
  output_tokens: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  reasoning_output_tokens: Tokens,
})
export type CodexTokenUsage = typeof CodexTokenUsage.Type

/** `event_msg` payload `{ type: "token_count", info }`; `info` is null before the first response. */
export const TokenCountInfo = Schema.Struct({
  total_token_usage: Schema.optional(CodexTokenUsage),
  last_token_usage: Schema.optional(CodexTokenUsage),
})
