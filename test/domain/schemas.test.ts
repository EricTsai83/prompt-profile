import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect, Exit, Schema } from "effect"
import { readFileSync } from "node:fs"
import { ChunkObservations } from "../../src/domain/ChunkObservations.ts"
import {
  decodeProfile,
  encodeProfile,
  Profile,
  LlmTranslation,
  UnsupportedProfileVersion,
} from "../../src/domain/Profile.ts"
import { PromptRecord } from "../../src/domain/PromptRecord.ts"
import { Stats } from "../../src/domain/Stats.ts"
import {
  fromLlmChunkObservations,
  fromLlmProfileDraft,
  LlmChunkAnalysis,
  LlmChunkObservations,
  LlmProfileDraft,
  truncateQuote,
} from "../../src/domain/llm/LlmSchemas.ts"
import { toLlmJsonSchema, validateLlmJsonSchema } from "../../src/domain/llm/toLlmJsonSchema.ts"

const loadSample = (): unknown =>
  JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8"))

const validRecord = {
  id: "claude-code:s1:u1",
  source: "claude-code",
  sessionId: "s1",
  timestamp: "2026-09-03T15:41:00.000Z",
  project: "/home/dev/proj",
  gitBranch: "main",
  text: "hello",
  hasImage: false,
  origin: "interactive",
  client: "cli",
}

const decodes = (schema: Schema.Top, input: unknown) =>
  Exit.isSuccess(Schema.decodeUnknownExit(schema as Schema.Codec<unknown, unknown>)(input))

describe("PromptRecord", () => {
  it("decodes valid data into DateTime.Utc", () => {
    const r = Schema.decodeUnknownSync(PromptRecord)(validRecord)
    expect(DateTime.isDateTime(r.timestamp)).toBe(true)
  })
  it.each([
    ["unknown source", { ...validRecord, source: "cursor" }],
    ["bad timestamp", { ...validRecord, timestamp: "yesterday" }],
    ["bad origin", { ...validRecord, origin: "robot" }],
    ["missing text", { ...validRecord, text: undefined }],
  ])("rejects %s", (_name, input) => {
    expect(decodes(PromptRecord, input)).toBe(false)
  })
})

describe("Stats", () => {
  const stats = (loadSample() as { stats: Record<string, unknown> }).stats
  it("decodes valid data", () => expect(decodes(Stats, stats)).toBe(true))
  it.each([
    ["hourHistogram with 23 buckets", { ...stats, hourHistogram: Array(23).fill(0) }],
    ["ratio > 1", { ...stats, correctionRate: 1.5 }],
    ["negative count", { ...stats, totalPrompts: -1 }],
    ["missing source key", { ...stats, bySource: { "claude-code": 1 } }],
  ])("rejects %s", (_name, input) => expect(decodes(Stats, input)).toBe(false))
})

