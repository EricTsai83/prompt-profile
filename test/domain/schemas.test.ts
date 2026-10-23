import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect, Exit, Schema } from "effect"
import { readFileSync } from "node:fs"
import { ChunkObservations } from "../../src/domain/ChunkObservations.ts"
import {
  decodeProfile,
  encodeProfile,
  Profile,
  UnsupportedProfileVersion,
} from "../../src/domain/Profile.ts"
import { PromptRecord } from "../../src/domain/PromptRecord.ts"
import { Stats } from "../../src/domain/Stats.ts"
import {
  fromLlmChunkObservations,
  fromLlmProfileDraft,
  LlmChunkObservations,
  LlmProfileDraft,
  truncateQuote,
} from "../../src/domain/llm/LlmSchemas.ts"
import { toLlmJsonSchema, validateLlmJsonSchema } from "../../src/domain/llm/toLlmJsonSchema.ts"

const loadSample = (lang: "zh-TW" | "en"): unknown =>
  JSON.parse(
    readFileSync(new URL(`../fixtures/profile.sample.${lang}.json`, import.meta.url), "utf8"),
  )

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
  const stats = (loadSample("en") as { stats: Record<string, unknown> }).stats
  it("decodes valid data", () => expect(decodes(Stats, stats)).toBe(true))
  it.each([
    ["hourHistogram with 23 buckets", { ...stats, hourHistogram: Array(23).fill(0) }],
    ["ratio > 1", { ...stats, correctionRate: 1.5 }],
    ["negative count", { ...stats, totalPrompts: -1 }],
    ["missing source key", { ...stats, bySource: { "claude-code": 1 } }],
  ])("rejects %s", (_name, input) => expect(decodes(Stats, input)).toBe(false))
})

describe("Profile", () => {
  it.each(["zh-TW", "en"] as const)("sample %s decodes", (lang) => {
    expect(decodes(Profile, loadSample(lang))).toBe(true)
  })

  it.effect("round-trips encode → JSON → decode", () =>
    Effect.gen(function* () {
      const profile = yield* decodeProfile(loadSample("zh-TW"))
      const json = JSON.stringify(encodeProfile(profile))
      const again = yield* decodeProfile(JSON.parse(json))
      expect(encodeProfile(again)).toEqual(encodeProfile(profile))
      expect(JSON.parse(json)).toEqual(loadSample("zh-TW"))
    }),
  )

  it.effect.each([2, "1", undefined])("unknown schemaVersion %s → UnsupportedProfileVersion", (v) =>
    Effect.gen(function* () {
      const input = { ...(loadSample("en") as object), schemaVersion: v }
      const error = yield* Effect.flip(decodeProfile(input))
      expect(error).toBeInstanceOf(UnsupportedProfileVersion)
    }),
  )

  it.effect("invalid content → InvalidProfile", () =>
    Effect.gen(function* () {
      const sample = loadSample("en") as { dimensions: Array<unknown> }
      const error = yield* Effect.flip(
        decodeProfile({ ...sample, dimensions: sample.dimensions.slice(1) }),
      )
      expect(error._tag).toBe("InvalidProfile")
    }),
  )

  it("rejects quotes longer than 200 characters", () => {
    const sample = loadSample("en") as { traits: Array<{ evidence: Array<{ quote: string }> }> }
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
    ["LlmProfileDraft", LlmProfileDraft],
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
      const sample = yield* decodeProfile(loadSample("en"))
      const draft: LlmProfileDraft = {
        headline: "h",
        archetype: { name: "n", description: "d" },
        dimensions: [
          { key: "growth", title: "G", summary: "s", evidence: [] },
          { key: "growth", title: "dup", summary: "s", evidence: [] },
        ],
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
