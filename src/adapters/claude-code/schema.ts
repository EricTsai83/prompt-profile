import { Schema } from "effect"

/** Lenient view of a `projects/<project>/<session>.jsonl` line: only fields we use; all optional. */
export const ClaudeLine = Schema.Struct({
  type: Schema.optional(Schema.Unknown),
  uuid: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
  timestamp: Schema.optional(Schema.String),
  cwd: Schema.optional(Schema.NullOr(Schema.String)),
  gitBranch: Schema.optional(Schema.NullOr(Schema.String)),
  isSidechain: Schema.optional(Schema.Unknown),
  isMeta: Schema.optional(Schema.Unknown),
  isCompactSummary: Schema.optional(Schema.Unknown),
  entrypoint: Schema.optional(Schema.NullOr(Schema.String)),
  promptSource: Schema.optional(Schema.Unknown),
  turnOrigin: Schema.optional(Schema.Unknown),
  origin: Schema.optional(Schema.Unknown),
  permissionMode: Schema.optional(Schema.Unknown),
  prUrl: Schema.optional(Schema.Unknown),
  message: Schema.optional(
    Schema.Struct({
      content: Schema.optional(Schema.Unknown),
    }),
  ),
})
export type ClaudeLine = typeof ClaudeLine.Type

/** `history.jsonl` entry. `timestamp` is epoch milliseconds. */
export const HistoryLine = Schema.Struct({
  display: Schema.String,
  pastedContents: Schema.optional(Schema.Unknown),
  timestamp: Schema.Number,
  project: Schema.optional(Schema.NullOr(Schema.String)),
  sessionId: Schema.optional(Schema.String),
})
export type HistoryLine = typeof HistoryLine.Type