describe("Profile", () => {
  it("the sample decodes", () => {
    expect(decodes(Profile, loadSample())).toBe(true)
  })

  it.effect("round-trips encode → JSON → decode", () =>
    Effect.gen(function* () {
      const profile = yield* decodeProfile(loadSample())
      const json = JSON.stringify(encodeProfile(profile))
      const again = yield* decodeProfile(JSON.parse(json))
      expect(encodeProfile(again)).toEqual(encodeProfile(profile))
      expect(JSON.parse(json)).toEqual(loadSample())
    }),
  )

  it.effect.each([8, 14])(
    "reads released profile schema %s without inventing newer measurements",
    (schemaVersion) =>
      Effect.gen(function* () {
        const sample = loadSample() as Record<string, any>
        for (const key of [
          "generation",
          "voice",
          "context",
          "collaboration",
          "narrative",
          "historyComparison",
          "evidenceOrigins",
          "experiments",
        ])
          delete sample[key]
        if (schemaVersion === 8) {
          for (const key of ["portrait", "usage", "episodes", "patterns", "steering"])
            delete sample[key]
          delete sample["coverage"].episodes
          delete sample["engine"].effort
          for (const translation of Object.values(sample["translations"]) as Array<
            Record<string, unknown>
          >) {
            for (const key of ["portrait", "episodes", "patterns"]) delete translation[key]
          }
        }
        const profile = yield* decodeProfile({ ...sample, schemaVersion })
        expect(profile.schemaVersion).toBe(20)
        expect(profile.headline).toBe(sample["headline"])
        expect(profile.dimensions[0]!.evidence[0]!.quote).toBe(
          sample["dimensions"][0].evidence[0].quote,
        )
        expect(profile.generation).toBeNull()
        expect(profile.voice).toBeUndefined()
        expect(profile.context).toBeUndefined()
        if (schemaVersion === 8) {
          expect(profile.portrait).toBeUndefined()
          expect(profile.usage).toBeNull()
          expect(profile.episodes).toEqual([])
          expect(profile.steering).toBeNull()
        }
      }),
  )

  it.effect("a translation must cover every episode and pattern", () =>
    Effect.gen(function* () {
      const sample = loadSample() as Record<string, any>
      const zh = { ...sample["translations"]["zh-TW"], episodes: [] }
      const error = yield* Effect.flip(decodeProfile({ ...sample, translations: { "zh-TW": zh } }))
      expect(error._tag).toBe("InvalidProfile")
    }),
  )

  it.effect("the sample carries a measured usage section", () =>
    Effect.gen(function* () {
      const profile = yield* decodeProfile(loadSample())
      expect(profile.usage?.sources.map((s) => s.source)).toEqual(["claude-code", "codex"])
    }),
  )

  it.effect("a negative token count → InvalidProfile", () =>
    Effect.gen(function* () {
      const sample = loadSample() as { usage: { sources: Array<Record<string, unknown>> } }
      const [first, ...rest] = sample.usage.sources
      const totals = first!["totals"] as { tokens: Record<string, number> }
      const bad = {
        ...first,
        totals: { ...totals, tokens: { ...totals.tokens, input: -1 } },
      }
      const error = yield* Effect.flip(
        decodeProfile({ ...sample, usage: { ...sample.usage, sources: [bad, ...rest] } }),
      )
      expect(error._tag).toBe("InvalidProfile")
    }),
  )

  it.effect.each([
    ["an unknown language", { languages: ["en", "fr"] }],
    ["a listed language without its translation", { translations: {} }],
    ["a translation for a language that is not listed", { languages: ["en"] }],
    ["duplicate languages", { languages: ["en", "en", "zh-TW"] }],
  ] as const)("%s → InvalidProfile", ([, patch]) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        decodeProfile({ ...(loadSample() as object), ...(patch as object) }),
      )
      expect(error._tag).toBe("InvalidProfile")
    }),
  )

  it.effect("a translation must match the English structure", () =>
    Effect.gen(function* () {
      const sample = loadSample() as {
        translations: { "zh-TW": { traits: Array<unknown>; dimensions: Array<unknown> } }
      }
      const zh = sample.translations["zh-TW"]
      for (const broken of [
        { ...zh, traits: zh.traits.slice(1) },
        { ...zh, dimensions: zh.dimensions.slice(1) },
      ]) {
        const error = yield* Effect.flip(
          decodeProfile({ ...sample, translations: { "zh-TW": broken } }),
        )
        expect(error._tag).toBe("InvalidProfile")
      }
    }),
  )

  // 1: had a `language` field; 2 is migrated (above)
  it.effect.each([1, "3", 21, undefined])(
    "unknown schemaVersion %s → UnsupportedProfileVersion",
    (v) =>
      Effect.gen(function* () {
        const input = { ...(loadSample() as object), schemaVersion: v }
        const error = yield* Effect.flip(decodeProfile(input))
        expect(error).toBeInstanceOf(UnsupportedProfileVersion)
      }),
  )

  it.effect("invalid content → InvalidProfile", () =>
    Effect.gen(function* () {
      const sample = loadSample() as { dimensions: Array<unknown> }
      const error = yield* Effect.flip(
        decodeProfile({ ...sample, dimensions: sample.dimensions.slice(1) }),
      )
      expect(error._tag).toBe("InvalidProfile")
    }),
  )

  it.effect("an invalid time zone → InvalidProfile (the report would crash on it)", () =>
    Effect.gen(function* () {
      const sample = loadSample() as { stats: Record<string, unknown> }
      const error = yield* Effect.flip(
        decodeProfile({ ...sample, stats: { ...sample.stats, timezone: ":/etc/localtime" } }),
      )
      expect(error._tag).toBe("InvalidProfile")
    }),
  )

  it("rejects quotes longer than 200 characters", () => {
    const sample = loadSample() as { traits: Array<{ evidence: Array<{ quote: string }> }> }
    const t = sample.traits[0]!
    const bad = {
      ...sample,
      traits: [{ ...t, evidence: [{ promptId: "x", quote: "a".repeat(201) }] }],
    }
    expect(decodes(Profile, bad)).toBe(false)
  })
})

