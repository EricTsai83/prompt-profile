import { DateTime, Effect } from "effect"
import type { SourceAdapter } from "../../src/domain/SourceAdapter.ts"

export const fixtureDir = (name: string): string =>
  new URL(`../fixtures/${name}`, import.meta.url).pathname

/** One read: records sorted by id with ISO timestamps (snapshot-friendly), and diagnostics. */
export const readSorted = (adapter: SourceAdapter) =>
  adapter.read.pipe(
    Effect.map(({ records, diagnostics }) => ({
      records: records
        .toSorted((a, b) => a.id.localeCompare(b.id))
        .map((r) => ({ ...r, timestamp: DateTime.formatIso(r.timestamp) })),
      diagnostics,
    })),
  )
