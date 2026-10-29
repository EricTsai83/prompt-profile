import { DateTime } from "effect"
import type { Language, Profile } from "../domain/Profile.ts"
import { totalTokens } from "../domain/Usage.ts"
import { CARD_MESSAGES, MESSAGES } from "./messages.ts"

/** Measured context for a share card. Usage and prompt periods can differ. */
export const cardSummary = (
  p: Profile,
  lang: Language,
  showUsage: boolean,
  exactDates = true,
): { metrics: Array<[string, string]>; note: string } => {
  const t = CARD_MESSAGES[lang]
  const locale = MESSAGES[lang].locale
  const number = (n: number) =>
    new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n)
  const metrics: Array<[string, string]> = [
    [t.prompts, number(p.stats.totalPrompts)],
    [t.sessions, number(p.stats.totalSessions)],
  ]
  if (!showUsage)
    return {
      metrics: [
        ...metrics,
        [t.active, number(p.stats.activeDays)],
        [t.streak, number(p.stats.longestStreakDays)],
      ],
      note: "",
    }
  const u = p.usage
  if (!u) return { metrics: [...metrics, [t.tokens, t.missing], [t.cost, t.missing]], note: "" }
  const requests = u.sources.reduce((n, s) => n + s.totals.requests, 0)
  const tokens = u.sources.reduce((n, s) => n + totalTokens(s.totals.tokens), 0)
  const priced = u.sources.some((s) => s.totals.cost !== null)
  const partial = u.sources.some(
    (s) => s.totals.unpricedRequests > 0 || (s.totals.requests > 0 && s.totals.cost === null),
  )
  const amount = u.sources.reduce((n, s) => n + (s.totals.cost ?? 0), 0)
  const price = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(amount)
  metrics.push(
    [t.tokens, number(tokens)],
    [t.cost, requests === 0 ? t.empty : !priced ? t.unknown : `${price}${partial ? "+" : ""}`],
  )
  const date = (d: DateTime.Utc) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: p.stats.timezone,
      year: "numeric",
      month: "short",
      ...(exactDates ? { day: "numeric" as const } : {}),
    }).format(DateTime.toEpochMillis(d))
  const period = u.range ? `${date(u.range.from)} – ${date(u.range.to)}` : t.periodUnknown
  const incomplete = u.sources.some(
    (s) => s.diagnostics.badLines > 0 || s.diagnostics.unreadableFiles > 0,
  )
  return {
    metrics,
    note: [
      `${t.usage}: ${period}`,
      partial && priced ? t.partial : null,
      incomplete ? t.incomplete : null,
    ]
      .filter((x) => x !== null)
      .join(" · "),
  }
}

/** Scope for prompt counts; separate from usage response dates. */
export const cardPeriod = (p: Profile, lang: Language, exactDates: boolean): string => {
  const t = CARD_MESSAGES[lang]
  const range = p.stats.dateRange
  if (!range) return `${t.activity}: ${t.periodUnknown}`
  const date = (d: DateTime.Utc) =>
    new Intl.DateTimeFormat(MESSAGES[lang].locale, {
      timeZone: p.stats.timezone,
      year: "numeric",
      month: "short",
      ...(exactDates ? { day: "numeric" as const } : {}),
    }).format(DateTime.toEpochMillis(d))
  return `${t.activity}: ${date(range.from)} – ${date(range.to)}`
}
