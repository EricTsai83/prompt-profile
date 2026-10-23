import { type DateTime, Effect, Stream } from "effect"
import type { PromptRecord } from "../domain/PromptRecord.ts"
import type { SafePrompt } from "../domain/SafePrompt.ts"
import type { Stats } from "../domain/Stats.ts"
import { cleanRecords } from "./clean.ts"
import type { Counts } from "./counts.ts"
import { filterRecords } from "./filter.ts"
import { makeRules, projectName, redact } from "./redact.ts"
import { computeStats } from "./stats.ts"

export interface PipelineOptions {
  readonly since: DateTime.Utc | null
  /** Injected (never read the clock here) so tests are deterministic. */
  readonly now: DateTime.Utc
  readonly timezone: string
  /** OS username to redact; `null` disables the rule. */
  readonly username: string | null
  readonly slashCommands?: Readonly<Record<string, number>>
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
  const cleaned = cleanRecords(filtered.records)
  const redactions: Counts = {}
  const projectNames = new Map<string, string | null>()
  for (const r of filtered.records) {
    if (r.project !== null && !projectNames.has(r.project)) {
      // counted once per project: project names are sent to the LLM too
      projectNames.set(r.project, projectName(r.project, rules, redactions))
    }
  }
  const prompts: Array<SafePrompt> = cleaned.prompts.map(({ record, text }) => ({
    id: record.id,
    sessionId: record.sessionId,
    source: record.source,
    timestamp: record.timestamp,
    project: record.project === null ? null : (projectNames.get(record.project) ?? null),
    text: redact(text, rules, redactions),
  }))
  const stats = computeStats({
    filtered: filtered.records,
    cleaned: cleaned.prompts,
    projectNames,
    slashCommands: options.slashCommands ?? {},
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
      truncated: cleaned.truncated,
    },
  }
}

/** filter → (sort) → clean → redact, plus stats. `--since` is applied here and only here. */
export const runPipeline = <E, R>(
  records: Stream.Stream<PromptRecord, E, R>,
  options: PipelineOptions,
): Effect.Effect<PipelineResult, E, R> =>
  Stream.runCollect(records).pipe(Effect.map((all) => processRecords(all, options)))
