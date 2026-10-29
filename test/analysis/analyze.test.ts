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
  timezone: "Asia/Taipei",
  full: false,
  noCache: false,
  model: null,
}

/** A fake LLM that quotes the first prompt of each chunk, and builds the profile from observations. */
const respond: FakeOptions["respond"] = ({ prompt, schemaName }) => {
  // merge step: pass observations through
  if (schemaName === "LlmChunkObservations") return { observations: JSON.parse(prompt) }
  if (schemaName === "LlmChunkAnalysis") {
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
      episodes: [],
      interventions: [],
    }
  }
  const obs = JSON.parse(/observations:\n(.*)\n\nstats:/s.exec(prompt)![1]!) as Array<{
    evidence: Array<{ promptId: string; quote: string }>
  }>
  const evidence = obs.flatMap((o) => o.evidence)
  return {
    portrait: null,
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
    patterns: [],
    improvements: [
      {
        title: "Say the goal first",
        pattern: "p",
        impact: "i",
        suggestion: "s",
        evidence: evidence.slice(0, 1),
        rewrite: { promptId: evidence[0]?.promptId ?? "", after: "Do X, then Y." },
      },
      {
        title: "invented",
        pattern: "p",
        impact: "i",
        suggestion: "s",
        evidence: [{ promptId: "x", quote: "y" }],
        rewrite: { promptId: "", after: "" },
      },
    ],
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
  it.effect(
    "rejects global narrative summaries when part of their supporting narrative is fabricated",
    () =>
      Effect.gen(function* () {
        const fake = makeFakeLlmRunner({
          respond: (input) => {
            const response = respond!(input) as Record<string, unknown>
            if (input.schemaName !== "LlmProfileDraft") return response
            const observations = JSON.parse(
              /observations:\n(.*)\n\nstats:/s.exec(input.prompt)![1]!,
            ) as Array<{ evidence: Array<{ promptId: string; quote: string }> }>
            const evidence = observations.flatMap((o) => o.evidence).slice(0, 4)
            return {
              ...response,
              portrait: {
                introduction: "This developer sets a direction and delegates implementation.",
                chapters: [
                  {
                    title: "A clear destination",
                    body: "They state the goal before choosing a route.",
                    evidence,
                  },
                  {
                    title: "Invented episode",
                    body: "Unsupported.",
                    evidence: [{ promptId: "missing", quote: "never said" }],
                  },
                ],
                axes: ["framing", "pacing", "control", "closure"].map((key) => ({
                  key,
                  explanation: "Observed across conversations.",
                  sides: [{ pole: "first", context: "c", evidence }],
                })),
              },
            }
          },
        })
        const p = yield* run(fake)
        expect(p.portrait).toBeNull()
        expect(p.headline).toBe("Collaboration observations")
        expect(p.archetype.description).toBe("")
      }),
  )

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
        // the made-up trait quote and the made-up improvement quote
        evidenceDropped: 2,
      })
      expect(profile.improvements.map((i) => [i.title, i.rewrite !== null])).toEqual([
        ["Say the goal first", true],
      ])
      expect(profile.engine).toEqual({
        runner: "claude-code",
        model: "fake-model",
        effort: null,
        analysisVersion: "16",
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

  it.effect("records the requested reasoning effort with the engine", () =>
    Effect.gen(function* () {
      const profile = yield* run(makeFakeLlmRunner({ respond }), makeMemoryCache(), {
        ...options,
        effort: "medium",
      })
      expect(profile.engine.effort).toBe("medium")
      expect((yield* run(makeFakeLlmRunner({ respond }))).engine.effort).toBeNull()
    }),
  )

  it.effect("second run hits the cache for every chunk", () =>
    Effect.gen(function* () {
      const cache = makeMemoryCache()
      const first = makeFakeLlmRunner({ respond })
      yield* run(first, cache)
      const chunkCalls = first.log.filter((c) => c.schema === "LlmChunkAnalysis").length
      expect(chunkCalls).toBeGreaterThan(1)
      const second = makeFakeLlmRunner({ respond })
      const profile = yield* run(second, cache)
      expect(second.log.filter((c) => c.schema === "LlmChunkAnalysis")).toHaveLength(0)
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
      x === null
        ? null
        : typeof x === "string"
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

    it.effect("a failed merge is reported as a merge failure, not a final-step failure", () =>
      Effect.gen(function* () {
        const failed = new ProcessFailed({
          runner: "claude-code",
          exitCode: 1,
          detail: "x",
          stderrTail: "",
        })
        const fake = makeFakeLlmRunner({
          respond,
          failures: new Map(Array.from({ length: 40 }, (_, i) => [i + 1, failed] as const)),
        })
        // every chunk call succeeds from the cache of a first run; then merges fail
        const cache = makeMemoryCache()
        yield* Effect.flip(run(makeFakeLlmRunner({ respond }), cache, small)).pipe(Effect.ignore)
        const error = yield* Effect.flip(run(fake, cache, { ...options, reduceInputLimit: 1_000 }))
        expect(error).toMatchObject({ _tag: "AnalysisFailed", reason: "merge-failed" })
        expect(fake.log.every((c) => c.prompt.startsWith("["))).toBe(true)
      }),
    )

    it.effect("merge output is verified, also when it comes from the cache", () =>
      Effect.gen(function* () {
        const cache = makeMemoryCache()
        const first = makeFakeLlmRunner({ respond: fabricatingMerge })
        const mergeOptions = { ...options, reduceInputLimit: 1_000 }
        const firstError = yield* Effect.flip(run(first, cache, mergeOptions))
        expect(firstError).toMatchObject({ reason: "input-too-large" })
        expect(first.log.some((c) => c.prompt.startsWith("["))).toBe(true)
        const second = makeFakeLlmRunner({ respond: fabricatingMerge })
        const secondError = yield* Effect.flip(run(second, cache, mergeOptions))
        expect(secondError).toMatchObject({ reason: "input-too-large" })
        expect(second.calls()).toBe(0) // verified cached merges still preserve omitted evidence
        expect(
          first.log
            .filter((c) => c.prompt.startsWith("["))
            .every((c) => !c.prompt.includes("merge made this up")),
        ).toBe(true)
      }),
    )

    /** Map: one observation citing every prompt of the chunk (all verifiable). Merge: all
     * evidence of the group in one observation (an LLM ignoring the cap). */
    const greedy: FakeOptions["respond"] = (input) => {
      if (!input.schemaName.startsWith("LlmChunk")) return respond(input)
      const all = input.prompt.startsWith("[")
        ? (JSON.parse(input.prompt) as Array<{ evidence: Array<unknown> }>).flatMap(
            (o) => o.evidence,
          )
        : [...input.prompt.matchAll(/<prompt id="([^"]+)"[^>]*>\n(.{0,30})/g)].map((m) => ({
            promptId: m[1],
            quote: m[2],
          }))
      return {
        observations: [{ dimension: "work_style", claim: "c", evidence: all }],
        episodes: [],
        interventions: [],
      }
    }
    it.effect("fails explicitly when the observations cannot fit the input cap", () =>
      Effect.gen(function* () {
        const cache = makeMemoryCache()
        const opts = { ...options, reduceInputLimit: 2_000 }
        for (let repeat = 0; repeat < 2; repeat++) {
          const fake = makeFakeLlmRunner({ respond: greedy })
          const error = yield* Effect.flip(run(fake, cache, opts))
          expect(error).toMatchObject({ reason: "input-too-large" })
          expect(fake.log.some((c) => c.schema === "LlmProfileDraft")).toBe(false)
        }
      }),
    )

    /** Map: one observation per chunk with two quotes. Merge: one claim per group, keeping
     * the first quote of each observation (as a real merge keeps at most 4 per claim). */
    const trimmingMerge: FakeOptions["respond"] = (input) => {
      if (input.schemaName === "LlmChunkAnalysis") {
        const [a, b] = [...input.prompt.matchAll(/<prompt id="([^"]+)"[^>]*>\n(.{0,30})/g)]
        return {
          observations: [
            {
              dimension: "work_style",
              claim: "works in small steps",
              evidence: [a!, b ?? a!].map((m) => ({ promptId: m[1], quote: m[2] })),
            },
          ],
          episodes: [],
          interventions: [],
        }
      }
      if (input.schemaName === "LlmChunkObservations") {
        const group = JSON.parse(input.prompt) as Array<{ evidence: Array<unknown> }>
        return {
          observations: [
            {
              dimension: "work_style",
              claim: "works in small steps",
              evidence: group.map((o) => o.evidence[0]),
            },
          ],
        }
      }
      return respond(input)
    }
    it.effect("a merge that trims quotes of the claims it keeps shrinks a large history", () =>
      Effect.gen(function* () {
        const fake = makeFakeLlmRunner({ respond: trimmingMerge })
        const profile = yield* run(fake, makeMemoryCache(), { ...options, reduceInputLimit: 2_500 })
        expect(fake.log.some((c) => c.prompt.startsWith("["))).toBe(true)
        expect(fake.log.some((c) => c.schema === "LlmProfileDraft")).toBe(true)
        expect(profile.dimensions.length).toBe(5)
      }),
    )

    /** Map: three similar observations per chunk. Merge: only as far as it is asked to, by
     * "at most N observations" in its instructions; otherwise it changes nothing. Every input
     * observation keeps its first quote, at most 4 quotes per merged observation. */
    const budgetedMerge: FakeOptions["respond"] = (input) => {
      if (input.schemaName === "LlmChunkAnalysis") {
        const found = [...input.prompt.matchAll(/<prompt id="([^"]+)"[^>]*>\n(.{0,30})/g)]
        return {
          observations: [0, 1, 2].map((i) => ({
            dimension: "work_style",
            claim: `works in small steps, variant ${i} ${"padding ".repeat(20)}`,
            evidence: [found[i % found.length]!].map((m) => ({ promptId: m[1], quote: m[2] })),
          })),
          episodes: [],
          interventions: [],
        }
      }
      if (input.schemaName === "LlmChunkObservations") {
        const group = JSON.parse(input.prompt) as Array<{ evidence: Array<unknown> }>
        const max = Number(
          /Return at most (\d+) observations/.exec(input.system)?.[1] ?? group.length,
        )
        const size = Math.ceil(group.length / max)
        return {
          observations: Array.from({ length: Math.ceil(group.length / size) }, (_, i) => ({
            dimension: "work_style",
            claim: "works in small steps",
            evidence: group.slice(i * size, i * size + size).map((o) => o.evidence[0]),
          })),
        }
      }
      return respond(input)
    }
    it.effect("tells each merge how many observations to return, so a large history fits", () =>
      Effect.gen(function* () {
        const fake = makeFakeLlmRunner({ respond: budgetedMerge })
        const profile = yield* run(fake, makeMemoryCache(), { ...options, reduceInputLimit: 8_000 })
        const merges = fake.log.filter((c) => c.prompt.startsWith("["))
        expect(merges.length).toBeGreaterThan(0)
        expect(merges.every((c) => /Return at most \d+ observations/.test(c.system))).toBe(true)
        expect(fake.log.some((c) => c.schema === "LlmProfileDraft")).toBe(true)
        expect(profile.dimensions.length).toBe(5)
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

it.effect("cannot keep an unsupported headline when reduce supplies no body evidence", () =>
  Effect.gen(function* () {
    const fake = makeFakeLlmRunner({
      respond: (input) => {
        const value = respond(input) as Record<string, unknown>
        return input.schemaName === "LlmProfileDraft"
          ? {
              ...value,
              headline: "They mastered every framework.",
              traits: [],
              improvements: [],
              dimensions: [],
              portrait: null,
            }
          : value
      },
    })
    const profile = yield* run(fake)
    expect(profile.headline).toBe("Collaboration observations")
    expect(profile.archetype.description).toBe("")
  }),
)

describe("interaction episodes", () => {
  /** Hand-written sessions of three prompts each, one session per day. */
  const steps = [
    "Add a CSV export to the invoice list.",
    "same for the payments table",
    "No, keep the existing download API.",
  ]
  const sessions = Array.from({ length: 4 }, (_, day) =>
    steps.map((text, turn): SafePrompt => ({
      id: `claude-code:e${day}:${turn}`,
      sessionId: `e${day}`,
      source: "claude-code",
      timestamp: DateTime.makeUnsafe(Date.UTC(2026, 8, 7 + day * 8, 1, turn * 5)),
      project: "invoices",
      text: `${text} ${"x".repeat(2000)}`,
    })),
  ).flat()

  const blocks = (chunk: string) =>
    [
      ...chunk.matchAll(
        /<prompt id="([^"]+)" session="([^"]+)" turn="(\d+)\/\d+"[^>]*>\n(.{0,25})/g,
      ),
    ].map((m) => ({ promptId: m[1]!, session: m[2]!, quote: m[4]! }))

  const episodeRespond: FakeOptions["respond"] = (input) => {
    if (input.schemaName === "LlmChunkAnalysis") {
      const found = blocks(input.prompt)
      const bySession = new Map<string, typeof found>()
      for (const b of found) bySession.set(b.session, [...(bySession.get(b.session) ?? []), b])
      const roles = ["ask", "context", "correct"] as const
      return {
        observations: [],
        interventions: [],
        episodes: [
          ...[...bySession].map(([session, turns]) => ({
            session,
            taskType: "build",
            task: "Adding an export",
            turns: turns.map((t, i) => ({ promptId: t.promptId, quote: t.quote, role: roles[i] })),
            ending: { kind: "user_reported", promptId: "" },
          })),
          // two sessions stitched into one conversation
          ...(bySession.size > 1
            ? [
                {
                  session: found[0]!.session,
                  taskType: "fix",
                  task: "stitched",
                  turns: [found[0]!, found.at(-1)!].map((t) => ({ ...t, role: "ask" })),
                  ending: { kind: "unknown", promptId: "" },
                },
              ]
            : []),
        ],
      }
    }
    if (input.schemaName === "LlmTranslation") {
      const profile = JSON.parse(/\nprofile:\n(.*)$/s.exec(input.prompt)![1]!)
      return {
        ...profile,
        episodes: profile.episodes.map((e: { task: string }) => ({ task: `zh ${e.task}` })),
      }
    }
    const draft = respond!(input) as Record<string, unknown>
    if (input.schemaName !== "LlmProfileDraft") return draft
    const episodes = JSON.parse(/\n\nepisodes:\n(.*)\n\nobservations:/s.exec(input.prompt)![1]!)
    const ids = episodes.map((e: { id: string }) => e.id)
    return {
      ...draft,
      patterns: [
        { claim: "Adds scope after the first request", episodeIds: ids, counterEpisodeIds: [] },
        { claim: "seen once", episodeIds: ids.slice(0, 1), counterEpisodeIds: [] },
      ],
    }
  }

  it.effect("measures steering per conversation from verified follow-up labels", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({
        respond: (input) => {
          if (input.schemaName !== "LlmChunkAnalysis") return respond!(input)
          const found = [
            ...input.prompt.matchAll(
              /<prompt id="([^"]+)" session="[^"]+" turn="(\d+)\/\d+"[^>]*>\n(.{0,25})/g,
            ),
          ]
          return {
            observations: [],
            episodes: [],
            // every third turn steers; the first turn is labelled too, and must be rejected
            interventions: found
              .filter((m) => m[2] === "3" || m[2] === "1")
              .map((m) => ({ promptId: m[1], kind: "steer", quote: m[3] })),
          }
        },
      })
      const profile = yield* analyze({ prompts: sessions, stats, options }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(LlmRunner, fake),
            Layer.succeed(AnalysisCache, makeMemoryCache()),
            Layer.succeed(Progress, silentProgress),
          ),
        ),
      )
      expect(profile.steering).toMatchObject({
        conversations: 4,
        withFollowUps: 4,
        followUpPrompts: 8,
        steer: { conversations: 4, prompts: 4 },
        repair: { conversations: 0, prompts: 0, examples: [] },
        rejected: 4,
      })
      expect(profile.steering!.steer.examples).toHaveLength(2)
    }),
  )

  it.effect("verifies, selects and keeps episodes with their order and spread", () =>
    Effect.gen(function* () {
      const fake = makeFakeLlmRunner({ respond: episodeRespond })
      const profile = yield* analyze({
        prompts: sessions,
        stats,
        options: { ...options, languages: ["en", "zh-TW"] },
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.succeed(LlmRunner, fake),
            Layer.succeed(AnalysisCache, makeMemoryCache()),
            Layer.succeed(Progress, silentProgress),
          ),
        ),
      )
      expect(Schema.is(Profile)(profile)).toBe(true)
      expect(profile.episodes.map((e) => [e.id, e.session])).toEqual([
        ["E1", "claude-code:e0"],
        ["E2", "claude-code:e1"],
        ["E3", "claude-code:e2"],
        ["E4", "claude-code:e3"],
      ])
      expect(profile.episodes[0]!.turns.map((t) => [t.turn, t.role])).toEqual([
        [1, "ask"],
        [2, "context"],
        [3, "correct"],
      ])
      // an ending that cites no turn is not a result
      expect(profile.episodes.every((e) => e.ending.kind === "unknown")).toBe(true)
      const stitched = profile.coverage.episodes!.rejected.mixedSessions
      expect(stitched).toBeGreaterThan(0)
      expect(profile.coverage.episodes).toMatchObject({
        found: 4 + stitched,
        kept: 4,
        selected: 4,
        endingsWithdrawn: 4,
        patternsDropped: 1,
      })
      expect(profile.patterns).toEqual([
        {
          claim: "Adds scope after the first request",
          episodeIds: ["E1", "E2", "E3", "E4"],
          counterEpisodeIds: [],
          support: { sessions: 4, weeks: profile.coverage.chunksAnalyzed },
          taskTypes: ["build"],
        },
      ])
      expect(profile.translations["zh-TW"]!.episodes[0]).toEqual({ task: "zh Adding an export" })
      // the reduce step sees turn numbers, never the rejected conversation
      const reduce = fake.log.find((c) => c.schema === "LlmProfileDraft")!.prompt
      expect(reduce).toContain('"turn":3,"role":"correct"')
      expect(reduce).not.toContain("stitched")
    }),
  )
})
