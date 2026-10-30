import type { Stats } from "../domain/Stats.ts"

/** Measured history only: prompt activity cannot establish working hours or completed work. */
export const factsFromStats = (
  stats: Pick<Stats, "totalPrompts" | "totalSessions" | "activeDays" | "longestStreakDays">,
): ReadonlyArray<string> => [
  `Selected history: ${stats.totalPrompts} recorded prompts across ${stats.totalSessions} conversations.`,
  `Recorded prompts appear on ${stats.activeDays} days in this history.`,
  `Longest streak in this history: ${stats.longestStreakDays} consecutive days with recorded prompts.`,
]
