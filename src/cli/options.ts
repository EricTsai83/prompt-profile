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

/** Longest `--name`: it titles the report. */
export const MAX_NAME_LENGTH = 60

/**
 * `--look`, `--card-hide` (a comma list of CARD_PARTS), `--exclude` (a comma list of
 * REPORT_PARTS or EXCLUDE_GROUPS) and `--name` as render options.
 */
export const parseRenderOptions = (
  look: LookId,
  cardHide: string | undefined,
  exclude?: string | undefined,
  name?: string | undefined,
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
    const trimmed = name?.trim() ?? ""
    if (Array.from(trimmed).length > MAX_NAME_LENGTH)
      return yield* new InvalidArgument({ flag: "--name", value: name! })
    return {
      look,
      cardHide: hide,
      exclude: REPORT_PARTS.filter((p) => parts.includes(p)),
      name: trimmed === "" ? null : trimmed,
    }
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

/** The flags of a main-command run that a re-run must repeat (`--no-cache` never is). */
export interface RunFlags {
  /** How prompt-profile was started (`launcherOf`); default `prompt-profile`. */
  readonly launcher?: string | undefined
  readonly since: string
  /** As typed: `claude` / `codex`. */
  readonly engine?: string | undefined
  readonly model?: string | undefined
  readonly out: string
  readonly full: boolean
  readonly yes: boolean
  readonly maxCalls?: string | undefined
  readonly lang?: string | undefined
  readonly look?: LookId | undefined
  readonly cardHide?: string | undefined
  readonly exclude?: string | undefined
  readonly name?: string | undefined
  readonly check?: string | undefined
  readonly allow?: string | undefined
}

/**
 * The command that starts this prompt-profile again: through npx (`npm exec` sets
 * `npm_command=exec`) at the same version, so the cache stays compatible; otherwise the
 * installed command.
 */
export const launcherOf = (
  env: Readonly<Record<string, string | undefined>>,
  version: string,
): string => (env["npm_command"] === "exec" ? `npx prompt-profile@${version}` : "prompt-profile")

/** A shell word: quoted only when it needs to be. */
const shellWord = (value: string): string =>
  /^[\w@%+=:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`

const flag = (name: string, value: string | undefined, skip?: string): Array<string> =>
  value === undefined || value === skip ? [] : [name, shellWord(value)]

/**
 * The command that repeats a run with the cache read (plan 24): every choice that changes what
 * is analysed or written, without `--no-cache`, `--dry-run` or `--verbose`.
 */
export const rerunCommand = (f: RunFlags): string =>
  [
    f.launcher ?? "prompt-profile",
    ...flag("--since", f.since),
    ...flag("--engine", f.engine),
    ...flag("--model", f.model),
    ...flag("--out", f.out, DEFAULT_OUT),
    ...(f.full ? ["--full"] : []),
    ...flag("--lang", f.lang),
    ...flag("--look", f.look, "classic"),
    ...flag("--card-hide", f.cardHide),
    ...flag("--exclude", f.exclude),
    ...flag("--name", f.name),
    ...flag("--check", f.check, "mask"),
    ...flag("--allow", f.allow),
    ...flag("--max-calls", f.maxCalls),
    ...(f.yes ? ["--yes"] : []),
  ].join(" ")

/**
 * `render` for a written profile with the same render choices and folder: re-creates the report
 * and cards without analysis (e.g. a card whose font was unavailable).
 */
export const renderRetryCommand = (profileJson: string, outDir: string, f: RunFlags): string => {
  const options = [
    ...flag("--look", f.look, "classic"),
    ...flag("--card-hide", f.cardHide),
    ...flag("--exclude", f.exclude),
    ...flag("--name", f.name),
    ...flag("--check", f.check, "mask"),
    ...flag("--allow", f.allow),
  ]
  // Non-default render options would otherwise go to variants/<name>/.
  return [
    `${f.launcher ?? "prompt-profile"} render`,
    shellWord(profileJson),
    ...(options.length > 0 ? ["--out", shellWord(outDir)] : []),
    ...options,
  ].join(" ")
}
