import { Schema } from "effect"
import { MAX_QUOTE_LENGTH } from "./quote.ts"
const Evidence = Schema.Struct({
  promptId: Schema.String,
  quote: Schema.String.check(Schema.isMaxLength(MAX_QUOTE_LENGTH)),
})
export const NarrativeClaim = Schema.Struct({
  text: Schema.String,
  evidence: Schema.Array(Evidence),
})
export const NarrativePlan = Schema.Struct({
  thread: NarrativeClaim,
  representativeEpisodeId: Schema.NullOr(Schema.String),
  chapters: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      focus: NarrativeClaim,
      episodeIds: Schema.Array(Schema.String),
      patternClaims: Schema.Array(Schema.String),
    }),
  ),
  nuance: NarrativeClaim,
  closing: NarrativeClaim,
})
export type NarrativePlan = typeof NarrativePlan.Type
