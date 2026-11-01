import { DateTime } from "effect"
import { expect, it } from "vitest"
import { processRecords } from "../../src/pipeline/process.ts"
import { rec } from "./records.ts"
import type { InstructionContext } from "../../src/domain/index.ts"

const context: InstructionContext = {
  id: "u:instruction:0",
  parentPromptId: "u",
  name: "review",
  description: "Review changes; contact alice@example.com",
  kind: "skill",
  selection: "user_explicit",
  selectionEvidence: "Use $review",

  content: "Verify results. Contact alice@example.com",
  contentStatus: "recorded",
}
it("retains concise explicit invocations and redacts all context evidence", () => {
  const result = processRecords(
    [rec("$review", "2026-09-03T12:00:00Z", { id: "u", instructionContexts: [context] })],
    {
      since: null,
      now: DateTime.makeUnsafe("2026-10-01T00:00:00Z"),
      timezone: "UTC",
      username: null,
    },
  )
  expect(result.prompts).toHaveLength(1)
  expect(JSON.stringify(result.prompts)).not.toContain("alice@example.com")
  expect(result.prompts[0]?.instructionContexts?.[0]?.content).toContain("[EMAIL]")
  expect(result.report.redactions["email"]).toBeGreaterThan(0)
})

it("redacts a recorded requirement before applying the excerpt limit", async () => {
  const { InstructionTracker } = await import("../../src/adapters/common/instruction-context.ts")
  const t = new InstructionTracker()
  t.user("u", "Use $review.")
  t.read("c", "/skills/review/SKILL.md")
  t.result("c", "x ".repeat(2995) + "alice@example.com followed by checks")
  const result = processRecords(
    [
      rec("Use $review.", "2026-09-03T12:00:00Z", {
        id: "u",
        instructionContexts: t.forPrompt("u"),
      }),
    ],
    {
      since: null,
      now: DateTime.makeUnsafe("2026-10-01T00:00:00Z"),
      timezone: "UTC",
      username: null,
    },
  )
  expect(JSON.stringify(result.prompts).includes("alice@")).toBe(false)
})
