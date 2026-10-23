import { DateTime } from "effect"
import type { PromptRecord } from "../domain/PromptRecord.ts"
import { ORIGINS, SOURCE_IDS } from "../domain/Source.ts"
import type { Stats } from "../domain/Stats.ts"

/** Corrections addressed to the AI (case-insensitive; matched anywhere in the prompt). */
export const CORRECTION_PATTERNS: ReadonlyArray<RegExp> = [
  /不對/,
  /錯了/,
  /不是這樣/,
  /還是不行/,
  /還是錯/,
  /沒有用/,
  /不是我要的/,
  /你搞錯/,
  /^\s*no(pe)?\s*[,.!]/i,
  /^\s*no(pe)?\s+(that|this|it|not|don'?t|wait|stop)\b/i,
  /\bwrong\b/i,
  /\bthat'?s not\b/i,
  /\bstill (broken|failing|not working|wrong)\b/i,
  /\bdoesn'?t work\b/i,
  /\bnot what i (asked|wanted)\b/i,
  /\byou (broke|missed)\b/i,
]

export const isCorrection = (text: string): boolean => CORRECTION_PATTERNS.some((p) => p.test(text))

const CJK_CHAR = /[㐀-鿿豈-﫿]/g
const LATIN_WORD = /[A-Za-z]{2,}/g

/**
 * Classify a prompt by script. A CJK character and a Latin word carry roughly similar
 * weight, so we compare CJK chars to Latin words: ≥ 50% CJK → zh; ≤ 15% → en; else mixed.
 */
export const classifyLanguage = (text: string): "zh" | "en" | "mixed" => {
  const cjk = text.match(CJK_CHAR)?.length ?? 0
  const words = text.match(LATIN_WORD)?.length ?? 0
  if (cjk + words === 0) return "en"
  const ratio = cjk / (cjk + words)
  return ratio >= 0.5 ? "zh" : ratio <= 0.15 ? "en" : "mixed"
}

/** Local calendar parts in `timeZone`. */
export interface LocalParts {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
  /** 0 = Monday. */
  readonly weekday: number
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export const makeLocalParts = (timeZone: string) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  })
  return (t: DateTime.Utc): LocalParts => {
    const parts: Record<string, string> = {}
    for (const p of fmt.formatToParts(DateTime.toEpochMillis(t))) parts[p.type] = p.value
    return {
      year: Number(parts["year"]),
      month: Number(parts["month"]),
      day: Number(parts["day"]),
      hour: Number(parts["hour"]),
      minute: Number(parts["minute"]),
      weekday: WEEKDAYS.indexOf(parts["weekday"] ?? ""),
    }
  }
}

/** A "day" ends at 05:00 local time: 00:00–04:59 belongs to the previous day. */
export const DAY_BOUNDARY_HOUR = 5

/** Day index (days since epoch, local) after shifting by the 05:00 boundary. */
const logicalDay = (p: LocalParts): number => {
  const base = Date.UTC(p.year, p.month - 1, p.day) / 86_400_000
  return p.hour < DAY_BOUNDARY_HOUR ? base - 1 : base
}

/** Minutes after 18:00 on the logical day (00:00–04:59 continue past midnight). */
const lateness = (p: LocalParts): number | null => {
  if (p.hour >= 18) return (p.hour - 18) * 60 + p.minute
  if (p.hour < DAY_BOUNDARY_HOUR) return (p.hour + 6) * 60 + p.minute
  return null
}

const pad = (n: number) => String(n).padStart(2, "0")

const percentile = (sorted: ReadonlyArray<number>, q: number): number => {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * q
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo)
}

const topN = (counts: Map<string, number>, n: number) =>
  [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([name, count]) => ({ name, count }))

const round = (x: number, digits = 4) => Math.round(x * 10 ** digits) / 10 ** digits

