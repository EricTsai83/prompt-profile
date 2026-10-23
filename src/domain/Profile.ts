import { Effect, Schema } from "effect"
import { SourceId } from "./Source.ts"
import { Stats } from "./Stats.ts"

/** 2: `language` removed (the report is English-only). */
export const PROFILE_SCHEMA_VERSION = 2 as const

export const DIMENSION_KEYS = [
  "work_style",
  "communication",
  "tech_profile",
  "interests",
  "growth",
] as const
export const DimensionKey = Schema.Literals(DIMENSION_KEYS)
export type DimensionKey = typeof DimensionKey.Type

export const CONFIDENCES = ["high", "medium", "low"] as const
export const Confidence = Schema.Literals(CONFIDENCES)
export type Confidence = typeof Confidence.Type

export const MAX_QUOTE_LENGTH = 200

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

export const Evidence = Schema.Struct({
  promptId: Schema.String,
  /** Redacted excerpt of the prompt, at most 200 characters. */
  quote: Schema.String.check(Schema.isMaxLength(MAX_QUOTE_LENGTH)),
})
export type Evidence = typeof Evidence.Type

export const Dimension = Schema.Struct({
  key: DimensionKey,
  title: Schema.String,
  summary: Schema.String,
  /** May be empty after verification: the report then flags "insufficient evidence". */
  evidence: Schema.Array(Evidence),
})
export type Dimension = typeof Dimension.Type

export const Trait = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  confidence: Confidence,
  evidence: Schema.Array(Evidence),
})
export type Trait = typeof Trait.Type

/** Filled by the program, never by the LLM. */
export const Coverage = Schema.Struct({
  chunksTotal: Count,
  chunksAnalyzed: Count,
  chunksFromCache: Count,
  chunksFailed: Count,
  sampled: Schema.Boolean,
  sessionsAnalyzed: Count,
  promptsAnalyzed: Count,
  evidenceKept: Count,
  evidenceDropped: Count,
})
export type Coverage = typeof Coverage.Type

export const Engine = Schema.Struct({
  runner: SourceId,
  model: Schema.NullOr(Schema.String),
  analysisVersion: Schema.String,
})
export type Engine = typeof Engine.Type

const hasEachDimensionOnce = Schema.makeFilter<ReadonlyArray<Dimension>>((dims) => {
  const keys = dims.map((d) => d.key)
  return (
    (keys.length === DIMENSION_KEYS.length && DIMENSION_KEYS.every((k) => keys.includes(k))) ||
    `expected exactly one dimension per key (${DIMENSION_KEYS.join(", ")})`
  )
})

export const Profile = Schema.Struct({
  schemaVersion: Schema.Literal(PROFILE_SCHEMA_VERSION),
  generatedAt: Schema.DateTimeUtcFromString,
  engine: Engine,
  coverage: Coverage,
  headline: Schema.String,
  archetype: Schema.Struct({ name: Schema.String, description: Schema.String }),
  dimensions: Schema.Array(Dimension).check(hasEachDimensionOnce),
  traits: Schema.Array(Trait),
  funFacts: Schema.Array(Schema.String),
  stats: Stats,
})
export type Profile = typeof Profile.Type
export type ProfileEncoded = typeof Profile.Encoded

export class UnsupportedProfileVersion extends Schema.TaggedError<UnsupportedProfileVersion>()(
  "UnsupportedProfileVersion",
  { found: Schema.Unknown, supported: Schema.Number },
) {}

export class InvalidProfile extends Schema.TaggedError<InvalidProfile>()("InvalidProfile", {
  message: Schema.String,
}) {}

const VersionProbe = Schema.Struct({ schemaVersion: Schema.Unknown })

/** Decode a parsed `profile.json`. Unknown `schemaVersion` → `UnsupportedProfileVersion`. */
export const decodeProfile = (
  input: unknown,
): Effect.Effect<Profile, UnsupportedProfileVersion | InvalidProfile> =>
  Effect.gen(function* () {
    const probe = Schema.decodeUnknownOption(VersionProbe)(input)
    const found = probe._tag === "Some" ? probe.value.schemaVersion : undefined
    if (found !== PROFILE_SCHEMA_VERSION) {
      return yield* new UnsupportedProfileVersion({ found, supported: PROFILE_SCHEMA_VERSION })
    }
    return yield* Schema.decodeUnknownEffect(Profile)(input).pipe(
      Effect.mapError((e) => new InvalidProfile({ message: e.message })),
    )
  })

export const encodeProfile = (profile: Profile): ProfileEncoded =>
  Schema.encodeSync(Profile)(profile)
