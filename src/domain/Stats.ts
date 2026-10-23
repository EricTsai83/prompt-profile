import { Schema } from "effect"
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
})
export type Stats = typeof Stats.Type

export const encodeStats = (stats: Stats): typeof Stats.Encoded => Schema.encodeSync(Stats)(stats)

/** The busiest hour (the earliest on ties); null when there is no prompt at all. */
export const peakHour = (stats: Pick<Stats, "hourHistogram">): number | null => {
  const max = Math.max(...stats.hourHistogram)
  return max > 0 ? stats.hourHistogram.indexOf(max) : null
}
