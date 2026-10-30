import { expect, it } from "vitest"
import { factsFromStats } from "../../src/analysis/facts.ts"

it("describes recorded activity without inferring a work schedule or completed actions", () => {
  expect(
    factsFromStats({ totalPrompts: 16, totalSessions: 8, activeDays: 8, longestStreakDays: 4 }),
  ).toEqual([
    "Selected history: 16 recorded prompts across 8 conversations.",
    "Recorded prompts appear on 8 days in this history.",
    "Longest streak in this history: 4 consecutive days with recorded prompts.",
  ])
})
