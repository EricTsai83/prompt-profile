import { DateTime } from "effect"
import type { PromptRecord } from "../../src/domain/PromptRecord.ts"

let counter = 0

/** Build a PromptRecord with sensible defaults. `at` is an ISO string (UTC). */
export const rec = (
  text: string,
  at: string,
  overrides: Partial<PromptRecord> = {},
): PromptRecord => {
  counter++
  return {
    id: overrides.id ?? `claude-code:s1:u${String(counter).padStart(4, "0")}`,
    source: "claude-code",
    sessionId: "s1",
    timestamp: DateTime.makeUnsafe(at),
    project: "/Users/alice/work/drawstuff",
    gitBranch: "main",
    text,
    hasImage: false,
    origin: "interactive",
    client: "cli",
    ...overrides,
  }
}
