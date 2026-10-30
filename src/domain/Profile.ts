import { EvidenceOrigin } from "./EvidenceOrigin.ts"
import { HistoryComparison } from "./History.ts"
import { NarrativePlan } from "./Narrative.ts"
import { Collaboration, CollaborationText } from "./Collaboration.ts"
import { AXIS_KEYS } from "./Interaction.ts"
import { Effect, Schema } from "effect"
import { Episode, EpisodeCoverage, Pattern } from "./Episode.ts"
import { MAX_QUOTE_LENGTH } from "./quote.ts"
import { Steering } from "./Steering.ts"
import { Effort } from "./Effort.ts"
import { SourceId } from "./Source.ts"
import { Snapshot } from "./Progress.ts"
import { Stats } from "./Stats.ts"
import { Usage } from "./Usage.ts"

/**
 * 2: `language` removed. 3: `languages` + `translations` (English text is the base; other
 * languages carry translated generated text only). 4: `stats.activity` (per day and per
 * weekday × hour, by project). 5: `traits[].support` (sessions and weeks behind a trait).
 * 6: `improvements` and `stats.promptHabits`. 7: `stats.techniques`. 8: `previous`.
 * 9: evidence-backed collaboration portrait. 10: `usage` (plan 23). 11: `episodes`, `patterns`
 * and `coverage.episodes` (plan 20 B). 12: preference axes list every characteristic way of
 * working (`sides`) instead of one pole with counter-evidence. 13: `steering` (conversations
 * where the person redirected the AI or asked for repairs). 14: `engine.effort`. 15: structured collaboration moves, understanding signals and axis coverage. 16: verified narrative planning, evidence origins and comparable history. Versions 2–15
 * are migrated on decode.
 */
export const PROFILE_SCHEMA_VERSION = 16 as const

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

export { MAX_QUOTE_LENGTH }

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

export const Evidence = Schema.Struct({
  promptId: Schema.String,
  /** Redacted excerpt of the prompt, at most 200 characters. */
  quote: Schema.String.check(Schema.isMaxLength(MAX_QUOTE_LENGTH)),
})
export type Evidence = typeof Evidence.Type

/** Evidence-backed narrative and original AI collaboration preferences. */
export const PortraitText = Schema.Struct({
  introduction: Schema.String,
  chapters: Schema.Array(Schema.Struct({ title: Schema.String, body: Schema.String })),
  axes: Schema.Array(
    Schema.Struct({
      key: Schema.Literals(AXIS_KEYS),
      explanation: Schema.String,
      sides: Schema.Array(Schema.Struct({ context: Schema.String })),
    }),
  ),
})

/**
 * One way of working observed on an axis, with the context it shows in (a kind of task, a
 * project, a situation). Both poles may appear: they describe the person in different
 * contexts, not a contradiction.
 */
export const AxisSide = Schema.Struct({
  pole: Schema.Literals(["first", "second"]),
  context: Schema.String,
  evidence: Schema.Array(Evidence),
  /** Distinct conversations of the verified evidence (filled by the program). */
  sessions: Count,
})
export type AxisSide = typeof AxisSide.Type

export const Portrait = Schema.Struct({
  introduction: Schema.String,
  chapters: Schema.Array(
    Schema.Struct({ title: Schema.String, body: Schema.String, evidence: Schema.Array(Evidence) }),
  ),
  axes: Schema.Array(
    Schema.Struct({
      key: Schema.Literals(AXIS_KEYS),
      explanation: Schema.String,
      coverage: Schema.optionalKey(
        Schema.Struct({
          citedSessions: Count,
          analysedSessions: Count,
          periods: Count,
          scope: Schema.Literal("cited_choices"),
        }),
      ),
      /** At most one per pole. */
      sides: Schema.Array(AxisSide),
    }),
  ),
})
export type Portrait = typeof Portrait.Type

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
  narrativeRejected: Schema.optionalKey(Count),
  chunksTotal: Count,
  chunksAnalyzed: Count,
  chunksFromCache: Count,
  chunksFailed: Count,
  sampled: Schema.Boolean,
  sessionsAnalyzed: Count,
  promptsAnalyzed: Count,
  evidenceKept: Count,
  evidenceDropped: Count,
  /** Interaction episodes found, rejected and selected; null before schema version 11. */
  episodes: Schema.NullOr(EpisodeCoverage).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
})
export type Coverage = typeof Coverage.Type

