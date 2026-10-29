/**
 * The experiment matrix of `pnpm eval:compare --config <file>` (plan 22). The file is untrusted:
 * every problem is collected and reported before any quota is spent.
 */
import { LANGUAGES, type Language } from "../../src/domain/Profile.ts"
import { isTimeZone } from "../../src/domain/timezone.ts"
import type { RunnerId } from "../../src/llm/LlmRunner.ts"
import { LOOK_IDS, type LookId } from "../../src/report/looks.ts"

export const CONFIG_VERSION = 1
export const MAX_REPEATS = 20

/** Short config names for the runner ids. */
export const ENGINES: Readonly<Record<string, RunnerId>> = { claude: "claude-code", codex: "codex" }

/** Ids become folder names: lowercase letters, digits and inner hyphens only. */
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,47}$/
/** Passed to the CLI as a flag value: no leading dash, no whitespace or control characters. */
const SAFE_MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/[\]-]{0,99}$/

/** The analysis options a variant may change. Temperature, seed etc. are not exposed by runners. */
export interface AnalysisFactors {
  readonly engine: RunnerId
  /** `null`: the CLI's own default, not a stable named model. */
  readonly model: string | null
  readonly full: boolean
  readonly languages: ReadonlyArray<Language>
}

export interface Variant {
  readonly id: string
  readonly options: AnalysisFactors
  /** Factors that differ from the baseline variant, in AnalysisFactors order. */
  readonly changedFactors: ReadonlyArray<keyof AnalysisFactors>
}

export interface ExperimentConfig {
  readonly version: typeof CONFIG_VERSION
  readonly personas: ReadonlyArray<string>
  readonly repeats: number
  readonly baseline: string
  /** `null`: each persona's own time zone. */
  readonly timezone: string | null
  /** Render-only factor: every successful case is rendered once per look. */
  readonly looks: ReadonlyArray<LookId>
  readonly variants: ReadonlyArray<Variant>
}

export type ParseResult =
  | { readonly ok: true; readonly config: ExperimentConfig }
  | { readonly ok: false; readonly errors: ReadonlyArray<string> }

const isRecord = (u: unknown): u is Record<string, unknown> =>
  typeof u === "object" && u !== null && !Array.isArray(u)

const show = (u: unknown): string => JSON.stringify(u) ?? String(u)

const TOP_KEYS = ["version", "personas", "repeats", "baseline", "shared", "variants"]
const SHARED_KEYS = ["timezone", "languages", "full", "look", "looks"]
const VARIANT_KEYS = ["id", "engine", "model", "full", "languages"]
const FACTORS = ["engine", "model", "full", "languages"] as const

