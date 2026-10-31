import type { ToolTechnique } from "../../domain/index.ts"

/**
 * Agent tool names → workflow techniques (an extensible data list). Only the tool name is
 * looked at, never its input or output. Unlisted tools (shell, file edits, reads) are ordinary
 * work, not a technique.
 */
export const TOOL_NAME_TECHNIQUES: ReadonlyArray<{
  readonly technique: ToolTechnique
  readonly test: (name: string) => boolean
}> = [
  {
    technique: "subagents",
    test: (n) => n === "Agent" || n === "Task" || /^spawn_?agent$/i.test(n),
  },
  { technique: "skills", test: (n) => n === "Skill" },
  { technique: "planMode", test: (n) => n === "ExitPlanMode" || n === "EnterPlanMode" },
  { technique: "mcp", test: (n) => n.startsWith("mcp__") },
  { technique: "web", test: (n) => n === "WebSearch" || n === "WebFetch" || n === "web_search" },
  {
    technique: "background",
    test: (n) => n === "Monitor" || n === "ScheduleWakeup" || n === "CronCreate",
  },
  {
    technique: "askUser",
    test: (n) => n === "AskUserQuestion" || n.startsWith("request_user_input"),
  },
  { technique: "worktrees", test: (n) => n === "EnterWorktree" },
]

export const techniqueOfTool = (name: string): ToolTechnique | undefined =>
  TOOL_NAME_TECHNIQUES.find((t) => t.test(name))?.technique

/** A short identifier, never free text: names longer than this are dropped. */
const MAX_NAME = 80
const NAME = /^[\w.:@/-]+$/

const name = (v: unknown): string | undefined =>
  typeof v === "string" && v.length <= MAX_NAME && NAME.test(v) ? v : undefined

/**
 * The name behind a technique use: skill name, subagent type or MCP server. Only these
 * identifier fields are read, and only when they look like identifiers.
 */
export const toolDetail = (
  technique: ToolTechnique,
  tool: string,
  input: Readonly<Record<string, unknown>>,
): string | undefined => {
  if (technique === "skills") return name(input["skill"])
  if (technique === "subagents") return name(input["subagent_type"])
  if (technique === "mcp") return name(tool.split("__")[1])
  return undefined
}
