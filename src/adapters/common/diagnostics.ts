import type { AdapterDiagnostics } from "../../domain/index.ts"

const sortedKeys = (counts: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(counts).toSorted(([a], [b]) => a.localeCompare(b)))

/** Mutable counters collected while an adapter streams its data. */
export class DiagnosticsCollector {
  filesRead = 0
  unreadableFiles = 0
  badLines = 0
  private readonly excludedCounts: Record<string, number> = {}
  private readonly slashCounts: Record<string, number> = {}

  exclude(rule: string): void {
    this.excludedCounts[rule] = (this.excludedCounts[rule] ?? 0) + 1
  }

  slashCommand(name: string): void {
    this.slashCounts[name] = (this.slashCounts[name] ?? 0) + 1
  }

  /** Keys sorted: files are parsed concurrently, so insertion order is not deterministic. */
  snapshot(): AdapterDiagnostics {
    return {
      filesRead: this.filesRead,
      unreadableFiles: this.unreadableFiles,
      badLines: this.badLines,
      excluded: sortedKeys(this.excludedCounts),
      slashCommands: sortedKeys(this.slashCounts),
    }
  }
}

/** `readJsonl` callbacks that count into `diag`. */
export const jsonlCallbacks = (diag: DiagnosticsCollector) => ({
  onBadLine: () => void diag.badLines++,
  onUnreadable: () => void diag.unreadableFiles++,
})
