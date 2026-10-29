import { describe, expect, it } from "@effect/vitest"
import { DateTime } from "effect"
import { buildChunks, type Chunk } from "../../src/analysis/chunk.ts"
import { measureSteering } from "../../src/analysis/steering.ts"
import type { ChunkObservations } from "../../src/domain/ChunkObservations.ts"
import type { SafePrompt } from "../../src/domain/SafePrompt.ts"

const prompt = (session: string, n: number, minute: number, text: string): SafePrompt => ({
  id: `claude-code:${session}:${n}`,
  sessionId: session,
  source: "claude-code",
  timestamp: DateTime.makeUnsafe(Date.UTC(2026, 8, 7, 1, minute)),
  project: "invoices",
  text,
})

// Hand-written: one-shot requests, a chatty conversation with one steer, and a repair.
const prompts = [
  prompt("one", 1, 0, "Add a CSV export to the invoice list and run the tests."),
  prompt("two", 1, 1, "Rename the payments module to billing everywhere."),
  prompt("chat", 1, 10, "Let's design the dashboard query."),
  prompt("chat", 2, 11, "What indexes exist on invoices?"),
  prompt("chat", 3, 12, "And on payments?"),
  prompt("chat", 4, 13, "No, keep the existing download API; don't add a new endpoint."),
  prompt("chat", 5, 14, "Looks good, continue."),
  prompt("fix", 1, 30, "The export button does nothing."),
  prompt("fix", 2, 31, "Still failing with the same error."),
  prompt("fix", 3, 32, "Use zustand instead of a new context."),
]
const [chunk] = buildChunks(prompts, "Asia/Taipei") as [Chunk]
const label = (id: string, kind: "steer" | "repair", quote: string) => ({
  promptId: `claude-code:${id}`,
  kind,
  quote,
})
const outcome = (interventions: ChunkObservations["interventions"]) => ({
  chunk,
  observations: { chunkId: chunk.id, observations: [], episodes: [], interventions },
})

describe("measureSteering", () => {
  it("counts conversations, with only conversations that have follow-ups as the denominator", () => {
    const s = measureSteering([
      outcome([
        label("chat:4", "steer", "keep the existing download API"),
        label("fix:2", "repair", "Still failing with the same error."),
        label("fix:3", "steer", "Use zustand instead of a new context."),
      ]),
    ])
    expect(s).toMatchObject({
      conversations: 4,
      // the one-shot requests have nothing to judge
      withFollowUps: 2,
      followUpPrompts: 6,
      steer: { conversations: 2, prompts: 2 },
      repair: { conversations: 1, prompts: 1 },
      rejected: 0,
    })
  })

  it("keeps verified quotes as examples, one per conversation first", () => {
    const s = measureSteering([
      outcome([
        label("chat:4", "steer", "keep the existing download API"),
        label("chat:2", "steer", "What indexes exist on invoices?"),
        label("fix:3", "steer", "Use zustand"),
      ]),
    ])
    expect(s.steer.examples.map((e) => e.promptId)).toEqual([
      "claude-code:chat:4",
      "claude-code:fix:3",
    ])
    expect(s.steer.examples[0]!.quote).toBe("keep the existing download API")
  })

  it.each([
    ["a first prompt, which has nothing to steer", label("one:1", "steer", "Add a CSV export")],
    ["an unknown prompt", label("ghost:2", "repair", "anything")],
    ["a paraphrased quote", label("fix:2", "repair", "it is still broken")],
  ])("rejects a label on %s", (_name, bad) => {
    const s = measureSteering([outcome([bad])])
    expect(s.rejected).toBe(1)
    expect(s.steer.prompts + s.repair.prompts).toBe(0)
  })

  it("counts a prompt once even when it is labelled twice", () => {
    const s = measureSteering([
      outcome([label("fix:3", "steer", "Use zustand"), label("fix:3", "repair", "Use zustand")]),
    ])
    expect([s.steer.prompts, s.repair.prompts, s.rejected]).toEqual([1, 0, 1])
  })
})