export const parseConfig = (input: unknown, knownPersonas: ReadonlyArray<string>): ParseResult => {
  if (!isRecord(input)) return { ok: false, errors: ["Config must be a JSON object"] }
  const errors: Array<string> = []
  const unknownKeys = (where: string, o: Record<string, unknown>, allowed: Array<string>) => {
    for (const key of Object.keys(o))
      if (!allowed.includes(key)) errors.push(`Unknown key "${key}" in ${where}`)
  }
  unknownKeys("config", input, TOP_KEYS)

  if (input.version !== CONFIG_VERSION)
    errors.push(`"version" must be ${CONFIG_VERSION}, got ${show(input.version)}`)

  const personas: Array<string> = []
  if (!Array.isArray(input.personas) || input.personas.length === 0) {
    errors.push(`"personas" must be a non-empty array of persona names`)
  } else {
    for (const p of input.personas) {
      if (typeof p !== "string" || !SAFE_ID.test(p)) errors.push(`Invalid persona name ${show(p)}`)
      else if (!knownPersonas.includes(p))
        errors.push(`Unknown persona "${p}"; available: ${knownPersonas.join(", ")}`)
      else if (personas.includes(p)) errors.push(`Duplicate persona "${p}"`)
      else personas.push(p)
    }
  }

  const repeats = input.repeats ?? 1
  if (
    !Number.isSafeInteger(repeats) ||
    (repeats as number) < 1 ||
    (repeats as number) > MAX_REPEATS
  )
    errors.push(`"repeats" must be an integer from 1 to ${MAX_REPEATS}, got ${show(repeats)}`)

  const shared = input.shared ?? {}
  let timezone: string | null = null
  let sharedFull = true
  let sharedLanguages: ReadonlyArray<Language> = ["en"]
  let looks: ReadonlyArray<LookId> = ["classic"]
  if (!isRecord(shared)) {
    errors.push(`"shared" must be an object`)
  } else {
    unknownKeys("shared", shared, SHARED_KEYS)
    if (shared.timezone !== undefined && shared.timezone !== null) {
      if (typeof shared.timezone !== "string" || !isTimeZone(shared.timezone))
        errors.push(`shared.timezone ${show(shared.timezone)} is not a known IANA time zone`)
      else timezone = shared.timezone
    }
    if (shared.full !== undefined) {
      if (typeof shared.full !== "boolean") errors.push(`shared.full must be true or false`)
      else sharedFull = shared.full
    }
    if (shared.languages !== undefined)
      sharedLanguages = parseLanguages("shared.languages", shared.languages, errors)
    if (shared.look !== undefined && shared.looks !== undefined) {
      errors.push(`shared.look and shared.looks conflict; use one of them`)
    } else if (shared.look !== undefined || shared.looks !== undefined) {
      const raw = shared.looks ?? [shared.look]
      if (!Array.isArray(raw) || raw.length === 0) errors.push(`shared.looks must be non-empty`)
      else {
        const parsed: Array<LookId> = []
        for (const look of raw) {
          if (!LOOK_IDS.includes(look as LookId))
            errors.push(`Unknown look ${show(look)}; available: ${LOOK_IDS.join(", ")}`)
          else if (parsed.includes(look as LookId)) errors.push(`Duplicate look "${look}"`)
          else parsed.push(look as LookId)
        }
        looks = parsed
      }
    }
  }

  const raw: Array<{ id: string; options: AnalysisFactors }> = []
  if (!Array.isArray(input.variants) || input.variants.length === 0) {
    errors.push(`"variants" must be a non-empty array`)
  } else {
    for (const [i, v] of input.variants.entries()) {
      const where = `variants[${i}]`
      if (!isRecord(v)) {
        errors.push(`${where} must be an object`)
        continue
      }
      unknownKeys(where, v, VARIANT_KEYS)
      const id = v.id
      if (typeof id !== "string" || !SAFE_ID.test(id)) {
        errors.push(
          `${where}: variant id ${show(id)} must be lowercase letters, digits and hyphens (max 48)`,
        )
        continue
      }
      if (raw.some((r) => r.id === id)) errors.push(`Duplicate variant id "${id}"`)
      // Own keys only: "constructor" or "toString" must not resolve through the prototype.
      const engine =
        typeof v.engine === "string" && Object.hasOwn(ENGINES, v.engine)
          ? ENGINES[v.engine]
          : undefined
      if (engine === undefined)
        errors.push(`${where}: engine must be one of ${Object.keys(ENGINES).join(", ")}`)
      if (!("model" in v)) errors.push(`${where}: "model" is required (null = the CLI default)`)
      const model = v.model ?? null
      if (model !== null && (typeof model !== "string" || !SAFE_MODEL.test(model)))
        errors.push(`${where}: model ${show(model)} is not a valid model id`)
      if (v.full !== undefined && typeof v.full !== "boolean")
        errors.push(`${where}: full must be true or false`)
      const languages =
        v.languages === undefined
          ? sharedLanguages
          : parseLanguages(`${where}.languages`, v.languages, errors)
      raw.push({
        id,
        options: {
          engine: engine ?? "claude-code",
          model: typeof model === "string" ? model : null,
          full: typeof v.full === "boolean" ? v.full : sharedFull,
          languages,
        },
      })
    }
  }

  const base = raw.find((r) => r.id === input.baseline)
  if (typeof input.baseline !== "string" || base === undefined)
    errors.push(`baseline ${show(input.baseline)} must be the id of one of the variants`)

  if (errors.length > 0) return { ok: false, errors }
  const variants = raw.map((r) => ({
    ...r,
    changedFactors: FACTORS.filter((f) => show(r.options[f]) !== show(base!.options[f])),
  }))
  return {
    ok: true,
    config: {
      version: CONFIG_VERSION,
      personas,
      repeats: repeats as number,
      baseline: base!.id,
      timezone,
      looks,
      variants,
    },
  }
}

const parseLanguages = (
  where: string,
  input: unknown,
  errors: Array<string>,
): ReadonlyArray<Language> => {
  if (!Array.isArray(input) || input.length === 0) {
    errors.push(`${where} must be a non-empty array of languages`)
    return ["en"]
  }
  const out: Array<Language> = []
  for (const l of input) {
    if (!LANGUAGES.includes(l as Language))
      errors.push(`Unsupported language ${show(l)} in ${where}; supported: ${LANGUAGES.join(", ")}`)
    else if (out.includes(l as Language)) errors.push(`Duplicate language "${l}" in ${where}`)
    else out.push(l as Language)
  }
  return out
}

/** Invalid command-line usage or configuration: exit code 2, nothing runs. */
export class UsageError extends Error {}

/** `--budget`: the cap on CLI attempts, including retries and translations. */
export const parseBudget = (text: string): number => {
  const n = /^\d+$/.test(text) ? Number(text) : Number.NaN
  if (!Number.isSafeInteger(n) || n < 1) throw new UsageError("--budget must be a positive integer")
  return n
}

/** The pre-config usage (`--engines claude,codex --repeats 2`): CLI-default models, every persona. */
export const legacyConfig = (
  engines: ReadonlyArray<string>,
  repeats: number,
  personas: ReadonlyArray<string>,
): unknown => ({
  version: CONFIG_VERSION,
  personas,
  repeats,
  baseline: `${engines[0]}-default`,
  shared: { full: true, languages: ["en"], look: "classic" },
  variants: engines.map((engine) => ({ id: `${engine}-default`, engine, model: null })),
})
