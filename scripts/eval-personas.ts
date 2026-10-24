import { DateTime } from "effect"
import type { PromptRecord } from "../src/domain/PromptRecord.ts"

/** A hand-written persona in test/eval/personas/<name>/prompts.json. */
export interface Persona {
  readonly timezone: string
  readonly sessions: ReadonlyArray<{
    start: string
    project: string
    prompts: ReadonlyArray<string>
  }>
}

export const toRecords = (name: string, persona: Persona): Array<PromptRecord> =>
  persona.sessions.flatMap((s, si) =>
    s.prompts.map((text, pi) => ({
      id: `claude-code:${name}-${si}:${pi}`,
      source: "claude-code" as const,
      sessionId: `${name}-${si}`,
      timestamp: DateTime.makeUnsafe(Date.parse(s.start) + pi * 4 * 60_000),
      project: s.project,
      gitBranch: null,
      text,
      hasImage: false,
      origin: "interactive" as const,
      client: "eval",
    })),
  )
