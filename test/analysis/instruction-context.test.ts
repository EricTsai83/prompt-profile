import { readFileSync } from "node:fs"
import { DateTime, Effect } from "effect"
import { expect, it } from "vitest"
import { analyze } from "../../src/analysis/analyze.ts"
import { memoryCacheLayer } from "../../src/analysis/cache.ts"
import { silentProgressLayer } from "../../src/analysis/progress.ts"
import { decodeProfile, type InstructionContext } from "../../src/domain/index.ts"
import { makeFakeLlmRunner } from "../../src/llm/fake.ts"
import { LlmRunner } from "../../src/llm/LlmRunner.ts"

it.each(["user_explicit", "agent_selected", "automatic", "unknown"] as const)(
  "only explicitly adopted recorded content supports user ability claims (%s)",
  async (selection) => {
    const json = JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))
    const base = await Effect.runPromise(decodeProfile(json))
    const context: InstructionContext = {
      id: "u:instruction:0",
      parentPromptId: "u",
      name: "review",
      kind: "skill",
      selection,
      selectionEvidence: selection === "user_explicit" ? "Use $review." : null,

      content: "Run acceptance tests before publishing.",
      contentStatus: "recorded",
    }
    const evidence = [{ promptId: context.id, quote: context.content! }]
    const fake = makeFakeLlmRunner({
      respond: ({ schemaName }) =>
        schemaName === "LlmChunkAnalysis"
          ? {
              observations: [
                { dimension: "work_style", claim: "Adopts an acceptance check.", evidence },
              ],
              episodes: [],
              interventions: [],
              axisSignals: [],
            }
          : {
              ...json,
              traits: [],
              dimensions: [],
              improvements: [],
              patterns: [],
              narrative: null,
              portrait: null,
              collaboration: null,
              abilities: [{ key: "verification", score: 80, evidence, byProject: [] }],
            },
    })
    const profile = await Effect.runPromise(
      analyze({
        prompts: [
          {
            id: "u",
            sessionId: "s",
            source: "codex",
            project: "fictional",
            timestamp: DateTime.makeUnsafe("2026-09-03T12:00:00Z"),
            text: "Use $review.",
            instructionContexts: [context],
          },
        ],
        stats: base.stats,
        options: { timezone: "UTC", full: true, noCache: true, model: null },
      }).pipe(
        Effect.provideService(LlmRunner, fake),
        Effect.provide(memoryCacheLayer()),
        Effect.provide(silentProgressLayer),
      ),
    )
    expect(profile.abilities.find((a) => a.key === "verification")?.score).toBe(
      selection === "user_explicit" ? 60 : null,
    )
    expect(profile.instructionContexts).toEqual([context])
    expect(profile.evidenceOrigins?.some((o) => o.promptId === context.id) ?? false).toBe(
      selection === "user_explicit",
    )
  },
)

it("changes the analysis cache identity when recorded requirements or selection change", async () => {
  const { buildChunks } = await import("../../src/analysis/chunk.ts")
  const context: InstructionContext = {
    id: "u:instruction:0",
    parentPromptId: "u",
    name: "review",
    kind: "skill",
    selection: "user_explicit",
    selectionEvidence: "Use $review.",

    content: "Run tests.",
    contentStatus: "recorded",
  }
  const prompt = {
    id: "u",
    sessionId: "s",
    source: "codex" as const,
    project: null,
    timestamp: DateTime.makeUnsafe("2026-09-03T12:00:00Z"),
    text: "Use $review.",
  }
  const hash = (c: InstructionContext) =>
    buildChunks([{ ...prompt, instructionContexts: [c] }], "UTC")[0]!.id
  expect(hash(context)).not.toBe(hash({ ...context, content: "Check acceptance criteria." }))
  expect(hash(context)).not.toBe(hash({ ...context, selection: "automatic" }))
})

it("uses a description as purpose metadata, never as a user quotation or recorded requirement", async () => {
  const { instructionEvidence } = await import("../../src/domain/index.ts")
  const context: InstructionContext = {
    id: "u:instruction:0",
    parentPromptId: "u",
    name: "review",
    kind: "skill",
    description: "Review changes for correctness.",
    selection: "user_explicit",
    selectionEvidence: "Use $review.",
    content: null,
    contentStatus: "missing",
  }
  expect(
    instructionEvidence({ id: "u", text: "Use $review.", instructionContexts: [context] }),
  ).toEqual([["u", "Use $review."]])
})
