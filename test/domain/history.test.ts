import { DateTime, Effect } from "effect"
import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { compareHistory } from "../../src/domain/History.ts"
const version = { schema: 16, pipeline: "4" }
const pair = async () => {
  const base = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const make = (since: string, until: string, pole: "first" | "second"): Profile => ({
    ...base,
    engine: {
      ...base.engine,
      analysisVersion: "21",
      model: "reported-model",
      modelSource: "reported",
      modelsUsed: ["reported-model"],
    },
    coverage: {
      ...base.coverage,
      sampled: false,
      chunksFailed: 0,
      chunksFromCache: 0,
      promptsAnalyzed: base.stats.analyzedPrompts,
    },
    stats: {
      ...base.stats,
      window: { since: DateTime.makeUnsafe(since), until: DateTime.makeUnsafe(until) },
    },
    portrait: {
      introduction: "Observed requests.",
      chapters: [],
      axes: [
        {
          key: "framing",
          explanation: "Task-dependent choices.",
          sides: [
            {
              pole,
              context: "fictional tasks",
              sessions: 2,
              evidence: [
                {
                  promptId: `${pole}:one`,
                  quote: pole === "first" ? "Define the target" : "Explore alternatives",
                },
                {
                  promptId: `${pole}:two`,
                  quote: pole === "first" ? "Keep the API" : "Compare two options",
                },
              ],
            },
          ],
        },
      ],
    },
  })
  return [
    make("2026-10-08T00:00:00Z", "2026-10-15T00:00:00Z", "second"),
    make("2026-10-01T00:00:00Z", "2026-10-08T00:00:00Z", "first"),
  ] as const
}
it("reports bounded preference differences with evidence, never role-label growth", async () => {
  const [current, previous] = await pair()
  const result = compareHistory(current, previous, version, version)
  expect(result.reasons).toEqual([])
  expect(result.comparison?.changes[0]).toMatchObject({
    key: "framing",
    before: "first",
    after: "second",
  })
  expect(result.comparison?.changes[0]?.previousEvidence[0]?.quote).toBe("Define the target")
})
it("withholds comparisons when windows, provenance, versions or evidence are not comparable", async () => {
  const [current, previous] = await pair()
  expect(
    compareHistory(
      { ...current, stats: { ...current.stats, window: previous.stats.window } },
      previous,
      version,
      version,
    ).reasons,
  ).toContain("overlapping-windows")
  expect(
    compareHistory(
      { ...current, engine: { ...current.engine, modelSource: "requested" } },
      previous,
      version,
      version,
    ).comparison,
  ).toBeNull()
  expect(
    compareHistory(current, previous, version, { ...version, schema: 15 }).comparison,
  ).toBeNull()
  expect(
    compareHistory(
      { ...current, coverage: { ...current.coverage, sampled: true } },
      previous,
      version,
      version,
    ).comparison,
  ).toBeNull()
  expect(
    compareHistory(
      { ...current, engine: { ...current.engine, modelsUsed: ["reported-model", "other-model"] } },
      previous,
      version,
      version,
    ).comparison,
  ).toBeNull()
})

it("allows cached evidence with complete recorded model provenance", async () => {
  const [current, previous] = await pair()
  const cached = { ...current, coverage: { ...current.coverage, chunksFromCache: 3 } }
  expect(compareHistory(cached, previous, version, version).comparison).not.toBeNull()
})

it("does not label a later data window as the earlier comparison", async () => {
  const [current, previous] = await pair()
  const reversed = compareHistory(previous, current, version, version)
  expect(reversed.comparison).toBeNull()
  expect(reversed.reasons).toContain("nonchronological-windows")
})
