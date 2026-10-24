import { Effect, Schema } from "effect"
import { ORIGINS, SOURCE_IDS } from "./Source.ts"
import { isTimeZone } from "./timezone.ts"

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Ratio = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }))
const fixedLength = (n: number) => Schema.Array(Count).check(Schema.isBetweenLength(n, n))

const NamedCount = Schema.Struct({ name: Schema.String, count: Count })

const countsFor = <const K extends ReadonlyArray<string>>(keys: K) =>
  Schema.Struct(
    Object.fromEntries(keys.map((k) => [k, Count])) as { readonly [P in K[number]]: typeof Count },
  )

/** Prompts on one logical day (local, 05:00 boundary), split like `Activity.projects`. */
const DayActivity = Schema.Struct({
  /** YYYY-MM-DD in `timezone`. */
  date: Schema.String,
  count: Count,
  /** One count per `Activity.projects` entry, then "other" (no project or not in the top). */
  byProject: Schema.Array(Count),
})

/** Where and when: per day and per weekday × hour, split by the top projects. */
export const Activity = Schema.Struct({
  /** Up to MAX_ACTIVITY_PROJECTS redacted project folder names, busiest first. */
  projects: Schema.Array(Schema.String),
  /** Days with at least one prompt, oldest first. */
  days: Schema.Array(DayActivity),
  /** 7 × 24 (0 = Monday), each cell split like `days[].byProject`; empty in old profiles. */
  gridByProject: Schema.Array(Schema.Array(Schema.Array(Count))),
})
export type Activity = typeof Activity.Type

export const MAX_ACTIVITY_PROJECTS = 6

export const EMPTY_ACTIVITY: typeof Activity.Encoded = { projects: [], days: [], gridByProject: [] }

/** Prompting habits that can point to an improvement (plan 16). */
export const PromptHabits = Schema.Struct({
  /** Share of cleaned prompts with fewer than ~4 words (a CJK character counts as 0.4). */
  terseShare: Ratio,
  /** Share of sessions with more than LONG_SESSION_PROMPTS prompts. */
  longSessionShare: Ratio,
  /** Openings (first-prompt prefixes) shared by ≥ 3 sessions, and how many sessions use them. */
  reusedOpenings: Schema.Struct({ openings: Count, sessions: Count }),
})
export type PromptHabits = typeof PromptHabits.Type

export const LONG_SESSION_PROMPTS = 40

export const EMPTY_PROMPT_HABITS: typeof PromptHabits.Encoded = {
  terseShare: 0,
  longSessionShare: 0,
  reusedOpenings: { openings: 0, sessions: 0 },
}

export const Stats = Schema.Struct({
  window: Schema.Struct({
    since: Schema.NullOr(Schema.DateTimeUtcFromString),
    until: Schema.DateTimeUtcFromString,
  }),
  timezone: Schema.String.check(
    Schema.makeFilter((zone: string) => isTimeZone(zone) || "expected an IANA time zone"),
  ),
  totalPrompts: Count,
  analyzedPrompts: Count,
  totalSessions: Count,
  bySource: countsFor(SOURCE_IDS),
  byOrigin: countsFor(ORIGINS),
  dateRange: Schema.NullOr(
    Schema.Struct({ from: Schema.DateTimeUtcFromString, to: Schema.DateTimeUtcFromString }),
  ),
  activeDays: Count,
  /** 24 buckets in `timezone`. */
  hourHistogram: fixedLength(24),
  /** 7 buckets, 0 = Monday. */
  weekdayHistogram: fixedLength(7),
  /** 7 × 24 grid (weekday × hour, 0 = Monday) for the activity heatmap. */
  activityGrid: Schema.Array(fixedLength(24)).check(Schema.isBetweenLength(7, 7)),
  /** Characters, after cleaning. */
  promptLength: Schema.Struct({ median: Schema.Finite, p90: Schema.Finite }),
  languageMix: Schema.Struct({ zh: Ratio, en: Ratio, mixed: Ratio }),
  topProjects: Schema.Array(NamedCount),
  topSlashCommands: Schema.Array(NamedCount),
  correctionRate: Ratio,
  imageRate: Ratio,
  longestStreakDays: Count,
  /** e.g. "03:12"; the day boundary is 05:00. */
  latestTime: Schema.NullOr(Schema.String),
  /** Missing in profiles before schema version 4. */
  activity: Activity.pipe(Schema.withDecodingDefaultKey(Effect.succeed(EMPTY_ACTIVITY))),
  /** Missing in profiles before schema version 6. */
  promptHabits: PromptHabits.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(EMPTY_PROMPT_HABITS)),
  ),
})
export type Stats = typeof Stats.Type

export const encodeStats = (stats: Stats): typeof Stats.Encoded => Schema.encodeSync(Stats)(stats)

/** The busiest hour (the earliest on ties); null when there is no prompt at all. */
export const peakHour = (stats: Pick<Stats, "hourHistogram">): number | null => {
  const max = Math.max(...stats.hourHistogram)
  return max > 0 ? stats.hourHistogram.indexOf(max) : null
}
