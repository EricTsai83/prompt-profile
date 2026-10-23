import { describe, expect, it } from "@effect/vitest"
import { cliMessages } from "../../src/cli/i18n.ts"

describe("sinceLabel", () => {
  it.each([
    ["all", "全部", "all time"],
    ["6m", "最近 6 個月", "last 6m"],
    ["1y", "最近 1 年", "last 1y"],
    ["2w", "最近 2 週", "last 2w"],
    ["30d", "最近 30 天", "last 30d"],
  ] as const)("%s", (since, zh, en) => {
    expect(cliMessages["zh-TW"].sinceLabel(since)).toBe(zh)
    expect(cliMessages.en.sinceLabel(since)).toBe(en)
  })
})
