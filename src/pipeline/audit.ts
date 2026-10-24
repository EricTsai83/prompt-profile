import type { Profile } from "../domain/Profile.ts"
import { makeRules, type RedactRule } from "./redact.ts"

/**
 * The final output check (plan 18): every displayed string of the profile is checked with the
 * redaction rules before profile.json, the report or a card is written. Prompts were already
 * redacted before the LLM saw them; this catches what generated text, names and descriptions
 * bring back. Findings say where and which rule, never the matched text.
 */

/** Never belong in a report: always masked, and `--allow` cannot release them. */
export const SECRET_RULES = [
  "private-key",
  "connection-string",
  "bearer",
  "key-value-secret",
  "api-token",
  "jwt",
  "high-entropy",
] as const

/**
 * Personal data: masked by default, kept with `--check warn`, releasable with `--allow`.
 * UUID and long-hex rules are left out: they flag identifiers in prompts, which generated text
 * and names do not carry, and would only add noise here.
 */
export const PERSONAL_RULES = [
  "email",
  "home-path",
  "username",
  "internal-url",
  "tw-national-id",
  "credit-card",
  "phone",
] as const

export type SecretRule = (typeof SECRET_RULES)[number]
export type PersonalRule = (typeof PERSONAL_RULES)[number]

export const CHECK_MODES = ["mask", "warn", "strict"] as const
export type CheckMode = (typeof CHECK_MODES)[number]

export interface CheckOptions {
  readonly mode: CheckMode
  /** Personal rules to skip; secret rules here are ignored. */
  readonly allow: ReadonlyArray<string>
  /** OS username for the `username` rule; null disables it. */
  readonly username: string | null
}

export interface Finding {
  /** Human location, e.g. "Traits › 2" or "Headline (zh-TW)". */
  readonly location: string
  readonly rule: string
  readonly tier: "secret" | "personal"
  readonly count: number
  /** False when the text was kept (`--check warn`). */
  readonly masked: boolean
}

export interface CheckResult {
  /** The profile to write: secrets always masked, personal data unless kept. */
  readonly profile: Profile
  readonly findings: ReadonlyArray<Finding>
  /** `--check strict` with at least one finding: nothing may be written. */
  readonly blocked: boolean
}

/** Fields that hold codes, ids or dates, never displayed free text. */
const MACHINE_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "languages",
  "promptId",
  "key",
  "confidence",
  "origin",
  "runner",
  "timezone",
  "kind",
  "source",
  "month",
  "first",
  "last",
])
const DATE_LIKE = /^\d{4}-\d{2}(?:-\d{2})?(?:T[\d:.]+Z?)?$/

const SECTIONS: Readonly<Record<string, string>> = {
  headline: "Headline",
  archetype: "Archetype",
  traits: "Traits",
  dimensions: "Dimensions",
  funFacts: "Fun facts",
  improvements: "Improvements",
  previous: "Last report",
  skills: "Skills",
  subagentTypes: "Agent types",
  mcpServers: "MCP servers",
  models: "Models",
  activity: "Projects",
  topProjects: "Projects",
}

type Path = ReadonlyArray<string | number>

const locationOf = (path: Path): string => {
  const lang = path[0] === "translations" ? String(path[1]) : null
  const rest = lang === null ? path : path.slice(2)
  const stats = rest[0] === "stats"
  const named = stats
    ? rest.find((p) => typeof p === "string" && SECTIONS[p] && p !== "stats")
    : rest[0]
  const section = (typeof named === "string" ? SECTIONS[named] : undefined) ?? String(rest[0])
  const at = rest.findIndex((p) => p === named)
  const index = rest.slice(at + 1).find((p) => typeof p === "number")
  return `${section}${typeof index === "number" ? ` › ${index + 1}` : ""}${lang ? ` (${lang})` : ""}`
}

const isPlain = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" &&
  v !== null &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)

export const checkOutput = (profile: Profile, options: CheckOptions): CheckResult => {
  const secret = new Set<string>(SECRET_RULES)
  const allowed = new Set(options.allow.filter((r) => !secret.has(r)))
  const checked = new Set<string>([...SECRET_RULES, ...PERSONAL_RULES])
  const rules = makeRules(options.username).filter(
    (r) => checked.has(r.name) && !allowed.has(r.name),
  )
  const found = new Map<string, Finding>()

  const checkText = (text: string, path: Path): string => {
    let out = text
    for (const rule of rules) {
      const isSecret = secret.has(rule.name)
      const mask = isSecret || options.mode !== "warn"
      let count = 0
      out = out.replace(rule.pattern, (match: string, ...rest: Array<unknown>) => {
        if (rule.accept && !rule.accept(match)) return match
        count++
        return mask ? replacement(rule, match, rest) : match
      })
      if (count === 0) continue
      const location = locationOf(path)
      const id = `${location}\u0000${rule.name}`
      const prev = found.get(id)
      found.set(id, {
        location,
        rule: rule.name,
        tier: isSecret ? "secret" : "personal",
        count: (prev?.count ?? 0) + count,
        masked: mask,
      })
    }
    return out
  }

  const walk = (value: unknown, path: Path): unknown => {
    if (typeof value === "string") return DATE_LIKE.test(value) ? value : checkText(value, path)
    if (Array.isArray(value)) return value.map((v, i) => walk(v, [...path, i]))
    if (!isPlain(value)) return value
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, MACHINE_KEYS.has(k) ? v : walk(v, [...path, k])]),
    )
  }

  const masked = walk(profile, []) as Profile
  const findings = [...found.values()]
  return { profile: masked, findings, blocked: options.mode === "strict" && findings.length > 0 }
}

const replacement = (rule: RedactRule, match: string, rest: ReadonlyArray<unknown>): string => {
  const groups = rest.filter((g): g is string => typeof g === "string")
  return typeof rule.replace === "string" ? rule.replace : rule.replace(match, ...groups)
}
