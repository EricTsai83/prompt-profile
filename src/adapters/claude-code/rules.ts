import { isAnalysisPrompt } from "../../domain/index.ts"
import type { ExcludeRule } from "../common/rules.ts"
import type { ClaudeLine } from "./schema.ts"

/** A `type: "user"` line with its extracted text. */
export interface ClaudeCandidate {
  readonly line: ClaudeLine
  readonly text: string
  readonly hasImage: boolean
  /** Content was an array containing only tool results. */
  readonly toolResultOnly: boolean
}

/** Tool / system generated content that shows up as a user message. */
export const INJECTED_PREFIXES: ReadonlyArray<string> = [
  "<task-notification>",
  "<local-command-caveat>",
  "<local-command-stdout>",
  "<local-command-stderr>",
  "<command-name>",
  "<command-message>",
  "<system-reminder>",
  "<bash-input>",
  "<bash-stdout>",
  "<bash-stderr>",
  "<user-prompt-submit-hook>",
]

const originKind = (origin: unknown): unknown =>
  typeof origin === "object" && origin !== null ? (origin as { kind?: unknown }).kind : undefined

/** Ordered: the first matching rule's name is counted in diagnostics. */
export const CLAUDE_RULES: ReadonlyArray<ExcludeRule<ClaudeCandidate>> = [
  { name: "tool-result-only", test: (c) => c.toolResultOnly },
  { name: "sidechain", test: (c) => c.line.isSidechain === true },
  { name: "meta", test: (c) => c.line.isMeta === true },
  { name: "compact-summary", test: (c) => c.line.isCompactSummary === true },
  {
    name: "system-notification",
    test: (c) =>
      c.line.promptSource === "system" ||
      c.line.turnOrigin === "task_notification" ||
      originKind(c.line.origin) === "task-notification",
  },
  {
    name: "automated-turn",
    test: (c) =>
      c.line.turnOrigin === "scheduled" ||
      c.line.turnOrigin === "peer" ||
      originKind(c.line.origin) === "peer",
  },
  { name: "slash-command", test: (c) => c.text.trimStart().startsWith("<command-name>") },
  {
    name: "injected-content",
    test: (c) => INJECTED_PREFIXES.some((p) => c.text.trimStart().startsWith(p)),
  },
  { name: "analysis-marker", test: (c) => isAnalysisPrompt(c.text) },
  { name: "empty", test: (c) => c.text.trim() === "" && !c.hasImage },
]
