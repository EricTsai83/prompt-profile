import type { ToolTechnique } from "../../domain/Techniques.ts"

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
