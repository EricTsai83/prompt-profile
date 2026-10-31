import { expect, it } from "vitest"
import { statFacts, verifyFunFacts, type FactStats } from "../../src/analysis/facts.ts"

const hours = Array.from({ length: 24 }, (_, h) => (h === 3 ? 461 : h === 23 ? 384 : 10))
const stats: FactStats = {
  totalPrompts: 4409,
  totalSessions: 672,
  activeDays: 53,
  longestStreakDays: 34,
  latestTime: "04:59",
  hourHistogram: hours,
  // Monday first
  weekdayHistogram: [563, 381, 701, 810, 603, 744, 607],
  imageRate: 0.0651,
  languageMix: { zh: 0.8126, en: 0.1338, mixed: 0.0536 },
  promptLength: { median: 56, p90: 1159.9 },
  correctionRate: 0.0113,
}

it("picks the most distinctive measured facts, without inferring a schedule or finished work", () => {
  expect(statFacts(stats)).toEqual([
    "Latest prompt sent: 04:59.",
    "Busiest hour: 3:00, with 461 prompts sent.",
    "Thursday is the busiest weekday, with 810 prompts.",
    "Longest streak: 34 days in a row with prompts.",
    "7% of prompts include an image.",
  ])
  // nothing to say about images when they are rare
  expect(statFacts({ ...stats, imageRate: 0.01 })).not.toContain("1% of prompts include an image.")
})

it("keeps the model's facts whose numbers all come from the stats", () => {
  const facts = verifyFunFacts(
    [
      "81% of your prompts are in Chinese, with English terms mixed in.",
      "Your latest prompt went out at 04:59.",
      "Thursday wins: 810 prompts.",
    ],
    stats,
  )
  expect(facts).toEqual([
    "81% of your prompts are in Chinese, with English terms mixed in.",
    "Your latest prompt went out at 04:59.",
    "Thursday wins: 810 prompts.",
  ])
})

it("drops made-up numbers and number-free claims, then fills up with measured facts", () => {
  const facts = verifyFunFacts(
    [
      "You wrote 9,999 prompts about CSS.",
      "You never sleep.",
      "Your latest prompt went out at 04:59.",
    ],
    stats,
  )
  expect(facts).toEqual([
    "Your latest prompt went out at 04:59.",
    // the measured latest time is already covered
    "Busiest hour: 3:00, with 461 prompts sent.",
    "Thursday is the busiest weekday, with 810 prompts.",
  ])
})

it("reads a clock hour only when it is written as one", () => {
  expect(verifyFunFacts(["Most prompts go out at 3 AM."], stats)[0]).toBe(
    "Most prompts go out at 3 AM.",
  )
  // 3 is not a measured count of anything
  expect(verifyFunFacts(["Longest streak: 3 days."], stats)).not.toContain(
    "Longest streak: 3 days.",
  )
})

it("keeps at most four facts", () => {
  const many = [
    "34 days in a row.",
    "53 active days.",
    "672 conversations.",
    "4,409 prompts.",
    "810 prompts on Thursdays.",
    "461 prompts at 3 AM.",
  ]
  expect(verifyFunFacts(many, stats)).toHaveLength(4)
})