export interface StatsInput {
  /** After filter, before clean. */
  readonly filtered: ReadonlyArray<PromptRecord>
  /** After clean (text = cleaned text). */
  readonly cleaned: ReadonlyArray<{ readonly record: PromptRecord; readonly text: string }>
  /** Redacted project folder names, keyed by raw project path. */
  readonly projectNames: ReadonlyMap<string, string | null>
  readonly slashCommands: Readonly<Record<string, number>>
  readonly since: DateTime.Utc | null
  readonly now: DateTime.Utc
  readonly timezone: string
}

export const computeStats = (input: StatsInput): Stats => {
  const local = makeLocalParts(input.timezone)
  const { filtered, cleaned } = input

  // --- filtered data (after filter, before clean): volume & time ---------------------
  const bySource = Object.fromEntries(SOURCE_IDS.map((s) => [s, 0])) as Record<
    (typeof SOURCE_IDS)[number],
    number
  >
  const byOrigin = Object.fromEntries(ORIGINS.map((o) => [o, 0])) as Record<
    (typeof ORIGINS)[number],
    number
  >
  const hourHistogram = Array.from({ length: 24 }, () => 0)
  const weekdayHistogram = Array.from({ length: 7 }, () => 0)
  const sessions = new Set<string>()
  const days = new Set<number>()
  const projects = new Map<string, number>()
  let latest: { minutes: number; label: string } | null = null
  for (const r of filtered) {
    bySource[r.source]++
    byOrigin[r.origin]++
    sessions.add(`${r.source}:${r.sessionId}`)
    const p = local(r.timestamp)
    hourHistogram[p.hour]!++
    weekdayHistogram[p.weekday]!++
    days.add(logicalDay(p))
    const late = lateness(p)
    if (late !== null && (latest === null || late > latest.minutes)) {
      latest = { minutes: late, label: `${pad(p.hour)}:${pad(p.minute)}` }
    }
    const name = r.project === null ? null : (input.projectNames.get(r.project) ?? null)
    if (name !== null) projects.set(name, (projects.get(name) ?? 0) + 1)
  }
  const sortedDays = [...days].toSorted((a, b) => a - b)
  let longestStreakDays = 0
  let streak = 0
  for (let i = 0; i < sortedDays.length; i++) {
    const gap = i > 0 ? (sortedDays[i] ?? 0) - (sortedDays[i - 1] ?? 0) : 0
    streak = gap === 1 ? streak + 1 : 1
    longestStreakDays = Math.max(longestStreakDays, streak)
  }

  // --- cleaned data: content features -------------------------------------------------
  const lengths = cleaned.map((c) => Array.from(c.text).length).toSorted((a, b) => a - b)
  const lang = { zh: 0, en: 0, mixed: 0 }
  let corrections = 0
  let images = 0
  for (const c of cleaned) {
    lang[classifyLanguage(c.text)]++
    if (isCorrection(c.text)) corrections++
    if (c.record.hasImage) images++
  }
  const n = cleaned.length
  const ratio = (x: number) => (n === 0 ? 0 : round(x / n))
  // make the three ratios sum to exactly 1
  const zh = ratio(lang.zh)
  const en = ratio(lang.en)
  const mixed = n === 0 ? 0 : round(1 - zh - en)

  const first = filtered[0]
  const last = filtered.at(-1)
  return {
    window: { since: input.since, until: input.now },
    timezone: input.timezone,
    totalPrompts: filtered.length,
    analyzedPrompts: n,
    totalSessions: sessions.size,
    bySource,
    byOrigin,
    dateRange: first && last ? { from: first.timestamp, to: last.timestamp } : null,
    activeDays: days.size,
    hourHistogram,
    weekdayHistogram,
    promptLength: {
      median: round(percentile(lengths, 0.5), 1),
      p90: round(percentile(lengths, 0.9), 1),
    },
    languageMix: { zh, en, mixed: Math.max(0, mixed) },
    topProjects: topN(projects, 5),
    topSlashCommands: topN(new Map(Object.entries(input.slashCommands)), 5),
    correctionRate: ratio(corrections),
    imageRate: ratio(images),
    longestStreakDays,
    latestTime: latest?.label ?? null,
  }
}
