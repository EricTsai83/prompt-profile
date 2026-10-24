import { Effect, Schema } from "effect"
import { SourceId } from "./Source.ts"
import { Stats } from "./Stats.ts"

/**
 * 2: `language` removed. 3: `languages` + `translations` (English text is the base; other
 * languages carry translated generated text only). 4: `stats.activity` (per day and per
 * weekday × hour, by project). 5: `traits[].support` (sessions and weeks behind a trait).
 * 6: `improvements` and `stats.promptHabits`. Versions 2–5 are migrated on decode.
 */
export const PROFILE_SCHEMA_VERSION = 6 as const

/** Report languages; the generated profile text is written in English first. */
export const LANGUAGES = ["en", "zh-TW"] as const
export const Language = Schema.Literals(LANGUAGES)
export type Language = typeof Language.Type

export const DIMENSION_KEYS = [
  "work_style",
  "communication",
  "tech_profile",
  "interests",
  "growth",
] as const
export const DimensionKey = Schema.Literals(DIMENSION_KEYS)
export type DimensionKey = typeof DimensionKey.Type

/** Observation categories: the five dimensions plus `prompting` (feeds improvements only). */
export const OBSERVATION_KEYS = [...DIMENSION_KEYS, "prompting"] as const
export const ObservationKey = Schema.Literals(OBSERVATION_KEYS)
export type ObservationKey = typeof ObservationKey.Type

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

/** How widely a trait's verified quotes are spread: distinct sessions and analysed weeks. */
export const Support = Schema.Struct({ sessions: Count, weeks: Count })
export type Support = typeof Support.Type

export const Trait = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  confidence: Confidence,
  evidence: Schema.Array(Evidence),
  /** Filled by verification; null in profiles before schema version 5. */
  support: Schema.NullOr(Support).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
})
export type Trait = typeof Trait.Type

/** A way the prompts could improve, with verified evidence and one suggested rewrite. */
export const Improvement = Schema.Struct({
  title: Schema.String,
  /** What the developer does (one sentence). */
  pattern: Schema.String,
  /** What it visibly costs in the prompts, e.g. follow-up corrections (one sentence). */
  impact: Schema.String,
  suggestion: Schema.String,
  evidence: Schema.Array(Evidence),
  /**
   * `promptId` is one of `evidence` (its quote is the "before"); `after` is the suggested
   * prompt in the original language. Null when the model gave none or it did not verify.
   */
  rewrite: Schema.NullOr(Schema.Struct({ promptId: Schema.String, after: Schema.String })),
})
export type Improvement = typeof Improvement.Type

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

const ImprovementText = Schema.Struct({
  title: Schema.String,
  pattern: Schema.String,
  impact: Schema.String,
  suggestion: Schema.String,
})

/** What the translation call returns: every field required (LLM strict-schema subset). */
export const LlmTranslation = Schema.Struct({
  headline: Schema.String,
  archetype: Schema.Struct({ name: Schema.String, description: Schema.String }),
  dimensions: Schema.Array(
    Schema.Struct({ key: DimensionKey, title: Schema.String, summary: Schema.String }),
  ),
  traits: Schema.Array(Schema.Struct({ name: Schema.String, description: Schema.String })),
  funFacts: Schema.Array(Schema.String),
  improvements: Schema.Array(ImprovementText),
})

/** Generated text in one non-English language, aligned with the English fields. */
export const Translation = Schema.Struct({
  headline: Schema.String,
  archetype: Schema.Struct({ name: Schema.String, description: Schema.String }),
  dimensions: Schema.Array(
    Schema.Struct({ key: DimensionKey, title: Schema.String, summary: Schema.String }),
  ),
  traits: Schema.Array(Schema.Struct({ name: Schema.String, description: Schema.String })),
  funFacts: Schema.Array(Schema.String),
  /** Rewrites are not translated: they are prompts to copy. */
  improvements: Schema.Array(ImprovementText).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([])),
  ),
})
export type Translation = typeof Translation.Type

const ProfileFields = Schema.Struct({
  schemaVersion: Schema.Literal(PROFILE_SCHEMA_VERSION),
  /** Offered languages, the default first. */
  languages: Schema.NonEmptyArray(Language),
  /** One entry per non-English language in `languages`. */
  translations: Schema.Record(Schema.String, Translation),
  generatedAt: Schema.DateTimeUtcFromString,
  engine: Engine,
  coverage: Coverage,
  headline: Schema.String,
  archetype: Schema.Struct({ name: Schema.String, description: Schema.String }),
  dimensions: Schema.Array(Dimension).check(hasEachDimensionOnce),
  traits: Schema.Array(Trait),
  funFacts: Schema.Array(Schema.String),
  /** Missing in profiles before schema version 6. */
  improvements: Schema.Array(Improvement).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  stats: Stats,
})

/** Is `t` the same shape as the English text: same dimension keys, trait and fact counts? */
export const matchesBase = (
  base: Pick<typeof ProfileFields.Type, "dimensions" | "traits" | "funFacts" | "improvements">,
  t: Translation,
): boolean =>
  t.traits.length === base.traits.length &&
  t.improvements.length === base.improvements.length &&
  t.funFacts.length === base.funFacts.length &&
  t.dimensions.length === base.dimensions.length &&
  base.dimensions.every((d) => t.dimensions.some((x) => x.key === d.key))

const consistentLanguages = Schema.makeFilter<typeof ProfileFields.Type>((p) => {
  if (new Set(p.languages).size !== p.languages.length) return "languages must be unique"
  const needed = p.languages.filter((l) => l !== "en")
  const given = Object.keys(p.translations)
  if (given.length !== needed.length || !needed.every((l) => given.includes(l)))
    return "translations must cover exactly the non-English languages"
  return (
    needed.every((l) => matchesBase(p, p.translations[l]!)) ||
    "a translation does not match the English dimensions, traits or fun facts"
  )
})

export const Profile = ProfileFields.check(consistentLanguages)
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
    if (found !== PROFILE_SCHEMA_VERSION && ![2, 3, 4, 5].includes(found as number)) {
      return yield* new UnsupportedProfileVersion({ found, supported: PROFILE_SCHEMA_VERSION })
    }
    // Version 2 had English text only; missing newer fields decode to their defaults.
    const current =
      found === 2
        ? {
            ...(input as object),
            schemaVersion: PROFILE_SCHEMA_VERSION,
            languages: ["en"],
            translations: {},
          }
        : found !== PROFILE_SCHEMA_VERSION
          ? { ...(input as object), schemaVersion: PROFILE_SCHEMA_VERSION }
          : input
    return yield* Schema.decodeUnknownEffect(Profile)(current).pipe(
      Effect.mapError((e) => new InvalidProfile({ message: e.message })),
    )
  })

export const encodeProfile = (profile: Profile): ProfileEncoded =>
  Schema.encodeSync(Profile)(profile)
