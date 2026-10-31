import { describe, expect, it } from "@effect/vitest"
import { DateTime } from "effect"
import { measureAxisBalance } from "../../src/analysis/axes.ts"
import { buildChunks, type Chunk } from "../../src/analysis/chunk.ts"
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

// Hand-written: three conversations that define the goal first, one that explores first.
const prompts = [
  prompt("a", 1, 0, "Goal: the export must pass these three checks before you stop."),
  prompt("a", 2, 1, "Done when the CSV matches the sample file exactly."),
  prompt("b", 1, 10, "Acceptance: the totals equal the ledger; stop after that."),
  prompt("c", 1, 20, "Requirement first: dates in ISO format, then build it."),
  prompt("d", 1, 30, "Let's talk through a few options for the dashboard before deciding."),
]
const [chunk] = buildChunks(prompts, "Asia/Taipei") as [Chunk]
const signal = (
  id: string,
  axis: "framing" | "pacing" | "control" | "closure",
  pole: "first" | "second",
  quote: string,
) => ({ promptId: `claude-code:${id}`, axis, pole, quote })
const outcome = (axisSignals: ChunkObservations["axisSignals"]) => ({
  chunk,
  observations: {
    chunkId: chunk.id,
    observations: [],
    episodes: [],
    interventions: [],
    axisSignals,
  },
})

describe("measureAxisBalance", () => {
  it("counts each way of working by distinct conversation, from verified quotes", () => {
    const balance = measureAxisBalance([
      outcome([
        signal("a:1", "framing", "first", "the export must pass these three checks"),
        // a second prompt of the same conversation adds no conversation
        signal("a:2", "framing", "first", "Done when the CSV matches"),
        signal("b:1", "framing", "first", "Acceptance: the totals equal the ledger"),
        signal("c:1", "framing", "first", "Requirement first"),
        signal("d:1", "framing", "second", "a few options for the dashboard"),
      ]),
    ])
    expect(balance.axes.find((a) => a.key === "framing")).toMatchObject({
      key: "framing",
      first: 3,
      second: 1,
    })
    expect(balance.axes.find((a) => a.key === "pacing")).toMatchObject({
      key: "pacing",
      first: 0,
      second: 0,
    })
    expect(balance).toMatchObject({ conversations: 4, rejected: 0 })
  })

  it("keeps up to two verified example quotes per way, from different conversations", () => {
    const balance = measureAxisBalance([
      outcome([
        signal("a:1", "framing", "first", "the export must pass these three checks"),
        signal("a:2", "framing", "first", "Done when the CSV matches"),
        signal("b:1", "framing", "first", "Acceptance: the totals equal the ledger"),
        signal("c:1", "framing", "first", "Requirement first"),
        signal("d:1", "framing", "second", "a few options for the dashboard"),
      ]),
    ])
    const framing = balance.axes.find((a) => a.key === "framing")!
    expect(framing.examples.first).toEqual([
      { promptId: "claude-code:a:1", quote: "the export must pass these three checks" },
      { promptId: "claude-code:b:1", quote: "Acceptance: the totals equal the ledger" },
    ])
    expect(framing.examples.second).toEqual([
      { promptId: "claude-code:d:1", quote: "a few options for the dashboard" },
    ])
    expect(balance.axes.find((a) => a.key === "pacing")!.examples).toEqual({
      first: [],
      second: [],
    })
  })

  it("lets one conversation count for both ways of an axis", () => {
    const balance = measureAxisBalance([
      outcome([
        signal("a:1", "closure", "first", "must pass these three checks"),
        signal("a:2", "closure", "second", "matches the sample file exactly"),
      ]),
    ])
    expect(balance.axes.find((a) => a.key === "closure")).toMatchObject({ first: 1, second: 1 })
  })

  it("rejects misquotes, unknown prompts and a second label of the same prompt and axis", () => {
    const balance = measureAxisBalance([
      outcome([
        signal("a:1", "framing", "first", "this was never said"),
        signal("zz:9", "framing", "first", "Goal"),
        signal("b:1", "framing", "first", "Acceptance"),
        signal("b:1", "framing", "second", "the totals equal the ledger"),
      ]),
    ])
    expect(balance.axes.find((a) => a.key === "framing")).toMatchObject({ first: 1, second: 0 })
    expect(balance.rejected).toBe(3)
  })
})
