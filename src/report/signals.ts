import type { Stats } from "../domain/Stats.ts"

/**
 * Deterministic prompting signals (plan 16): a number from `stats` and a threshold. Only
 * triggered signals are shown, each with a fixed tip (`messages.ts`). The thresholds are
 * judgement calls, documented here so they can be tuned; the numbers are always exact.
 */
export interface Signal {
  readonly id: "corrections" | "terse" | "longSessions" | "reusedOpenings"
  readonly value: (s: Stats) => number
  readonly triggered: (value: number) => boolean
}

export const SIGNALS: ReadonlyArray<Signal> = [
  // More than 1 correction in 12 prompts: the first prompts often miss a requirement.
  { id: "corrections", value: (s) => s.correctionRate, triggered: (v) => v >= 0.08 },
  // A fifth of prompts under ~4 words: the AI has to guess the context.
  { id: "terse", value: (s) => s.promptHabits.terseShare, triggered: (v) => v >= 0.2 },
  // Many very long conversations: stale context piles up.
  {
    id: "longSessions",
    value: (s) => s.promptHabits.longSessionShare,
    triggered: (v) => v >= 0.15,
  },
  // The same opening in 3+ sessions: worth saving as a command or note.
  {
    id: "reusedOpenings",
    value: (s) => s.promptHabits.reusedOpenings.openings,
    triggered: (v) => v >= 1,
  },
]

export const triggeredSignals = (s: Stats): Array<Signal & { readonly amount: number }> =>
  SIGNALS.flatMap((signal) => {
    const amount = signal.value(s)
    return signal.triggered(amount) ? [{ ...signal, amount }] : []
  })
