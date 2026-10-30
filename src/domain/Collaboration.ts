import { Schema } from "effect"
import { MAX_QUOTE_LENGTH } from "./quote.ts"

export const UNDERSTANDING_KINDS = [
  "context",
  "uncertainty",
  "tool_boundaries",
  "verification",
  "recovery",
] as const
export const SIGNAL_BASES = [
  "user_request",
  "user_report",
  "agent_action",
  "tool_question",
] as const
const Quote = Schema.Struct({
  promptId: Schema.String,
  quote: Schema.String.check(Schema.isMaxLength(MAX_QUOTE_LENGTH)),
})
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Spread = Schema.Struct({ sessions: Count, weeks: Count })
/** A user-reported effect, not an inferred consequence of a requested technique. */
export const ReportedEffect = Schema.Struct({ claim: Schema.String, evidence: Schema.Array(Quote) })
export type ReportedEffect = typeof ReportedEffect.Type
export const SignatureMove = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  episodeIds: Schema.Array(Schema.String),
  benefit: Schema.NullOr(ReportedEffect),
  cost: Schema.NullOr(ReportedEffect),
  support: Spread,
})
export type SignatureMove = typeof SignatureMove.Type
export const UnderstandingSignal = Schema.Struct({
  kind: Schema.Literals(UNDERSTANDING_KINDS),
  basis: Schema.Literals(["user_request", "user_report"]),
  observation: Schema.String,
  context: Schema.String,
  evidence: Schema.Array(Quote),
  support: Spread,
})
export type UnderstandingSignal = typeof UnderstandingSignal.Type
export const Collaboration = Schema.Struct({
  moves: Schema.Array(SignatureMove),
  signals: Schema.Array(UnderstandingSignal),
  rejected: Schema.Struct({ moves: Count, signals: Count, effects: Count }),
})
export type Collaboration = typeof Collaboration.Type
const EffectText = Schema.NullOr(Schema.Struct({ claim: Schema.String }))
export const CollaborationText = Schema.Struct({
  moves: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      description: Schema.String,
      benefit: EffectText,
      cost: EffectText,
    }),
  ),
  signals: Schema.Array(Schema.Struct({ observation: Schema.String, context: Schema.String })),
})
