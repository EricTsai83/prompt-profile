import { Schema, DateTime } from "effect"
import type { Profile } from "./Profile.ts"
import { LANGUAGES } from "./Profile.ts"

export const RUN_ID = /^(?:\d{8}T\d{6}Z-[a-f0-9]{32}|legacy-[a-f0-9]{32})$/u
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Iso = Schema.String.check(
  Schema.makeFilter((s: string) => /^\d{4}-\d\d-\d\dT/u.test(s) && Number.isFinite(Date.parse(s))),
)
export const RunManifest = Schema.Struct({
  version: Schema.Literal(1),
  id: Schema.String.check(Schema.makeFilter((s: string) => RUN_ID.test(s))),
  createdAt: Iso,
  window: Schema.Struct({ from: Schema.NullOr(Iso), to: Schema.NullOr(Iso) }),
  sampling: Schema.Struct({ sampled: Schema.Boolean, prompts: Count, sessions: Count }),
  role: Schema.NullOr(Schema.String),
  languages: Schema.NonEmptyArray(Schema.Literals(LANGUAGES)),
  engine: Schema.Struct({
    runner: Schema.String,
    model: Schema.NullOr(Schema.String),
    analysisVersion: Schema.String,
  }),
  schemaVersion: Count,
  pipelineVersion: Schema.String,
  excluded: Schema.Array(Schema.String),
  cards: Schema.Array(
    Schema.Struct({
      language: Schema.Literals(LANGUAGES),
      file: Schema.NullOr(
        Schema.String.check(
          Schema.makeFilter((s: string) =>
            ["card.png", "card.en.png", "card.zh-TW.png"].includes(s),
          ),
        ),
      ),
      error: Schema.NullOr(Schema.String),
    }),
  ),
  legacyFingerprint: Schema.optionalKey(Schema.String),
})
export type RunManifest = typeof RunManifest.Type
export interface LibraryIndex {
  readonly version: 1
  readonly latest: string | null
  readonly runs: ReadonlyArray<RunManifest>
  readonly skipped: number
}

export const parseRunManifest = (value: unknown): RunManifest | null => {
  const parsed = Schema.decodeUnknownOption(RunManifest)(value)
  return parsed._tag === "Some" ? parsed.value : null
}

/** Stable index order even when reports share one timestamp. */
export const libraryIndex = (runs: ReadonlyArray<RunManifest>, skipped = 0): LibraryIndex => {
  const ordered = runs.toSorted(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  )
  return { version: 1, latest: ordered[0]?.id ?? null, runs: ordered, skipped }
}

export const manifestOf = (
  profile: Profile,
  id: string,
  pipelineVersion: string,
  role: string | null,
  excluded: ReadonlyArray<string>,
  cards: RunManifest["cards"],
): RunManifest => ({
  version: 1,
  id,
  createdAt: DateTime.formatIso(profile.generatedAt),
  window: {
    from: profile.stats.dateRange ? DateTime.formatIso(profile.stats.dateRange.from) : null,
    to: profile.stats.dateRange ? DateTime.formatIso(profile.stats.dateRange.to) : null,
  },
  sampling: {
    sampled: profile.coverage.sampled,
    prompts: profile.coverage.promptsAnalyzed,
    sessions: profile.coverage.sessionsAnalyzed,
  },
  role,
  languages: profile.languages,
  engine: {
    runner: profile.engine.runner,
    model: profile.engine.model,
    analysisVersion: profile.engine.analysisVersion,
  },
  schemaVersion: profile.schemaVersion,
  pipelineVersion,
  excluded,
  cards,
})
