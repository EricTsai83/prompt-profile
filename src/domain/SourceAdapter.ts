import type { Effect } from "effect"
import type { PromptRecord } from "./PromptRecord.ts"
import type { SourceId } from "./Source.ts"
import type { SKILL_ORIGINS, TechniqueEvent } from "./Techniques.ts"
import type { PlanInfo, UsageDiagnostics, UsageEvent } from "./Usage.ts"

export type SkillOrigin = (typeof SKILL_ORIGINS)[number]

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
  /** Workflow technique uses found in agent metadata (plan 17); never any content. */
  readonly events: ReadonlyArray<TechniqueEvent>
  /**
   * Skill name → its one-line description, from the skill listings the agent records (Claude
   * Code `skill_listing`). Only names and descriptions, never a skill's body or arguments.
   */
  readonly skillDescriptions?: Readonly<Record<string, string>>
  /** Skill name → where it comes from, when the listing says so (Codex lists file paths). */
  readonly skillOrigins?: Readonly<Record<string, SkillOrigin>>
  /**
   * One event per model response (plan 23): token counts and model only, never any text.
   * De-duplicated; prompt-profile's own analysis sessions are left out.
   */
  readonly usage?: {
    readonly events: ReadonlyArray<UsageEvent>
    readonly diagnostics: UsageDiagnostics
  }
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
  /**
   * The plan from the source's local files, if it has any (plan 23); never fails, and never
   * returns a token, email or account id.
   */
  readonly plan?: Effect.Effect<PlanInfo>
}
