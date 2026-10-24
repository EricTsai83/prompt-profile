import { DateTime, Order } from "effect"
import { createHash } from "node:crypto"
import type { PromptRecord } from "../domain/PromptRecord.ts"
import { increment, type Counts } from "./counts.ts"

/** Long text repeated across this many distinct sessions is treated as machine-generated. */
export const TEMPLATE_MIN_LENGTH = 200
export const TEMPLATE_MIN_SESSIONS = 3

/**
 * First-prompt patterns of sessions created by an AI orchestrator (e.g. a desktop app's
 * child thread). Such sessions are excluded entirely. Extend after checking
 * `pnpm test:smoke` output (it prints a hash distribution, never the text).
 */
export const DELEGATION_PATTERNS: ReadonlyArray<RegExp> = []

/**
 * Session openings confirmed by the owner as automated subtasks, as `openingKey` values
 * (client + hash of the first 30 characters of the session's first prompt). The hash is what
 * `pnpm test:smoke` prints, so a session can be excluded without its text in the repository.
 * `pnpm inspect:openings` shows the owner the text behind each key, locally.
 */
export const DELEGATION_OPENINGS: ReadonlyArray<string> = []

/** `<client> <8 hex>`: client and sha256 prefix of a prompt's first 30 characters. */
export const openingKey = (r: Pick<PromptRecord, "client" | "text">): string =>
  `${r.client ?? "-"} ${createHash("sha256")
    .update(Array.from(r.text).slice(0, 30).join(""))
    .digest("hex")
    .slice(0, 8)}`

export interface FilterOptions {
  readonly since: DateTime.Utc | null
  readonly until: DateTime.Utc
  readonly delegationPatterns?: ReadonlyArray<RegExp>
  readonly delegationOpenings?: ReadonlyArray<string>
}

export interface FilterResult {
  readonly records: ReadonlyArray<PromptRecord>
  readonly excluded: Counts
}

const byTimeThenId: Order.Order<PromptRecord> = Order.combine(
  Order.mapInput(DateTime.Order, (r: PromptRecord) => r.timestamp),
  Order.mapInput(Order.String, (r: PromptRecord) => r.id),
)

const normalise = (text: string): string => text.trim().replace(/\s+/g, " ")

/** Time window + stable sort + removal of machine-generated prompts. */
export const filterRecords = (
  input: ReadonlyArray<PromptRecord>,
  options: FilterOptions,
): FilterResult => {
  const excluded: Counts = {}
  const inWindow = input.filter(
    (r) =>
      (options.since === null || DateTime.isGreaterThanOrEqualTo(r.timestamp, options.since)) &&
      DateTime.isLessThanOrEqualTo(r.timestamp, options.until),
  )
  const sorted = inWindow.toSorted(byTimeThenId)

  // Rule: repeated-template
  const sessionsByText = new Map<string, Set<string>>()
  for (const r of sorted) {
    const key = normalise(r.text)
    if (key.length <= TEMPLATE_MIN_LENGTH) continue
    const set = sessionsByText.get(key) ?? new Set()
    set.add(`${r.source}:${r.sessionId}`)
    sessionsByText.set(key, set)
  }
  const isTemplate = (r: PromptRecord) =>
    (sessionsByText.get(normalise(r.text))?.size ?? 0) >= TEMPLATE_MIN_SESSIONS

  // Rule: delegated-subtask (whole session, decided by its first prompt)
  const patterns = options.delegationPatterns ?? DELEGATION_PATTERNS
  const openings = new Set(options.delegationOpenings ?? DELEGATION_OPENINGS)
  const delegated = new Set<string>()
  const firstSeen = new Set<string>()
  for (const r of sorted) {
    const key = `${r.source}:${r.sessionId}`
    if (firstSeen.has(key)) continue
    firstSeen.add(key)
    if (patterns.some((p) => p.test(r.text)) || openings.has(openingKey(r))) delegated.add(key)
  }

  const records = sorted.filter((r) => {
    if (delegated.has(`${r.source}:${r.sessionId}`)) {
      increment(excluded, "delegated-subtask")
      return false
    }
    if (isTemplate(r)) {
      increment(excluded, "repeated-template")
      return false
    }
    return true
  })
  return { records, excluded }
}
