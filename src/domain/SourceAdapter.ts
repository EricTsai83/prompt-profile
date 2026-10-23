import type { Effect } from "effect"
import type { PromptRecord } from "./PromptRecord.ts"
import type { SourceId } from "./Source.ts"

export interface AdapterDiagnostics {
  readonly filesRead: number
  /** Files that could not be read, or failed part-way (their remaining lines are lost). */
  readonly unreadableFiles: number
  /** Lines that failed to parse as JSON or failed the (lenient) input schema. */
  readonly badLines: number
  /** Number of records excluded, keyed by filter rule name. */
  readonly excluded: Readonly<Record<string, number>>
  /** Slash command usage counts (e.g. `/clear`), collected outside PromptRecord. */
  readonly slashCommands: Readonly<Record<string, number>>
}

/** One read of a source: its records (unsorted) and what happened while reading them. */
export interface SourceRead {
  readonly records: ReadonlyArray<PromptRecord>
  readonly diagnostics: AdapterDiagnostics
}

export interface SourceAdapter {
  readonly id: SourceId
  readonly displayName: string
  /** Paths this adapter looks at (shown in "no data found" errors). */
  readonly locations: ReadonlyArray<string>
  /**
   * Missing data → no records; bad data → skipped and counted in this read's diagnostics.
   * Every run is independent (reads may run concurrently).
   */
  readonly read: Effect.Effect<SourceRead>
}
