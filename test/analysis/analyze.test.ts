import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect, Fiber, Layer, Schema } from "effect"
import { TestClock } from "effect/testing"
import { analyze, plan, type AnalyzeOptions } from "../../src/analysis/index.ts"
import { MAX_EVIDENCE_PER_OBSERVATION } from "../../src/analysis/merge.ts"
import { AnalysisCache, makeMemoryCache } from "../../src/analysis/cache.ts"
import { Progress, silentProgress } from "../../src/analysis/progress.ts"
import { Profile } from "../../src/domain/Profile.ts"
import type { SafePrompt } from "../../src/domain/SafePrompt.ts"
import { processRecords } from "../../src/pipeline/index.ts"
import { makeFakeLlmRunner, type FakeOptions } from "../../src/llm/fake.ts"
import { LlmRunner, NotLoggedIn, ProcessFailed, RateLimited } from "../../src/llm/LlmRunner.ts"
import { makePrompts } from "./fixtures.ts"

const options: AnalyzeOptions = {
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
          claim: "works steadily",
          evidence: [{ promptId: m[1], quote: m[2] }],
        },
        {
          dimension: "growth",
          claim: "a made-up observation",
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
    headline: "A steady developer",
    archetype: { name: "The Steady Shipper", description: "Writes every day." },
    dimensions: ["work_style", "communication", "tech_profile", "interests", "growth"].map(
      (key) => ({
        key,
        title: key,
        summary: "summary",
        evidence: key === "work_style" ? evidence.slice(0, 2) : [],
      }),
    ),
    traits: [
      { name: "steady", description: "d", confidence: "high", evidence: evidence.slice(0, 3) },
      {
        name: "single source",
        description: "d",
        confidence: "high",
        evidence: evidence.slice(0, 1),
      },
      {
        name: "made up",
        description: "d",
        confidence: "medium",
        evidence: [{ promptId: "x", quote: "y" }],
      },
    ],
    funFacts: ["longest streak: 3 days"],
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
  it.effect("the reduce step gets weekday counts by name, not by position", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({ respond })
      const grid = Array.from({ length: 7 }, (_row, d) =>
        Array.from({ length: 24 }, (_cell, h) => d * 100 + h),
      )
      const labelled = { ...stats, weekdayHistogram: [1, 2, 3, 4, 5, 0, 7], activityGrid: grid }
      yield* analyze({ prompts, stats: labelled, options }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(LlmRunner, fake),
            Layer.succeed(AnalysisCache, makeMemoryCache()),
            Layer.succeed(Progress, silentProgress),
          ),
        ),
      )
      const sent = JSON.parse(/\n\nstats:\n(.*)$/s.exec(fake.log.at(-1)!.prompt)![1]!)
      expect(sent.weekdayHistogram).toEqual({
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 0,
        Sunday: 7,
      })
      expect(sent.activityGrid.Saturday[3]).toBe(503)
      // per-project activity stays local: project names by day are not needed for the text
      expect(sent.activity).toBeUndefined()
    }),
  )

  it.effect("produces a valid, verified Profile", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({ respond })
      const profile = yield* run(fake)
      expect(Schema.is(Profile)(profile)).toBe(true)
      expect(profile.traits.map((t) => [t.name, t.confidence])).toEqual([
        ["steady", "high"],
        // one quote from one session: downgraded, then capped by its spread
        ["single source", "low"],
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
        analysisVersion: "8",
      })
      // the profile is written in English
      expect(fake.log[0]!.system).toContain("in English")
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

  it.effect("cache keys include the model", () =>
    Effect.gen(function* () {
      const cache = makeMemoryCache()
      yield* run(makeFakeLlmRunner({ respond }), cache)
      const other = makeFakeLlmRunner({ respond })
      yield* run(other, cache, { ...options, model: "another-model" })
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

  /** Fake translation: prefix every string of the text-only profile it receives. */
  const translating: FakeOptions["respond"] = (input) => {
    if (input.schemaName !== "LlmTranslation") return respond(input)
    const text = JSON.parse(/\nprofile:\n(.*)$/s.exec(input.prompt)![1]!)
    const tr = (x: unknown): unknown =>
      typeof x === "string"
        ? `ZH ${x}`
        : Array.isArray(x)
          ? x.map(tr)
          : Object.fromEntries(
              Object.entries(x as object).map(([k, v]) => [k, k === "key" ? v : tr(v)]),
            )
    return tr(text)
  }

  it.effect("translates generated text into each extra language, keeping evidence once", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({ respond: translating })
      const profile = yield* run(fake, makeMemoryCache(), {
        ...options,
        languages: ["zh-TW", "en"],
      })
      expect(profile.languages).toEqual(["zh-TW", "en"])
      const zh = profile.translations["zh-TW"]!
      expect(zh.headline).toBe(`ZH ${profile.headline}`)
      expect(zh.traits.map((t) => t.name)).toEqual(profile.traits.map((t) => `ZH ${t.name}`))
      expect(zh.dimensions.map((d) => d.key)).toEqual(profile.dimensions.map((d) => d.key))
      const call = fake.log.find((c) => c.schema === "LlmTranslation")!
      expect(call.prompt).toContain("language: zh-TW")
      // quotes never go to the translation call
      for (const e of profile.traits.flatMap((t) => t.evidence))
        expect(call.prompt).not.toContain(e.quote)
      expect(Schema.is(Profile)(profile)).toBe(true)
    }),
  )

  it.effect("a malformed or failed translation drops only that language", () =>
    Effect.gen(function* () {
      const bad: FakeOptions["respond"] = (input) => {
        if (input.schemaName !== "LlmTranslation") return respond(input)
        const t = translating(input) as { traits: Array<unknown> }
        return { ...t, traits: t.traits.slice(1) }
      }
      const profile = yield* run(makeFakeLlmRunner({ respond: bad }), makeMemoryCache(), {
        ...options,
        languages: ["zh-TW", "en"],
      })
      expect(profile.languages).toEqual(["en"])
      expect(profile.translations).toEqual({})
      expect(profile.traits.length).toBeGreaterThan(0)
    }),
  )

  it.effect("the call estimate includes one translation per extra language", () =>
    Effect.gen(function* () {
      const p = yield* plan({
        prompts,
        options: { ...options, languages: ["zh-TW", "en"] },
        runner: "claude-code",
      }).pipe(Effect.provideService(AnalysisCache, makeMemoryCache()))
      expect(p.llmCalls).toBe(p.chunks.length + 2)
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

  it.effect("never sends oversized observations to reduce after a merge fails to shrink", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({ respond })
      const error = yield* Effect.flip(
        run(fake, makeMemoryCache(), { ...options, reduceInputLimit: 300 }),
      )
      expect(error).toMatchObject({ _tag: "AnalysisFailed", reason: "input-too-large" })
      expect(fake.log.some((c) => c.schema === "LlmProfileDraft")).toBe(false)
    }),
  )

  describe("intermediate merges", () => {
    const small = { ...options, reduceInputLimit: 300 }
    /** Merge calls return an extra observation whose quote was never said. */
    const fabricatingMerge: FakeOptions["respond"] = (input) =>
      input.schemaName === "LlmChunkObservations" && input.prompt.startsWith("[")
        ? {
            observations: [
              ...(JSON.parse(input.prompt) as Array<unknown>).slice(0, 1),
              {
                dimension: "growth",
                claim: "a made-up merged observation",
                evidence: [{ promptId: prompts[0]!.id, quote: "merge made this up" }],
              },
            ],
          }
        : respond(input)

    it.effect("merge output is verified, also when it comes from the cache", () =>
      Effect.gen(function* () {
        const cache = makeMemoryCache()
        const first = makeFakeLlmRunner({ respond: fabricatingMerge })
        const mergeOptions = { ...options, reduceInputLimit: 1_000 }
        yield* run(first, cache, mergeOptions)
        expect(first.log.some((c) => c.prompt.startsWith("["))).toBe(true)
        const second = makeFakeLlmRunner({ respond: fabricatingMerge })
        yield* run(second, cache, mergeOptions)
        expect(second.calls()).toBe(1) // map and merge cached; only reduce is sent
        expect(second.log[0]!.prompt).not.toContain("merge made this up")
      }),
    )

    /** Map: one observation citing every prompt of the chunk (all verifiable). Merge: all
     * evidence of the group in one observation (an LLM ignoring the cap). */
    const greedy: FakeOptions["respond"] = (input) => {
      if (input.schemaName !== "LlmChunkObservations") return respond(input)
      const all = input.prompt.startsWith("[")
        ? (JSON.parse(input.prompt) as Array<{ evidence: Array<unknown> }>).flatMap(
            (o) => o.evidence,
          )
        : [...input.prompt.matchAll(/<prompt id="([^"]+)"[^>]*>\n(.{0,30})/g)].map((m) => ({
            promptId: m[1],
            quote: m[2],
          }))
      return { observations: [{ dimension: "work_style", claim: "c", evidence: all }] }
    }
    const evidenceCounts = (prompt: string): Array<number> =>
      (JSON.parse(prompt) as Array<{ evidence: Array<unknown> }>).map((o) => o.evidence.length)
    /** Several observations per merge group, so a greedy merge exceeds the cap. */
    const grouped = { ...options, reduceInputLimit: 2_000 }
    const reduceObservations = (fake: ReturnType<typeof makeFakeLlmRunner>) =>
      /observations:\n(.*)\n\nstats:/s.exec(fake.log.at(-1)!.prompt)![1]!

    it.effect("merge and reduce inputs carry at most MAX_EVIDENCE_PER_OBSERVATION quotes", () =>
      Effect.gen(function* () {
        const fake = makeFakeLlmRunner({ respond: greedy })
        yield* run(fake, makeMemoryCache(), grouped)
        const merges = fake.log.filter((c) => c.prompt.startsWith("["))
        expect(merges.length).toBeGreaterThan(0)
        for (const prompt of [...merges.map((c) => c.prompt), reduceObservations(fake)]) {
          for (const n of evidenceCounts(prompt)) {
            expect(n).toBeLessThanOrEqual(MAX_EVIDENCE_PER_OBSERVATION)
          }
        }
      }),
    )

    it.effect("a merge result read from the cache is capped too", () =>
      Effect.gen(function* () {
        // the cache stores what the (greedy) merge returned, uncapped
        const cache = makeMemoryCache()
        yield* run(makeFakeLlmRunner({ respond: greedy }), cache, grouped)
        const uncapped = [...cache.entries.values()].filter(
          (e) =>
            e.kind === "merge" &&
            e.value.observations.some((o) => o.evidence.length > MAX_EVIDENCE_PER_OBSERVATION),
        )
        expect(uncapped.length).toBeGreaterThan(0)
        const second = makeFakeLlmRunner({ respond: greedy })
        yield* run(second, cache, grouped)
        expect(second.calls()).toBe(1) // reduce only
        for (const n of evidenceCounts(reduceObservations(second))) {
          expect(n).toBeLessThanOrEqual(MAX_EVIDENCE_PER_OBSERVATION)
        }
      }),
    )

    it.effect("stops merging when a round does not shrink the observations", () =>
      Effect.gen(function* () {
        // fabricatingMerge returns more than it was given
        let rounds = 0
        yield* analyze({ prompts, stats, options: small }).pipe(
          Effect.result,
          Effect.provide(
            Layer.mergeAll(
              Layer.succeed(LlmRunner, makeFakeLlmRunner({ respond: fabricatingMerge })),
              Layer.succeed(AnalysisCache, makeMemoryCache()),
              Layer.succeed(Progress, {
                ...silentProgress,
                onMergeStart: () => Effect.sync(() => void rounds++),
              }),
            ),
          ),
        )
        expect(rounds).toBe(1)
      }),
    )

    it.effect("a fatal error during a merge is not wrapped", () =>
      Effect.gen(function* () {
        const mapCalls = makeFakeLlmRunner({ respond })
        yield* Effect.result(run(mapCalls, makeMemoryCache(), small))
        const chunks = mapCalls.log.filter((c) => !c.prompt.startsWith("[")).length
        const fake = makeFakeLlmRunner({
          respond,
          failures: new Map([[chunks + 1, new NotLoggedIn({ runner: "claude-code", detail: "" })]]),
        })
        const error = yield* Effect.flip(run(fake, makeMemoryCache(), { ...small, concurrency: 1 }))
        expect(error._tag).toBe("NotLoggedIn")
      }),
    )
  })

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
