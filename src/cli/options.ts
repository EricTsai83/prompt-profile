import { DateTime, Effect } from "effect"
import { LANGUAGES, type Language } from "../domain/Profile.ts"
import {
  CARD_PARTS,
  EXCLUDE_GROUPS,
  REPORT_PARTS,
  type CardPart,
  type LookId,
  type RenderOptions,
  type ReportPart,
} from "../report/looks.ts"
import { PERSONAL_RULES, type PersonalRule } from "../pipeline/audit.ts"
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

/**
 * `--look`, `--card-hide` (a comma list of CARD_PARTS) and `--exclude` (a comma list of
 * REPORT_PARTS or EXCLUDE_GROUPS) as render options.
 */
export const parseRenderOptions = (
  look: LookId,
  cardHide: string | undefined,
  exclude?: string | undefined,
): Effect.Effect<RenderOptions, InvalidArgument> =>
  Effect.gen(function* () {
    const list = (value: string | undefined) =>
      value === undefined ? [] : value.split(",").map((p) => p.trim())
    const hide = list(cardHide)
    const isPart = (p: string): p is CardPart => (CARD_PARTS as ReadonlyArray<string>).includes(p)
    if (!hide.every(isPart))
      return yield* new InvalidArgument({ flag: "--card-hide", value: cardHide! })
    const parts: Array<ReportPart> = []
    for (const p of list(exclude)) {
      const group = EXCLUDE_GROUPS[p]
      if (group) parts.push(...group)
      else if ((REPORT_PARTS as ReadonlyArray<string>).includes(p)) parts.push(p as ReportPart)
      else return yield* new InvalidArgument({ flag: "--exclude", value: exclude! })
    }
    return { look, cardHide: hide, exclude: REPORT_PARTS.filter((p) => parts.includes(p)) }
  })

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

/** `--allow`: a comma list of personal rules (secret rules can never be allowed). */
export const parseAllow = (
  value: string | undefined,
): Effect.Effect<Array<PersonalRule>, InvalidArgument> => {
  if (value === undefined) return Effect.succeed([])
  const parts = value.split(",").map((p) => p.trim())
  const isPersonal = (p: string): p is PersonalRule =>
    (PERSONAL_RULES as ReadonlyArray<string>).includes(p)
  return parts.every(isPersonal)
    ? Effect.succeed([...new Set(parts)])
    : Effect.fail(new InvalidArgument({ flag: "--allow", value }))
}
