import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect, Fiber, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import { analyze, plan, type AnalyzeOptions } from "../../src/analysis/index.ts"
import { AnalysisCache, makeMemoryCache } from "../../src/analysis/cache.ts"
import { Progress, silentProgress } from "../../src/analysis/progress.ts"
import { Profile } from "../../src/domain/Profile.ts"
import type { SafePrompt } from "../../src/domain/SafePrompt.ts"
import { processRecords } from "../../src/pipeline/index.ts"
import { makeFakeLlmRunner, type FakeOptions } from "../../src/llm/fake.ts"
import { LlmRunner, NotLoggedIn, ProcessFailed, RateLimited } from "../../src/llm/LlmRunner.ts"
import { makePrompts } from "./fixtures.ts"

const options: AnalyzeOptions = {
  language: "zh-TW",
  timezone: "Asia/Taipei",
  full: false,
  noCache: false,
  model: null,
}

/** A fake LLM that quotes the first prompt of each chunk, and builds the profile from observations. */
const respond: FakeOptions["respond"] = ({ prompt, schemaName }) => {
  if (schemaName === "LlmChunkObservations") {
    if (prompt.startsWith("[")) {
      // merge step: pass observations through
      return { observations: JSON.parse(prompt) }
    }
    const m = /<prompt id="([^"]+)"[^>]*>\n(.{0,30})/.exec(prompt)!
    return {
      observations: [
        {
          dimension: "work_style",
          claim: "工作很規律",
          evidence: [{ promptId: m[1], quote: m[2] }],
        },
        {
          dimension: "growth",
          claim: "捏造的觀察",
          evidence: [{ promptId: m[1], quote: "this was never said" }],
        },
      ],
    }
  }
  const obs = JSON.parse(/observations:\n(.*)\n\nstats:/s.exec(prompt)![1]!) as Array<{
    evidence: Array<{ promptId: string; quote: string }>
  }>
  const evidence = obs.flatMap((o) => o.evidence)
  return {
    headline: "規律的開發者",
    archetype: { name: "穩定輸出者", description: "每天都在寫。" },
    dimensions: ["work_style", "communication", "tech_profile", "interests", "growth"].map(
      (key) => ({
        key,
        title: key,
        summary: "摘要",
        evidence: key === "work_style" ? evidence.slice(0, 2) : [],
      }),
    ),
    traits: [
      { name: "規律", description: "d", confidence: "high", evidence: evidence.slice(0, 3) },
      { name: "孤證", description: "d", confidence: "high", evidence: evidence.slice(0, 1) },
      {
        name: "捏造",
        description: "d",
        confidence: "medium",
        evidence: [{ promptId: "x", quote: "y" }],
      },
    ],
    funFacts: ["最長連續 3 天"],
  }
}

const prompts: Array<SafePrompt> = makePrompts({
  from: "2026-08-01T01:00:00Z",
  days: 40,
  perDay: 2,
  textSize: 3000,
})
const stats = processRecords([], {
  since: null,
  now: DateTime.makeUnsafe("2026-10-24T00:00:00Z"),
  timezone: "Asia/Taipei",
  username: null,
}).stats

const run = (
  fake: ReturnType<typeof makeFakeLlmRunner>,
  cache = makeMemoryCache(),
  opts: AnalyzeOptions = options,
) =>
  analyze({ prompts, stats, options: opts }).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.succeed(LlmRunner, fake),
        Layer.succeed(AnalysisCache, cache),
        Layer.succeed(Progress, silentProgress),
      ),
    ),
  )

