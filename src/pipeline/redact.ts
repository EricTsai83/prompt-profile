import { increment, type Counts } from "./counts.ts"

/**
 * Redaction runs before anything is sent to an LLM. Prefer over-redaction.
 * Rules are applied in order; each has a name so tests and the CLI can report counts.
 */
export interface RedactRule {
  readonly name: string
  /** Must be a global regex. */
  readonly pattern: RegExp
  readonly replace: string | ((match: string, ...groups: Array<string>) => string)
  /** Optional extra check on the full match (e.g. Luhn). Rejected matches stay as-is. */
  readonly accept?: (match: string) => boolean
}

export const SECRET = "[SECRET]"

export const luhnValid = (digits: string): boolean => {
  const ds = digits.replace(/\D/g, "")
  if (ds.length < 13 || ds.length > 19) return false
  let sum = 0
  for (let i = 0; i < ds.length; i++) {
    let d = Number(ds[ds.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

const shannonEntropy = (s: string): number => {
  const freq = new Map<string, number>()
  for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1)
  let h = 0
  for (const n of freq.values()) {
    const p = n / s.length
    h -= p * Math.log2(p)
  }
  return h
}

/**
 * Long random-looking token: ≥ 32 chars, letters and digits, high entropy, and at least one
 * `-`/`_`-separated segment of ≥ 16 chars (kebab-case slugs such as branch or worktree names
 * like `fix-login-2026-10-23-bd8471e3` are not secrets).
 */
export const looksRandom = (s: string): boolean =>
  s.length >= 32 &&
  /[A-Za-z]/.test(s) &&
  /\d/.test(s) &&
  shannonEntropy(s) >= 3.5 &&
  s.split(/[-_]/).some((seg) => seg.length >= 16)

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const KEY_NAMES =
  "password|passwd|pwd|passphrase|secret|client[_-]?secret|token|access[_-]?token|refresh[_-]?token|auth[_-]?token|api[_-]?key|apikey|access[_-]?key|secret[_-]?key|private[_-]?key|credentials?"

export const BASE_RULES: ReadonlyArray<RedactRule> = [
  {
    name: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
    replace: SECRET,
  },
  {
    name: "connection-string",
    pattern: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s:/@]+:[^\s@/]+@/gi,
    replace: (_m, scheme) => `${scheme}${SECRET}@`,
  },
  {
    name: "bearer",
    pattern: /\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/g,
    replace: (_m, kind) => `${kind} ${SECRET}`,
  },
  {
    name: "key-value-secret",
    pattern: new RegExp(`\\b(${KEY_NAMES})(["']?\\s*[:=]\\s*["']?)([^\\s"',;]{4,})`, "gi"),
    replace: (_m, key, sep) => `${key}${sep}${SECRET}`,
  },
  {
    name: "api-token",
    pattern:
      /\b(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abposr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{36}|hf_[A-Za-z0-9]{30,}|rk_live_[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]{20,})/g,
    replace: SECRET,
  },
  {
    name: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    replace: SECRET,
  },
  {
    name: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replace: "[EMAIL]",
  },
  {
    name: "home-path",
    pattern: /(?:\/Users\/|\/home\/)[^/\s"'`]+|[A-Za-z]:\\Users\\[^\\\s"'`]+/g,
    replace: "~",
  },
  {
    name: "internal-url",
    pattern:
      /\b(?:https?:\/\/)?(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:local|internal|corp|lan|intranet|intra))(?::\d+)?(?:\/[^\s"'`)]*)?/g,
    replace: "[INTERNAL_URL]",
  },
  // UUIDs / hashes: identifiers rather than secrets, but useless for profiling and some
  // services use them as API keys → redact with their own marker.
  {
    name: "uuid",
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replace: "[UUID]",
  },
  { name: "hex-hash", pattern: /\b[0-9a-f]{32,}\b/gi, replace: "[HASH]" },
  {
    name: "high-entropy",
    pattern: /[A-Za-z0-9+_-]{32,}={0,2}/g,
    replace: SECRET,
    accept: looksRandom,
  },
  {
    name: "tw-national-id",
    pattern: /\b[A-Z][1289]\d{8}\b/g,
    replace: "[ID]",
  },
  {
    name: "credit-card",
    pattern: /\b\d(?:[ -]?\d){12,18}\b/g,
    replace: "[ID]",
    accept: luhnValid,
  },
  {
    name: "phone",
    pattern:
      /(?:\+\d{1,3}[\s-]?)?(?:\b09\d{2}[\s-]?\d{3}[\s-]?\d{3}\b|\(?\b0\d{1,2}\)?[\s-]?\d{3,4}[\s-]?\d{4}\b|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b)/g,
    replace: "[PHONE]",
  },
]

/** Redact the OS username as a whole word (only if ≥ 3 chars, to avoid nonsense matches). */
export const usernameRule = (username: string | null): ReadonlyArray<RedactRule> =>
  username !== null && username.length >= 3
    ? [
        {
          name: "username",
          pattern: new RegExp(`(?<![A-Za-z0-9_])${escapeRegExp(username)}(?![A-Za-z0-9_])`, "gi"),
          replace: "[USER]",
        },
      ]
    : []

export const makeRules = (username: string | null): ReadonlyArray<RedactRule> => [
  ...BASE_RULES,
  ...usernameRule(username),
]

/** Apply rules in order; counts are added to `counts` by rule name. */
export const redact = (
  text: string,
  rules: ReadonlyArray<RedactRule>,
  counts: Counts = {},
): string => {
  let out = text
  for (const rule of rules) {
    out = out.replace(rule.pattern, (match: string, ...rest: Array<unknown>) => {
      if (rule.accept && !rule.accept(match)) return match
      increment(counts, rule.name)
      const groups = rest.filter((g): g is string => typeof g === "string")
      return typeof rule.replace === "string" ? rule.replace : rule.replace(match, ...groups)
    })
  }
  return out
}

/** Keep only the last path segment of a project path, then redact it. */
export const projectName = (
  project: string | null,
  rules: ReadonlyArray<RedactRule>,
  counts?: Counts,
): string | null => {
  if (project === null) return null
  const last = project
    .split(/[\\/]/)
    .filter((s) => s !== "")
    .at(-1)
  return last === undefined ? null : redact(last, rules, counts)
}
