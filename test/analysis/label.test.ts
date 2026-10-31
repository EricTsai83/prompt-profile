import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect } from "effect"
import { buildChunks, type Chunk } from "../../src/analysis/chunk.ts"
import { labelTraits, measureTraitFrequency } from "../../src/analysis/label.ts"
import { withCallBudget } from "../../src/llm/budget.ts"
import { makeFakeLlmRunner } from "../../src/llm/fake.ts"
import { LlmRunner } from "../../src/llm/LlmRunner.ts"
import type { SafePrompt } from "../../src/domain/SafePrompt.ts"

const prompt = (
  session: string,
  n: number,
  minute: number,
  project: string,
  text: string,
): SafePrompt => ({
  id: `claude-code:${session}:${n}`,
  sessionId: session,
  source: "claude-code",
  timestamp: DateTime.makeUnsafe(Date.UTC(2026, 8, 7, 1, minute)),
  project,
  text,
})

// Hand-written: four conversations in two projects.
const prompts = [
  prompt("a", 1, 0, "invoices", "Is this really the best practice for caching?"),
  prompt("a", 2, 1, "invoices", "Why is the version pinned? Is that best practice?"),
  prompt("b", 1, 10, "invoices", "Move the icon two pixels to the right."),
  prompt("c", 1, 20, "canvas", "Is a reducer the recommended pattern here?"),
  prompt("d", 1, 30, "canvas", "Run the next plan and commit by scope."),
]
const [chunk] = buildChunks(prompts, "Asia/Taipei") as [Chunk]
const label = (id: string, trait: string, quote: string) => ({
  promptId: `claude-code:${id}`,
  trait,
  quote,
})
const traits = ["Best-practice skeptic", "Pixel-level eye", "Boundary setter"]

describe("measureTraitFrequency", () => {
  it("counts each trait by distinct conversation, overall and per project", () => {
    const result = measureTraitFrequency(
      [
        {
          chunk,
          labels: [
            label("a:1", "Best-practice skeptic", "really the best practice"),
            // the same conversation again adds nothing
            label("a:2", "Best-practice skeptic", "Is that best practice?"),
            label("c:1", "best-practice skeptic", "the recommended pattern"),
            label("b:1", "Pixel-level eye", "two pixels to the right"),
          ],
        },
      ],
      traits,
    )
    expect(result.frequencies[0]).toEqual({
      sessions: 2,
      analysedSessions: 4,
      byProject: [
        { project: "invoices", sessions: 1, analysedSessions: 2 },
        { project: "canvas", sessions: 1, analysedSessions: 2 },
      ],
    })
    expect(result.frequencies[1]).toMatchObject({ sessions: 1, analysedSessions: 4 })
    // labelled chunks with no label for a trait: measured as zero, not unknown
    expect(result.frequencies[2]).toMatchObject({ sessions: 0, analysedSessions: 4 })
    expect(result.rejected).toBe(0)
  })

  it("rejects misquotes, unknown prompts and unknown traits, and counts them", () => {
    const result = measureTraitFrequency(
      [
        {
          chunk,
          labels: [
            label("a:1", "Best-practice skeptic", "this was never said"),
            label("zz:1", "Best-practice skeptic", "best practice"),
            label("b:1", "Night owl", "two pixels"),
            label("b:1", "Pixel-level eye", "two pixels"),
          ],
        },
      ],
      traits,
    )
    expect(result.frequencies[0]).toMatchObject({ sessions: 0 })
    expect(result.frequencies[1]).toMatchObject({ sessions: 1 })
    expect(result.rejected).toBe(3)
  })

  it("leaves every trait unmeasured when no chunk was labelled", () => {
    const result = measureTraitFrequency([{ chunk, labels: null }], traits)
    expect(result.frequencies).toEqual([null, null, null])
    expect(result.chunksFailed).toBe(1)
  })
})

describe("labelTraits", () => {
  it.effect("stops labelling at a call budget and keeps what was labelled", () =>
    Effect.gen(function* () {
      const runner = withCallBudget(makeFakeLlmRunner({ respond: () => ({ labels: [] }) }), 1)
      const two = buildChunks(
        [prompts[0]!, { ...prompts[3]!, timestamp: DateTime.makeUnsafe(Date.UTC(2026, 9, 7)) }],
        "Asia/Taipei",
      )
      expect(two.length).toBe(2)
      const outcomes = yield* labelTraits(two, [{ name: "x", description: "y" }], {
        timezone: "Asia/Taipei",
        full: false,
        noCache: false,
        model: null,
        concurrency: 1,
      }).pipe(Effect.provideService(LlmRunner, runner))
      expect(outcomes.map((o) => o.labels)).toEqual([[], null])
    }),
  )
})