describe("analyze", () => {
  it.effect("produces a valid, verified Profile", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({ respond })
      const profile = yield* run(fake)
      expect(Schema.is(Profile)(profile)).toBe(true)
      expect(profile.traits.map((t) => [t.name, t.confidence])).toEqual([
        ["規律", "high"],
        ["孤證", "medium"],
      ])
      expect(profile.coverage).toMatchObject({
        chunksFailed: 0,
        chunksFromCache: 0,
        sampled: false,
        evidenceDropped: 1,
      })
      expect(profile.engine).toEqual({
        runner: "claude-code",
        model: "fake-model",
        analysisVersion: "1",
      })
      // the map instructions are in Traditional Chinese mode
      expect(fake.log[0]!.system).toContain("繁體中文")
      // chunk text is what's sent
      expect(fake.log[0]!.prompt).toMatch(/^<prompt id="/)
      expect(
        Schema.encodeSync(Profile)({ ...profile, generatedAt: DateTime.makeUnsafe(0) }),
      ).toMatchSnapshot()
    }),
  )

  it.effect("second run hits the cache for every chunk", () =>
    Effect.gen(function* () {
      const cache = makeMemoryCache()
      const first = makeFakeLlmRunner({ respond })
      yield* run(first, cache)
      const chunkCalls = first.log.filter((c) => c.schema === "LlmChunkObservations").length
      expect(chunkCalls).toBeGreaterThan(1)
      const second = makeFakeLlmRunner({ respond })
      const profile = yield* run(second, cache)
      expect(second.log.filter((c) => c.schema === "LlmChunkObservations")).toHaveLength(0)
      expect(second.calls()).toBe(1) // reduce only
      expect(profile.coverage.chunksFromCache).toBe(chunkCalls)
      // --no-cache skips reads
      const third = makeFakeLlmRunner({ respond })
      yield* run(third, cache, { ...options, noCache: true })
      expect(third.calls()).toBe(chunkCalls + 1)
    }),
  )

  it.effect("cache keys include model and language", () =>
    Effect.gen(function* () {
      const cache = makeMemoryCache()
      yield* run(makeFakeLlmRunner({ respond }), cache)
      const other = makeFakeLlmRunner({ respond })
      yield* run(other, cache, { ...options, language: "en" })
      expect(other.calls()).toBeGreaterThan(1)
    }),
  )

  it.effect("skips a failed chunk and reports it", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({
        respond,
        failures: new Map([
          [
            1,
            new ProcessFailed({ runner: "claude-code", exitCode: 1, detail: "x", stderrTail: "" }),
          ],
        ]),
      })
      const profile = yield* run(fake)
      expect(profile.coverage.chunksFailed).toBe(1)
      expect(profile.coverage.chunksAnalyzed).toBe(profile.coverage.chunksTotal - 1)
    }),
  )

  it.effect("fails when more than half of the chunks fail", () =>
    Effect.gen(function* () {
      const err = new ProcessFailed({
        runner: "claude-code",
        exitCode: 1,
        detail: "x",
        stderrTail: "",
      })
      const fake = makeFakeLlmRunner({
        respond,
        failures: new Map(Array.from({ length: 50 }, (_, i) => [i + 1, err])),
      })
      const error = yield* Effect.flip(run(fake))
      expect(error._tag).toBe("AnalysisFailed")
    }),
  )

  it.effect("NotLoggedIn stops immediately", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({
        respond,
        failures: new Map([[1, new NotLoggedIn({ runner: "claude-code", detail: "" })]]),
      })
      const error = yield* Effect.flip(run(fake, makeMemoryCache(), { ...options, concurrency: 1 }))
      expect(error._tag).toBe("NotLoggedIn")
      expect(fake.calls()).toBe(1)
    }),
  )

  it.effect("RateLimited stops sending new chunks; finished ones stay cached", () =>
    Effect.gen(function* () {
      const cache = makeMemoryCache()
      const fake = makeFakeLlmRunner({
        respond,
        failures: new Map([[3, new RateLimited({ runner: "claude-code", detail: "" })]]),
      })
      const error = yield* Effect.flip(run(fake, cache, { ...options, concurrency: 1 }))
      expect(error._tag).toBe("RateLimited")
      expect(fake.calls()).toBe(3)
      expect(cache.entries.size).toBe(2)
    }),
  )

  it.effect("interrupting keeps completed chunks in the cache", () =>
    Effect.gen(function* () {
      const cache = makeMemoryCache()
      const fake = makeFakeLlmRunner({ respond, failures: new Map([[3, "hang"]]) })
      const fiber = yield* Effect.forkChild(run(fake, cache, { ...options, concurrency: 1 }))
      yield* TestClock.adjust("1 second")
      yield* Fiber.interrupt(fiber)
      expect(cache.entries.size).toBe(2)
    }),
  )

  it.effect("plan reports chunks, cache hits and LLM calls", () =>
    Effect.gen(function* () {
      const cache = makeMemoryCache()
      const before = yield* plan({ prompts, options, runner: "claude-code" }).pipe(
        Effect.provideService(AnalysisCache, cache),
      )
      expect(before.cacheHits).toBe(0)
      expect(before.llmCalls).toBe(before.chunks.length + 1)
      yield* run(makeFakeLlmRunner({ respond }), cache)
      const after = yield* plan({ prompts, options, runner: "claude-code" }).pipe(
        Effect.provideService(AnalysisCache, cache),
      )
      expect(after.cacheHits).toBe(after.chunks.length)
      expect(after.llmCalls).toBe(1)
      expect(after.charsToSend).toBe(0)
    }),
  )

  it.effect("no prompts → AnalysisFailed", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        analyze({ prompts: [], stats, options }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Layer.succeed(LlmRunner, makeFakeLlmRunner({ respond })),
              Layer.succeed(AnalysisCache, makeMemoryCache()),
              Layer.succeed(Progress, silentProgress),
            ),
          ),
        ),
      )
      expect(error._tag).toBe("AnalysisFailed")
    }),
  )
})
