import { type DateTime, Effect, Stream } from "effect"
import type { PromptRecord, SafePrompt, Stats, TechniqueEvent } from "../domain/index.ts"
import { cleanRecords, truncateMiddle } from "./clean.ts"
import type { Counts } from "./counts.ts"
import { filterRecords } from "./filter.ts"
import { makeRules, projectName, redact } from "./redact.ts"
import { computeStats } from "./stats.ts"

export interface PipelineOptions {
  readonly preserveFollowups?: boolean
  readonly since: DateTime.Utc | null
  /** Injected (never read the clock here) so tests are deterministic. */
  readonly now: DateTime.Utc
  readonly timezone: string
  /** OS username to redact; `null` disables the rule. */
  readonly username: string | null
  readonly slashCommands?: Readonly<Record<string, number>>
  /** Workflow technique uses reported by the adapters (no content). */
  readonly events?: ReadonlyArray<TechniqueEvent>
  readonly delegationPatterns?: ReadonlyArray<RegExp>
}

/** What the pipeline did — shown to the user so they can trust what is sent. */
export interface PipelineReport {
  readonly read: number
  readonly filterExcluded: Counts
  readonly cleanExcluded: Counts
  readonly redactions: Counts
  readonly codeBlocksCollapsed: number
  readonly truncated: number
}

export interface PipelineResult {
  readonly prompts: ReadonlyArray<SafePrompt>
  readonly stats: Stats
  readonly report: PipelineReport
}

/** Pure core of the pipeline (records already collected). */
export const processRecords = (
  records: ReadonlyArray<PromptRecord>,
  options: PipelineOptions,
): PipelineResult => {
  const rules = makeRules(options.username)
  const filtered = filterRecords(records, {
    since: options.since,
    until: options.now,
    ...(options.delegationPatterns ? { delegationPatterns: options.delegationPatterns } : {}),
  })
  const cleaned = cleanRecords(filtered.records, options.preserveFollowups)
  const redactions: Counts = {}
  const projectNames = new Map<string, string | null>()
  for (const r of filtered.records) {
    if (r.project !== null && !projectNames.has(r.project)) {
      // counted once per project: project names are sent to the LLM too
      projectNames.set(r.project, projectName(r.project, rules, redactions))
    }
  }
  // Redact first, then truncate: a cut through a secret would leave two partial pieces
  // that no rule recognises.
  let truncated = 0
  const prompts: Array<SafePrompt> = cleaned.prompts.map(({ record, text }) => {
    const cut = truncateMiddle(redact(text, rules, redactions))
    if (cut.truncated) truncated++
    return {
      id: record.id,
      sessionId: record.sessionId,
      source: record.source,
      timestamp: record.timestamp,
      project: record.project === null ? null : (projectNames.get(record.project) ?? null),
      text: cut.text,
    }
  })
  const stats = computeStats({
    filtered: filtered.records,
    // content features use the cleaned text, at the length that is analysed
    cleaned: cleaned.prompts.map((c) => ({ ...c, text: truncateMiddle(c.text).text })),
    projectNames,
    slashCommands: options.slashCommands ?? {},
    events: options.events ?? [],
    since: options.since,
    now: options.now,
    timezone: options.timezone,
  })
  return {
    prompts,
    stats,
    report: {
      read: records.length,
      filterExcluded: filtered.excluded,
      cleanExcluded: cleaned.excluded,
      redactions,
      codeBlocksCollapsed: cleaned.codeBlocksCollapsed,
      truncated,
    },
  }
}

/** filter → (sort) → clean → redact → truncate, plus stats. `--since` is applied here and only here. */
export const runPipeline = <E, R>(
  records: Stream.Stream<PromptRecord, E, R>,
  options: PipelineOptions,
): Effect.Effect<PipelineResult, E, R> =>
  Stream.runCollect(records).pipe(Effect.map((all) => processRecords(all, options)))
