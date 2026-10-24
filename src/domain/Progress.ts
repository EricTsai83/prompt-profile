import { Schema } from "effect"
import {
  PROMPT_TECHNIQUES,
  TOOL_TECHNIQUES,
  type PromptTechnique,
  type ToolTechnique,
} from "./Techniques.ts"
import { nightShare, type Stats } from "./Stats.ts"

/**
 * The previous report's key numbers (plan 17), kept in the new profile so the report can say
 * what changed. Numbers and improvement titles only: no quotes, no project names.
 */

const Ratio = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }))
const ratiosOf = <const K extends ReadonlyArray<string>>(keys: K) =>
  Schema.Struct(
    Object.fromEntries(keys.map((k) => [k, Ratio])) as { readonly [P in K[number]]: typeof Ratio },
  )

export const Snapshot = Schema.Struct({
  generatedAt: Schema.DateTimeUtcFromString,
  correctionRate: Ratio,
  terseShare: Ratio,
  nightShare: Ratio,
  /** Share of sessions using each workflow technique (0 when unknown). */
  toolShares: ratiosOf(TOOL_TECHNIQUES),
  promptShares: ratiosOf(PROMPT_TECHNIQUES),
  /** Titles of the improvements suggested then (English). */
  improvements: Schema.Array(Schema.String),
})
export type Snapshot = typeof Snapshot.Type

const round = (x: number) => Math.round(x * 10_000) / 10_000

export const snapshotOf = (p: {
  readonly generatedAt: Snapshot["generatedAt"]
  readonly stats: Stats
  readonly improvements: ReadonlyArray<{ readonly title: string }>
}): Snapshot => {
  const s = p.stats
  const t = s.techniques
  return {
    generatedAt: p.generatedAt,
    correctionRate: s.correctionRate,
    terseShare: s.promptHabits.terseShare,
    nightShare: round(nightShare(s)),
    toolShares: Object.fromEntries(
      TOOL_TECHNIQUES.map((k: ToolTechnique) => [
        k,
        t === null || t.coveredSessions === 0
          ? 0
          : round(Math.min(1, t.tools[k].sessions / t.coveredSessions)),
      ]),
    ) as Snapshot["toolShares"],
    promptShares: Object.fromEntries(
      PROMPT_TECHNIQUES.map((k: PromptTechnique) => [k, t === null ? 0 : t.prompts[k]]),
    ) as Snapshot["promptShares"],
    improvements: p.improvements.map((i) => i.title),
  }
}
