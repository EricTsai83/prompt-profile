import { Schema } from "effect"
import { MAX_QUOTE_LENGTH } from "./quote.ts"

/**
 * How the person steers the AI, measured per conversation (replaces "1 in N prompts corrects
 * the AI" when present). Only follow-up prompts can steer or repair, so the denominator is the
 * conversations that have follow-ups: one-shot and chatty styles stay comparable.
 */

/**
 * `steer`: overrides or changes the AI's approach or decision ("keep the old API, don't add an
 * endpoint"). `repair`: asks the AI to fix a result that is wrong or broken ("still failing").
 */
export const INTERVENTION_KINDS = ["steer", "repair"] as const
export const InterventionKind = Schema.Literals(INTERVENTION_KINDS)
export type InterventionKind = typeof InterventionKind.Type

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

const Example = Schema.Struct({
  promptId: Schema.String,
  quote: Schema.String.check(Schema.isMaxLength(MAX_QUOTE_LENGTH)),
})

const Kind = Schema.Struct({
  /** Conversations with at least one such prompt. */
  conversations: Count,
  prompts: Count,
  /** Verified quotes, from different conversations where possible. */
  examples: Schema.Array(Example),
})

export const Steering = Schema.Struct({
  /** Conversations with a prompt in the analysed chunks (a sample of the history). */
  conversations: Count,
  /** Of those, conversations with at least one analysed follow-up prompt (not the first turn). */
  withFollowUps: Count,
  followUpPrompts: Count,
  steer: Kind,
  repair: Kind,
  /** Labels the model gave a first prompt, an unknown prompt or a misquote. */
  rejected: Count,
})
export type Steering = typeof Steering.Type
