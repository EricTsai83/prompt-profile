import { isAnalysisPrompt } from "../../domain/markers.ts"
import type { Origin } from "../../domain/Source.ts"
import type { ExcludeRule } from "../common/rules.ts"
import type { SessionMeta } from "./schema.ts"

/** Content Codex injects as `input_text` blocks of a user message. */
export const INJECTED_PREFIXES: ReadonlyArray<string> = [
  "<environment_context>",
  "<user_action>",
  "<guardian_tool_descriptions>",
  "<user_instructions>",
  "# AGENTS.md instructions",
  "# AGENTS",
]

export const isInjected = (text: string): boolean =>
  INJECTED_PREFIXES.some((p) => text.trimStart().startsWith(p))

/** Session-level rules: a matching session is excluded entirely. */
export const SESSION_RULES: ReadonlyArray<ExcludeRule<SessionMeta>> = [
  {
    name: "subagent-session",
    test: (m) => typeof m.source === "object" && m.source !== null && "subagent" in m.source,
  },
]

export interface CodexCandidate {
  /** Non-injected text blocks joined with "\n". */
  readonly text: string
  readonly hasImage: boolean
  /** Number of injected blocks removed. */
  readonly injectedBlocks: number
}

export const MESSAGE_RULES: ReadonlyArray<ExcludeRule<CodexCandidate>> = [
  {
    name: "injected-content",
    test: (c) => c.injectedBlocks > 0 && c.text.trim() === "" && !c.hasImage,
  },
  { name: "analysis-marker", test: (c) => isAnalysisPrompt(c.text) },
  { name: "empty", test: (c) => c.text.trim() === "" && !c.hasImage },
]

/**
 * Who typed this? `originator` wins over `source`: apps like T3 Code may run Codex in exec
 * mode, but a human is typing.
 *  1. originator is a non-Codex app (doesn't start with "codex") → sdk
 *  2. source "exec" → exec
 *  3. source "vscode" / "cli" → interactive
 *  4. otherwise → unknown
 */
export const codexOrigin = (meta: SessionMeta | undefined): Origin => {
  const originator = meta?.originator ?? null
  if (originator !== null && originator !== "" && !/^codex/i.test(originator)) return "sdk"
  if (meta?.source === "exec") return "exec"
  if (meta?.source === "vscode" || meta?.source === "cli") return "interactive"
  return "unknown"
}
