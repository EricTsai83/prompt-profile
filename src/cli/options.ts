import { DateTime, Effect } from "effect"
import { LANGUAGES, type Language } from "../domain/Profile.ts"
import { CARD_PARTS, type CardPart, type LookId, type RenderOptions } from "../report/looks.ts"
import { InvalidArgument } from "./errors.ts"

/** Interpreting flag values. */

export const DEFAULT_OUT = "prompt-profile-report"

/**
 * `1m` / `3m` / `6m` / `1y` / `all` (also `<n>d`, `<n>w`, `<n>m`, `<n>y`). A range reaching
 * back before 1970 (or past what a Date can hold) means everything, like `all`.
 */
export const parseSince = (
  value: string,
  now: DateTime.Utc,
): Effect.Effect<DateTime.Utc | null, InvalidArgument> => {
  if (value === "all") return Effect.succeed(null)
  const m = /^(\d+)([dwmy])$/.exec(value.trim())
  if (!m || Number(m[1]) === 0) return Effect.fail(new InvalidArgument({ flag: "--since", value }))
  const n = Number(m[1])
  const parts = { d: { days: n }, w: { weeks: n }, m: { months: n }, y: { years: n } }[
    m[2] as "d" | "w" | "m" | "y"
  ]
  const since = DateTime.toEpochMillis(DateTime.subtract(now, parts))
  return Effect.succeed(Number.isFinite(since) && since >= 0 ? DateTime.makeUnsafe(since) : null)
}

/** `--look` and `--card-hide` (a comma list of CARD_PARTS) as render options. */
export const parseRenderOptions = (
  look: LookId,
  cardHide: string | undefined,
): Effect.Effect<RenderOptions, InvalidArgument> => {
  if (cardHide === undefined) return Effect.succeed({ look, cardHide: [] })
  const parts = cardHide.split(",").map((p) => p.trim())
  const isPart = (p: string): p is CardPart => (CARD_PARTS as ReadonlyArray<string>).includes(p)
  return parts.every(isPart)
    ? Effect.succeed({ look, cardHide: parts })
    : Effect.fail(new InvalidArgument({ flag: "--card-hide", value: cardHide }))
}

/** A Chinese locale gets a Traditional Chinese report with English; anything else English. */
export const defaultLanguages = (locale: string): Array<Language> =>
  /^zh(?:[-_]|$)/i.test(locale) ? ["zh-TW", "en"] : ["en"]

/** `--lang zh-TW,en` (the first is the default), or the locale's default when not given. */
export const parseLanguages = (
  value: string | undefined,
  locale: string,
): Effect.Effect<Array<Language>, InvalidArgument> => {
  if (value === undefined) return Effect.succeed(defaultLanguages(locale))
  const parts = value.split(",").map((p) => p.trim())
  const isLanguage = (p: string): p is Language => (LANGUAGES as ReadonlyArray<string>).includes(p)
  return parts.length > 0 && parts.every(isLanguage)
    ? Effect.succeed([...new Set(parts)])
    : Effect.fail(new InvalidArgument({ flag: "--lang", value }))
}
