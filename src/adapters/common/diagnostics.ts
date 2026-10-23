import type { AdapterDiagnostics } from "../../domain/SourceAdapter.ts"

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

  snapshot(): AdapterDiagnostics {
    return {
      filesRead: this.filesRead,
      unreadableFiles: this.unreadableFiles,
      badLines: this.badLines,
      excluded: { ...this.excludedCounts },
      slashCommands: { ...this.slashCounts },
    }
  }
}
