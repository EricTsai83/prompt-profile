import { DateTime, Effect, Stream } from "effect"
import type { PromptRecord } from "../../src/domain/PromptRecord.ts"
import type { SourceAdapter } from "../../src/domain/SourceAdapter.ts"

export const fixtureDir = (name: string): string =>
  new URL(`../fixtures/${name}`, import.meta.url).pathname

/** Read all records, sorted by id, with timestamps as ISO strings (snapshot-friendly). */
export const readAllSorted = (adapter: SourceAdapter) =>
  Stream.runCollect(adapter.read).pipe(
    Effect.map((records: ReadonlyArray<PromptRecord>) =>
      records
        .toSorted((a, b) => a.id.localeCompare(b.id))
        .map((r) => ({ ...r, timestamp: DateTime.formatIso(r.timestamp) })),
    ),
  )
