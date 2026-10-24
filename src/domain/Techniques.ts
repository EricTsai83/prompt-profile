import { Schema } from "effect"

/**
 * Techniques (plan 17): how someone works with AI agents, measured from metadata (tool use,
 * modes) and from the prompt text. Both lists are data: adding one touches the matchers
 * (adapters for tools, pipeline for prompts), messages and nothing else.
 */

/** Workflow techniques, from agent metadata (never from tool inputs or outputs). */
export const TOOL_TECHNIQUES = [
  "subagents",
  "skills",
  "planMode",
  "mcp",
  "web",
  "background",
  "askUser",
  "worktrees",
  "pullRequests",
] as const
export type ToolTechnique = (typeof TOOL_TECHNIQUES)[number]

/** Prompt-writing techniques, from the cleaned prompt text (heuristics, see pipeline). */
export const PROMPT_TECHNIQUES = [
  "planFirst",
  "context",
  "filePaths",
  "constraints",
  "acceptance",
  "examples",
  "verification",
  "structured",
  "whyExplain",
  "outputFormat",
] as const
export type PromptTechnique = (typeof PROMPT_TECHNIQUES)[number]

/** One use of a workflow technique, as an adapter reports it (no content). */
export interface TechniqueEvent {
  readonly source: string
  readonly sessionId: string
  readonly timestampMs: number
  readonly kind: ToolTechnique
}

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Ratio = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }))

const countsOf = <const K extends ReadonlyArray<string>, S extends Schema.Top>(keys: K, value: S) =>
  Schema.Struct(Object.fromEntries(keys.map((k) => [k, value])) as { readonly [P in K[number]]: S })

const ToolUse = Schema.Struct({
  /** Uses in the window. */
  count: Count,
  /** Distinct sessions with at least one use. */
  sessions: Count,
})

const MonthTechniques = Schema.Struct({
  /** YYYY-MM in the stats time zone. */
  month: Schema.String,
  sessions: Count,
  prompts: Count,
  /** Sessions using each workflow technique that month. */
  tools: countsOf(TOOL_TECHNIQUES, Count),
  /** Prompts using each prompt technique that month. */
  techniques: countsOf(PROMPT_TECHNIQUES, Count),
})

export const Techniques = Schema.Struct({
  tools: countsOf(TOOL_TECHNIQUES, ToolUse),
  /** Share of cleaned prompts using each prompt technique. */
  prompts: countsOf(PROMPT_TECHNIQUES, Ratio),
  monthly: Schema.Array(MonthTechniques),
  /** Most sessions active at the same time (overlapping first-to-last activity). */
  maxParallel: Count,
  /** Days with at least two overlapping sessions. */
  parallelDays: Count,
})
export type Techniques = typeof Techniques.Type
