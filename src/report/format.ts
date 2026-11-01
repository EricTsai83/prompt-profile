import { DateTime } from "effect"
import type { Language } from "../domain/index.ts"
import { DURATION_MESSAGES } from "./messages.ts"

/** Display names of the analysis runners. */
export const RUNNER_NAMES = { "claude-code": "Claude Code", codex: "Codex" } as const

export const formatDate = (t: DateTime.Utc, timeZone: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(DateTime.toEpochMillis(t))

export const formatMonth = (t: DateTime.Utc, timeZone: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { timeZone, year: "numeric", month: "short" }).format(
    DateTime.toEpochMillis(t),
  )

/** Calendar days from `from` to `to` in `timeZone`, both included. */
export const daysBetween = (from: DateTime.Utc, to: DateTime.Utc, timeZone: string): number => {
  const day = (t: DateTime.Utc) => {
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone })
      .format(DateTime.toEpochMillis(t))
      .split("-")
      .map(Number) as [number, number, number]
    return Date.UTC(y, m - 1, d) / 86_400_000
  }
  return day(to) - day(from) + 1
}

export const formatDateTime = (t: DateTime.Utc, timeZone: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(DateTime.toEpochMillis(t))

export const percent = (x: number) => Math.round(x * 100)
export const hh = (h: number) => `${String(h).padStart(2, "0")}:00`

/** Non-negative milliseconds, rounded to seconds; a positive subsecond duration is not zero. */
export const formatDuration = (milliseconds: number, language: Language): string => {
  const text = DURATION_MESSAGES[language]
  if (milliseconds > 0 && milliseconds < 1000) return text.lessThanSecond
  let remaining = Math.round(milliseconds / 1000)
  const parts: string[] = []
  for (const [unit, seconds] of [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ] as const) {
    const amount = Math.floor(remaining / seconds)
    remaining %= seconds
    if (amount > 0) parts.push(`${amount} ${text[unit]}`)
  }
  return parts.length ? parts.join(" ") : `0 ${text.second}`
}
