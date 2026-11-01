import { Effect, Schema } from "effect"
import { expect, it } from "vitest"
import type { AnalyzeOptions } from "../../src/analysis/plan.ts"
import { generateCached } from "../../src/analysis/generated.ts"
import { AnalysisCache, makeMemoryCache } from "../../src/analysis/cache.ts"
import { Progress, silentProgress } from "../../src/analysis/progress.ts"
import { LlmRunner, makeLlmSchema } from "../../src/llm/LlmRunner.ts"
import { makeFakeLlmRunner } from "../../src/llm/fake.ts"

it("revalidates checkpoints, preserves model provenance and never replays old consumption", async () => {
  const cache = makeMemoryCache()
  const fake = makeFakeLlmRunner({ respond: () => ({ text: "A fictional draft" }) })
  let hits = 0
  const input = {
    stage: "draft" as const,
    system: "Write a draft",
    prompt: "Fictional observations",
    schema: makeLlmSchema("Draft", Schema.Struct({ text: Schema.String })),
  }
  const options: AnalyzeOptions = { timezone: "UTC", full: false, noCache: false, model: null }
  const run = (opts = options, request = input) =>
    Effect.runPromise(
      generateCached("draft", request, opts).pipe(
        Effect.provideService(AnalysisCache, cache),
        Effect.provideService(LlmRunner, fake),
        Effect.provideService(Progress, {
          ...silentProgress,
          onGeneratedCacheHit: Effect.sync(() => {
            hits++
          }),
        }),
      ),
    )
  await run()
  const hit = await run()
  expect(fake.calls()).toBe(1)
  expect(hits).toBe(1)
  expect(hit).toMatchObject({
    model: "fake-model",
    modelSource: "reported",
    durationMs: 0,
    usage: { inputTokens: null, outputTokens: null, costUsd: null },
  })
  const entry = [...cache.generatedEntries.values()][0]!
  for (const [key, value] of cache.generatedEntries)
    cache.generatedEntries.set(key, { ...value, value: { text: 12 } })
  await run()
  expect(fake.calls()).toBe(2)
  await run({ ...options, noCache: true })
  expect(fake.calls()).toBe(3)
  await run()
  expect(fake.calls()).toBe(3)
  await run(options, { ...input, system: "Changed instructions" })
  await run(options, { ...input, prompt: "Changed observations" })
  await run({ ...options, model: "other-model" })
  await run({ ...options, effort: "low" })
  expect(fake.calls()).toBe(7)
  expect(entry.producedBy).toBe("fake-model")
})
