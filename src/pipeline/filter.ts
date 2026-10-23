import { DateTime, Order } from "effect"
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

export interface FilterOptions {
  readonly since: DateTime.Utc | null
  readonly until: DateTime.Utc
  readonly delegationPatterns?: ReadonlyArray<RegExp>
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
  const delegated = new Set<string>()
  const firstSeen = new Set<string>()
  for (const r of sorted) {
    const key = `${r.source}:${r.sessionId}`
    if (firstSeen.has(key)) continue
    firstSeen.add(key)
    if (patterns.some((p) => p.test(r.text))) delegated.add(key)
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