export const Engine = Schema.Struct({
  runner: SourceId,
  model: Schema.NullOr(Schema.String),
  modelSource: Schema.optionalKey(Schema.NullOr(Schema.Literals(["reported", "requested"]))),
  modelsUsed: Schema.optionalKey(Schema.Array(Schema.NullOr(Schema.String))),
  /** `--effort` as requested; null = the CLI's default (and before schema version 14). */
  effort: Schema.NullOr(Effort).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
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
  collaboration: Schema.NullOr(CollaborationText).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
  portrait: Schema.NullOr(PortraitText),
  headline: Schema.String,
  archetype: Schema.Struct({ name: Schema.String, description: Schema.String }),
  dimensions: Schema.Array(
    Schema.Struct({ key: DimensionKey, title: Schema.String, summary: Schema.String }),
  ),
  traits: Schema.Array(Schema.Struct({ name: Schema.String, description: Schema.String })),
  funFacts: Schema.Array(Schema.String),
  improvements: Schema.Array(ImprovementText),
  episodes: Schema.Array(Schema.Struct({ task: Schema.String })),
  patterns: Schema.Array(Schema.Struct({ claim: Schema.String })),
})

/** Generated text in one non-English language, aligned with the English fields. */
export const Translation = Schema.Struct({
  collaboration: Schema.optionalKey(Schema.NullOr(CollaborationText)),
  portrait: Schema.optionalKey(Schema.NullOr(PortraitText)),
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
  /** Missing before schema version 11. */
  episodes: Schema.Array(Schema.Struct({ task: Schema.String })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([])),
  ),
  patterns: Schema.Array(Schema.Struct({ claim: Schema.String })).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([])),
  ),
})
export type Translation = typeof Translation.Type

const ProfileFields = Schema.Struct({
  narrative: Schema.optionalKey(Schema.NullOr(NarrativePlan)),
  historyComparison: Schema.optionalKey(Schema.NullOr(HistoryComparison)),
  evidenceOrigins: Schema.optionalKey(Schema.Array(EvidenceOrigin)),
  collaboration: Schema.optionalKey(Schema.NullOr(Collaboration)),
  portrait: Schema.optionalKey(Schema.NullOr(Portrait)),
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
  /** The previous report in the same folder, for "since your last report"; null if none. */
  previous: Schema.NullOr(Snapshot).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  /** Selected interaction episodes, chronological (plan 20 B); empty before version 11. */
  episodes: Schema.Array(Episode).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  /** Habits recurring across `episodes`; empty before version 11. */
  patterns: Schema.Array(Pattern).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  /** Steering and repairs per conversation; null before version 13 (the report then shows
   * the rule-based `stats.correctionRate`). */
  steering: Schema.NullOr(Steering).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  /** Tokens, plan and API list-price equivalent; null = not measured (before version 10). */
  usage: Schema.NullOr(Usage).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  stats: Stats,
})