describe("ChunkObservations", () => {
  it("decodes valid / rejects unknown dimension", () => {
    const ok = {
      chunkId: "c1",
      observations: [
        { dimension: "growth", claim: "x", evidence: [{ promptId: "a", quote: "b" }] },
      ],
    }
    expect(decodes(ChunkObservations, ok)).toBe(true)
    expect(
      decodes(ChunkObservations, {
        ...ok,
        observations: [{ ...ok.observations[0], dimension: "mood" }],
      }),
    ).toBe(false)
  })
})

describe("LLM schemas", () => {
  it.each([
    ["LlmChunkObservations", LlmChunkObservations],
    ["LlmChunkAnalysis", LlmChunkAnalysis],
    ["LlmProfileDraft", LlmProfileDraft],
    ["LlmTranslation", LlmTranslation],
  ] as const)("%s produces a subset-compliant JSON Schema", (_name, schema) => {
    const json = toLlmJsonSchema(schema)
    expect(validateLlmJsonSchema(json)).toEqual([])
    expect(json).toMatchSnapshot()
  })

  it("validator rejects forbidden keywords and open objects", () => {
    expect(
      validateLlmJsonSchema({
        type: "object",
        properties: { a: { type: "string", minLength: 1 }, b: { $ref: "#/$defs/B" } },
        required: ["a"],
      }),
    ).toEqual([
      "$: object must set additionalProperties: false",
      '$: every property must be listed in "required"',
      '$.properties.a: forbidden keyword "minLength"',
      '$.properties.b: forbidden keyword "$ref"',
      '$.properties.b: missing "type"',
      "$.properties.b: unsupported type undefined",
    ])
  })

  it("collapses NullOr into a type array", () => {
    const json = toLlmJsonSchema(Schema.Struct({ a: Schema.NullOr(Schema.String) })) as {
      properties: { a: unknown }
    }
    expect(json.properties.a).toEqual({ type: ["string", "null"] })
  })

  it("truncates quotes to 200 code points", () => {
    expect(Array.from(truncateQuote("字".repeat(300))).length).toBe(200)
    expect(truncateQuote("  short  ")).toBe("short")
  })

  it("fromLlmChunkObservations adds chunkId", () => {
    const result = fromLlmChunkObservations(
      {
        observations: [
          { dimension: "growth", claim: "c", evidence: [{ promptId: "p", quote: "q" }] },
        ],
      },
      "chunk-1",
    )
    expect(decodes(ChunkObservations, result)).toBe(true)
    expect(result.chunkId).toBe("chunk-1")
  })

  it.effect("fromLlmProfileDraft fills program-owned fields and normalises dimensions", () =>
    Effect.gen(function* () {
      const sample = yield* decodeProfile(loadSample())
      const draft: LlmProfileDraft = {
        narrative: null,
        collaboration: null,
        portrait: null,
        headline: "h",
        archetype: { name: "n", description: "d" },
        dimensions: [
          { key: "growth", title: "G", summary: "s", evidence: [] },
          { key: "growth", title: "dup", summary: "s", evidence: [] },
        ],
        patterns: [],
        improvements: [],
        traits: [],
        funFacts: [],
      }
      const profile = fromLlmProfileDraft(draft, sample)
      expect(profile.dimensions.map((d) => d.key)).toEqual([
        "work_style",
        "communication",
        "tech_profile",
        "interests",
        "growth",
      ])
      expect(profile.dimensions[4]!.title).toBe("G")
      expect(Schema.is(Profile)(profile)).toBe(true)
    }),
  )
})

it.effect.each([2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19])(
  "rejects unreleased profile schema %s instead of maintaining intermediate migrations",
  (schemaVersion) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        decodeProfile({ ...(loadSample() as object), schemaVersion }),
      )
      expect(error).toBeInstanceOf(UnsupportedProfileVersion)
    }),
)

it.effect("rejects the unreleased stored third-person setting", () =>
  Effect.gen(function* () {
    const result = yield* Effect.result(
      decodeProfile({ ...(loadSample() as object), voice: "third" }),
    )
    expect(result._tag).toBe("Failure")
  }),
)
