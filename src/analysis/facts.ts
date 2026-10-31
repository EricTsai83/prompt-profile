import type { Stats } from "../domain/index.ts"

export type FactStats = Pick<
  Stats,
  | "totalPrompts"
  | "totalSessions"
  | "activeDays"
  | "longestStreakDays"
  | "latestTime"
  | "hourHistogram"
  | "weekdayHistogram"
  | "imageRate"
  | "languageMix"
  | "promptLength"
  | "correctionRate"
>

/** Most facts a profile keeps; fewer than MIN_FACTS model facts are topped up from the stats. */
export const MAX_FACTS = 4
export const MIN_FACTS = 3
/** Longest model fact kept, in words. */
const MAX_FACT_WORDS = 24
/** An image share worth a fact. */
const MIN_IMAGE_SHARE = 0.03

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

const maxIndex = (xs: ReadonlyArray<number>): number | null => {
  const max = Math.max(...xs)
  return max > 0 ? xs.indexOf(max) : null
}

/**
 * The most distinctive measured facts, most distinctive first. Measured history only: prompt
 * activity cannot establish working hours or completed work, so each fact says what was sent.
 */
export const statFacts = (stats: FactStats): ReadonlyArray<string> => {
  const hour = maxIndex(stats.hourHistogram)
  const day = maxIndex(stats.weekdayHistogram)
  return [
    stats.latestTime ? `Latest prompt sent: ${stats.latestTime}.` : null,
    hour === null
      ? null
      : `Busiest hour: ${hour}:00, with ${stats.hourHistogram[hour]} prompts sent.`,
    day === null
      ? null
      : `${WEEKDAY_NAMES[day]} is the busiest weekday, with ${stats.weekdayHistogram[day]} prompts.`,
    stats.longestStreakDays > 1
      ? `Longest streak: ${stats.longestStreakDays} days in a row with prompts.`
      : null,
    stats.imageRate >= MIN_IMAGE_SHARE
      ? `${Math.round(stats.imageRate * 100)}% of prompts include an image.`
      : null,
  ].filter((x): x is string => x !== null)
}

/**
 * Numbers a fact states: "4,409" → "4409", "04:59" → "4:59", "56%" → "56", and a clock hour
 * "3 AM" → "3h" (so a bare small number is not mistaken for an hour).
 */
const numbersIn = (text: string): ReadonlyArray<string> =>
  [...text.matchAll(/\d[\d,]*(?:[.:]\d+)?(\s?[ap]\.?m\b\.?)?/gi)].map((m) => {
    const n = m[0]
      .replace(/\s?[ap]\.?m\b\.?$/i, "")
      .replace(/,(?=\d{3}\b)/g, "")
      .replace(/^0+(?=\d)/, "")
    return m[1] ? `${n}h` : n
  })

/** Every number a fact may use: the stats' numbers, ratios as percentages, and hours. */
const allowedNumbers = (stats: FactStats): ReadonlySet<string> => {
  const allowed = new Set<string>()
  const add = (n: number) => {
    if (!Number.isFinite(n)) return
    if (Number.isInteger(n)) allowed.add(String(n))
    else {
      allowed.add(String(Math.round(n)))
      allowed.add(n.toFixed(1))
    }
    if (n > 0 && n < 1) {
      allowed.add(String(Math.round(n * 100)))
      allowed.add((n * 100).toFixed(1))
    }
  }
  const walk = (value: unknown): void => {
    if (typeof value === "number") add(value)
    else if (Array.isArray(value)) value.forEach(walk)
    else if (typeof value === "object" && value !== null) Object.values(value).forEach(walk)
  }
  walk(stats)
  // clock hours: "3:00", "15:00", "3 AM"
  for (let h = 0; h < 24; h++) {
    allowed.add(`${h}:00`)
    allowed.add(`${h % 12 === 0 ? 12 : h % 12}h`)
  }
  if (stats.latestTime) for (const n of numbersIn(stats.latestTime)) allowed.add(n)
  return allowed
}

/**
 * The model's fun facts that state at least one number, every number from the stats; then
 * measured facts until there are MIN_FACTS, skipping those whose numbers a kept fact states.
 */
export const verifyFunFacts = (
  facts: ReadonlyArray<string>,
  stats: FactStats,
): ReadonlyArray<string> => {
  const allowed = allowedNumbers(stats)
  const kept = facts
    .map((f) => f.trim())
    .filter((f, i, all) => f !== "" && all.indexOf(f) === i)
    .filter((f) => f.split(/\s+/).length <= MAX_FACT_WORDS)
    .filter((f) => {
      const numbers = numbersIn(f)
      return numbers.length > 0 && numbers.every((n) => allowed.has(n))
    })
    .slice(0, MAX_FACTS)
  const stated = new Set(kept.flatMap(numbersIn))
  const fill = statFacts(stats).filter((f) => !numbersIn(f).some((n) => stated.has(n)))
  return [...kept, ...fill.slice(0, Math.max(0, MIN_FACTS - kept.length))]
}