/** Is `t` the same shape as the English text: same dimension keys, trait and fact counts? */
export const matchesBase = (
  base: Pick<
    typeof ProfileFields.Type,
    | "dimensions"
    | "traits"
    | "funFacts"
    | "improvements"
    | "portrait"
    | "episodes"
    | "patterns"
    | "collaboration"
  >,
  t: Translation,
): boolean =>
  (!base.collaboration ||
    (t.collaboration != null &&
      t.collaboration.moves.length === base.collaboration.moves.length &&
      t.collaboration.signals.length === base.collaboration.signals.length &&
      base.collaboration.moves.every(
        (m, i) =>
          Boolean(m.benefit) === Boolean(t.collaboration!.moves[i]?.benefit) &&
          Boolean(m.cost) === Boolean(t.collaboration!.moves[i]?.cost),
      ))) &&
  (!base.portrait ||
    (t.portrait != null &&
      t.portrait.chapters.length === base.portrait.chapters.length &&
      t.portrait.axes.length === base.portrait.axes.length &&
      base.portrait.axes.every(
        (a, i) =>
          t.portrait!.axes[i]?.key === a.key &&
          t.portrait!.axes[i]?.sides.length === a.sides.length,
      ))) &&
  t.traits.length === base.traits.length &&
  t.improvements.length === base.improvements.length &&
  t.episodes.length === base.episodes.length &&
  t.patterns.length === base.patterns.length &&
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
    if (
      found !== PROFILE_SCHEMA_VERSION &&
      ![2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(found as number)
    ) {
      return yield* new UnsupportedProfileVersion({ found, supported: PROFILE_SCHEMA_VERSION })
    }
    // Version 2 had English text only; missing newer fields decode to their defaults.
    const migrated =
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
    const current =
      typeof found === "number" && found < 12 ? migrateAxes(migrated as Legacy) : migrated
    return yield* Schema.decodeUnknownEffect(Profile)(current).pipe(
      Effect.mapError((e) => new InvalidProfile({ message: e.message })),
    )
  })

interface LegacyAxis {
  readonly key: string
  readonly pole?: string
  readonly explanation?: string
  readonly evidence?: ReadonlyArray<{ readonly promptId: string }>
  readonly counterEvidence?: ReadonlyArray<{ readonly promptId: string }>
}
interface Legacy {
  readonly portrait?: { readonly axes?: ReadonlyArray<LegacyAxis> } | null
  readonly translations?: Record<string, { readonly portrait?: { readonly axes?: unknown } | null }>
}

/** `${source}:${sessionId}:${n}` → `${source}:${sessionId}` (the adapters' id format). */
const sessionOfPromptId = (id: string): string => id.slice(0, Math.max(0, id.lastIndexOf(":")))

/**
 * Before version 12 an axis had one pole and counter-evidence. A resolved pole becomes a side
 * and its counter-evidence the other side, both without a stated context; an unresolved axis
 * did not say which quotes belonged to which pole, so it keeps only its explanation.
 */
const migrateAxes = (input: Legacy): Legacy => {
  const axes = input.portrait?.axes
  if (!axes) return input
  const side = (pole: string, evidence: ReadonlyArray<{ readonly promptId: string }>) =>
    evidence.length === 0
      ? []
      : [
          {
            pole,
            context: "",
            evidence,
            sessions: new Set(evidence.map((e) => sessionOfPromptId(e.promptId))).size,
          },
        ]
  const sides = axes.map((a) =>
    a.pole === "first" || a.pole === "second"
      ? [
          ...side(a.pole, a.evidence ?? []),
          ...side(a.pole === "first" ? "second" : "first", a.counterEvidence ?? []),
        ].toSorted((x, y) => (x.pole === y.pole ? 0 : x.pole === "first" ? -1 : 1))
      : [],
  )
  const translations = Object.fromEntries(
    Object.entries(input.translations ?? {}).map(([lang, t]) => {
      const tAxes = t.portrait?.axes
      return [
        lang,
        !Array.isArray(tAxes)
          ? t
          : {
              ...t,
              portrait: {
                ...t.portrait,
                axes: tAxes.map((a: object, i: number) => ({
                  ...a,
                  sides: (sides[i] ?? []).map(() => ({ context: "" })),
                })),
              },
            },
      ]
    }),
  )
  return {
    ...input,
    portrait: {
      ...input.portrait,
      axes: axes.map(({ key, explanation }, i) => ({
        key,
        explanation: explanation ?? "",
        sides: sides[i]!,
      })),
    },
    ...(input.translations ? { translations } : {}),
  }
}

export const encodeProfile = (profile: Profile): ProfileEncoded =>
  Schema.encodeSync(Profile)(profile)
