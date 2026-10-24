import type { Stats } from "../domain/Stats.ts"

/**
 * Measures derived from `stats` for the report: deterministic, with plain definitions shown to
 * the reader. No scores, percentiles or comparisons with other people (there is no baseline).
 */

/** Share of prompts sent 22:00–04:59 (0 without prompts). */
export { nightShare } from "../domain/Stats.ts"

/** The busiest four consecutive hours (wrapping past midnight); `end` is exclusive. */
export const chronotype = (
  s: Pick<Stats, "hourHistogram">,
): { readonly start: number; readonly end: number; readonly share: number } | null => {
  const total = s.hourHistogram.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  let best = { start: 0, sum: -1 }
  for (let start = 0; start < 24; start++) {
    let sum = 0
    for (let i = 0; i < 4; i++) sum += s.hourHistogram[(start + i) % 24]!
    if (sum > best.sum) best = { start, sum }
  }
  return { start: best.start, end: (best.start + 4) % 24, share: best.sum / total }
}

/** Mean prompts per session, one decimal; null without sessions. */
export const promptsPerSession = (s: Pick<Stats, "totalPrompts" | "totalSessions">) =>
  s.totalSessions === 0 ? null : Math.round((10 * s.totalPrompts) / s.totalSessions) / 10

/** "1 in N prompts corrects the AI"; null without corrections. */
export const correctionEvery = (s: Pick<Stats, "correctionRate">): number | null =>
  s.correctionRate <= 0 ? null : Math.round(1 / s.correctionRate)

export interface Chapter {
  /** YYYY-MM, inclusive. */
  readonly from: string
  readonly to: string
  /** Index into `activity.projects`; `projects.length` = other folders. */
  readonly slot: number
  readonly prompts: number
}

/**
 * The dominant project per month, with consecutive months of the same project merged. "Other
 * folders" only names a month when no named project has prompts in it.
 */
export const chapters = (s: Pick<Stats, "activity">): Array<Chapter> => {
  const slots = s.activity.projects.length + 1
  const months = new Map<string, Array<number>>()
  for (const d of s.activity.days) {
    const key = d.date.slice(0, 7)
    const counts = months.get(key) ?? Array.from({ length: slots }, () => 0)
    d.byProject.forEach((n, i) => (counts[i]! += n))
    months.set(key, counts)
  }
  const out: Array<Chapter> = []
  for (const [month, counts] of [...months.entries()].toSorted(([a], [b]) => a.localeCompare(b))) {
    const named = counts.slice(0, slots - 1)
    const pool = named.some((n) => n > 0) ? named : counts
    const slot = pool.indexOf(Math.max(...pool))
    const prompts = counts.reduce((a, b) => a + b, 0)
    const last = out.at(-1)
    if (last && last.slot === slot)
      out[out.length - 1] = { ...last, to: month, prompts: last.prompts + prompts }
    else out.push({ from: month, to: month, slot, prompts })
  }
  return out
}
