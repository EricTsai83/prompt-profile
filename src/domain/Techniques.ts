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
  /**
   * `transcript`: the session has full metadata on disk (one per session; the denominator).
   * `model`: a model the session used (once per session and model).
   */
  readonly kind: ToolTechnique | "transcript" | "model"
  /**
   * A name, never content: skill name, subagent type, MCP server, model, or "subagent" for
   * background / worktree use by a subagent.
   */
  readonly detail?: string
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
  /** Sessions with transcript metadata (the denominator of `tools`). */
  covered: Count,
  prompts: Count,
  /** Sessions using each workflow technique that month. */
  tools: countsOf(TOOL_TECHNIQUES, Count),
  /** Prompts using each prompt technique that month. */
  techniques: countsOf(PROMPT_TECHNIQUES, Count),
})

/** Where a skill comes from; decides whether the share page may show its name. */
export const SKILL_ORIGINS = ["builtin", "plugin", "personal", "project", "unknown"] as const

const NamedUse = Schema.Struct({
  name: Schema.String,
  uses: Count,
  sessions: Count,
  /** First and last day used, YYYY-MM-DD in the stats time zone. */
  first: Schema.String,
  last: Schema.String,
})

const SkillUse = Schema.Struct({
  ...NamedUse.fields,
  /** The skill's own description (SKILL.md front matter, or the built-in list); null if not found. */
  description: Schema.NullOr(Schema.String),
  origin: Schema.Literals(SKILL_ORIGINS),
})
export type SkillUse = typeof SkillUse.Type

/** Named breakdown of the workflow techniques (busiest first, at most MAX_DETAILS each). */
const Details = Schema.Struct({
  skills: Schema.Array(SkillUse),
  subagentTypes: Schema.Array(NamedUse),
  mcpServers: Schema.Array(NamedUse),
  models: Schema.Array(NamedUse),
})

export const MAX_DETAILS = 12

export const Techniques = Schema.Struct({
  /**
   * Sessions whose transcript (with tool metadata) is still on disk. Claude Code deletes old
   * transcripts, so workflow shares use this, not all sessions.
   */
  coveredSessions: Count,
  tools: countsOf(TOOL_TECHNIQUES, ToolUse),
  /** Share of cleaned prompts using each prompt technique. */
  prompts: countsOf(PROMPT_TECHNIQUES, Ratio),
  monthly: Schema.Array(MonthTechniques),
  /** Most sessions active at the same time (overlapping first-to-last activity). */
  maxParallel: Count,
  /** Days with at least two overlapping sessions. */
  parallelDays: Count,
  details: Details,
})
export type Techniques = typeof Techniques.Type
