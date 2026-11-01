import { DateTime } from "effect"
import { type Language, type Profile, totalTokens } from "../domain/index.ts"
import { CARD_MESSAGES, MESSAGES } from "./messages.ts"

const periodText = (
  p: Profile,
  range: Profile["stats"]["dateRange"],
  lang: Language,
  exactDates: boolean,
): string => {
  if (!range) return CARD_MESSAGES[lang].periodUnknown
  const date = (d: DateTime.Utc) =>
    new Intl.DateTimeFormat(MESSAGES[lang].locale, {
      timeZone: p.stats.timezone,
      year: "numeric",
      month: "short",
      ...(exactDates ? { day: "numeric" as const } : {}),
    }).format(DateTime.toEpochMillis(d))
  return `${date(range.from)} – ${date(range.to)}`
}

const usageQualifiers = (p: Profile, lang: Language): Array<string> => {
  const sources = p.usage?.sources ?? []
  const partial = sources.some(
    (s) => s.totals.unpricedRequests > 0 || (s.totals.requests > 0 && s.totals.cost === null),
  )
  return [
    partial && sources.some((s) => s.totals.cost !== null) ? CARD_MESSAGES[lang].partial : null,
    sources.some((s) => s.diagnostics.badLines > 0 || s.diagnostics.unreadableFiles > 0)
      ? CARD_MESSAGES[lang].incomplete
      : null,
  ].filter((x) => x !== null)
}

/** One scope block; equal local calendar ranges share a date line, never two unknown ranges. */
export const cardContext = (
  p: Profile,
  lang: Language,
  showUsage: boolean,
  exactDates: boolean,
): Array<string> => {
  const t = CARD_MESSAGES[lang]
  if (!showUsage || !p.usage) return [cardPeriod(p, lang, exactDates)]
  const notes = usageQualifiers(p, lang)
  const activity = p.stats.dateRange
  const usage = p.usage.range
  const same =
    activity !== null &&
    usage !== null &&
    periodText(p, activity, lang, true) === periodText(p, usage, lang, true)
  return [
    ...(same
      ? [`${t.activityAndUsage}${periodText(p, activity, lang, exactDates)}`]
      : [cardPeriod(p, lang, exactDates), `${t.usage}: ${periodText(p, usage, lang, exactDates)}`]),
    ...(notes.length ? [notes.join(" · ")] : []),
  ]
}

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

  return {
    metrics,
    note: [
      `${t.usage}: ${periodText(p, u.range, lang, exactDates)}`,
      ...usageQualifiers(p, lang),
    ].join(" · "),
  }
}

/** Scope for prompt counts; separate from usage response dates. */
export const cardPeriod = (p: Profile, lang: Language, exactDates: boolean): string =>
  `${CARD_MESSAGES[lang].activity}: ${periodText(p, p.stats.dateRange, lang, exactDates)}`
