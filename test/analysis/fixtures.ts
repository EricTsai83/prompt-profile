import { DateTime } from "effect"
import type { SafePrompt } from "../../src/domain/SafePrompt.ts"

/** One prompt per session, `perDay` sessions per day, starting at `from`, for `days` days. */
export const makePrompts = (opts: {
  readonly from: string
  readonly days: number
  readonly perDay?: number
  readonly promptsPerSession?: number
  readonly textSize?: number
}): Array<SafePrompt> => {
  const start = DateTime.toEpochMillis(DateTime.makeUnsafe(opts.from))
  const out: Array<SafePrompt> = []
  for (let d = 0; d < opts.days; d++) {
    for (let s = 0; s < (opts.perDay ?? 1); s++) {
      const sessionId = `d${d}s${s}`
      for (let p = 0; p < (opts.promptsPerSession ?? 1); p++) {
        const t = start + d * 86_400_000 + s * 3_600_000 + p * 60_000
        out.push({
          id: `claude-code:${sessionId}:${p}`,
          sessionId,
          source: "claude-code",
          timestamp: DateTime.makeUnsafe(t),
          project: "demo",
          text: `prompt ${sessionId}/${p} ` + "x".repeat(opts.textSize ?? 100),
        })
      }
    }
  }
  return out
}
