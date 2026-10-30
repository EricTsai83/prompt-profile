import { Schema } from "effect"
const Position = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))
export const EvidenceOrigin = Schema.Struct({
  promptId: Schema.String,
  session: Schema.String,
  time: Schema.DateTimeUtcFromString,
  turn: Position,
  of: Position,
}).check(Schema.makeFilter((o) => o.turn <= o.of))
export type EvidenceOrigin = typeof EvidenceOrigin.Type
