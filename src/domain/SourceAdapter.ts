import type { Effect, Stream } from "effect"
import type { PromptRecord } from "./PromptRecord.ts"
import type { SourceId } from "./Source.ts"

export interface AdapterDiagnostics {
  readonly filesRead: number
  /** Lines that failed to parse as JSON or failed the (lenient) input schema. */
  readonly badLines: number
  /** Number of records excluded, keyed by filter rule name. */
  readonly excluded: Readonly<Record<string, number>>
  /** Slash command usage counts (e.g. `/clear`), collected outside PromptRecord. */
  readonly slashCommands: Readonly<Record<string, number>>
}

export const emptyDiagnostics = (): AdapterDiagnostics => ({
  filesRead: 0,
  badLines: 0,
  excluded: {},
  slashCommands: {},
})

export interface SourceAdapter {
  readonly id: SourceId
  readonly displayName: string
  /** Paths this adapter looks at (shown in "no data found" errors). */
  readonly locations: Effect.Effect<ReadonlyArray<string>>
  /** Missing data → empty stream; bad data → skipped and counted. */
  readonly read: Stream.Stream<PromptRecord>
  /** Diagnostics of the most recent `read`. */
  readonly diagnostics: Effect.Effect<AdapterDiagnostics>
}
