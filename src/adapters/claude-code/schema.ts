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
  attachment: Schema.optional(Schema.Unknown),
  message: Schema.optional(
    Schema.Struct({
      content: Schema.optional(Schema.Unknown),
      model: Schema.optional(Schema.Unknown),
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

/**
 * The parts of an assistant line usage needs, read straight from the parsed JSON: decoding
 * them through `ClaudeLine` slowed down reading every line (plan 23).
 */
export interface ClaudeResponse {
  readonly id: unknown
  readonly requestId: unknown
  readonly usage: unknown
}

export const responseOf = (value: unknown): ClaudeResponse => {
  const line = value as { requestId?: unknown; message?: { id?: unknown; usage?: unknown } }
  return { id: line.message?.id, requestId: line.requestId, usage: line.message?.usage }
}

const count = (x: unknown): number | null =>
  x === undefined || x === null
    ? 0
    : Number.isSafeInteger(x) && (x as number) >= 0
      ? (x as number)
      : null

/** `message.usage` as counts; null when a present count is not a count. */
export const usageCounts = (
  usage: unknown,
): {
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
  cache5m: number
  cache1h: number
} | null => {
  if (typeof usage !== "object" || usage === null) return null
  const u = usage as Record<string, unknown>
  const split = (
    typeof u["cache_creation"] === "object" && u["cache_creation"] !== null
      ? u["cache_creation"]
      : {}
  ) as Record<string, unknown>
  const values = [
    count(u["input_tokens"]),
    count(u["output_tokens"]),
    count(u["cache_read_input_tokens"]),
    count(u["cache_creation_input_tokens"]),
    count(split["ephemeral_5m_input_tokens"]),
    count(split["ephemeral_1h_input_tokens"]),
  ]
  if (values.some((v) => v === null)) return null
  const [input, output, cacheRead, cacheCreation, cache5m, cache1h] = values as Array<number>
  return {
    input: input!,
    output: output!,
    cacheRead: cacheRead!,
    cacheCreation: cacheCreation!,
    cache5m: cache5m!,
    cache1h: cache1h!,
  }
}
