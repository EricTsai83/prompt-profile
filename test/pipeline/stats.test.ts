import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect, Schema, Stream } from "effect"
import { Stats } from "../../src/domain/Stats.ts"
import { processRecords, runPipeline } from "../../src/pipeline/index.ts"
import { classifyLanguage, isCorrection } from "../../src/pipeline/stats.ts"
import { rec } from "./records.ts"

const now = DateTime.makeUnsafe("2026-10-24T00:00:00Z")
const options = { since: null, now, timezone: "Asia/Taipei", username: "alice" }

// Asia/Taipei = UTC+8
const records = [
  rec("請幫我把登入頁面改成深色模式", "2026-09-01T02:00:00Z"), // Tue 10:00
  rec("no, that's wrong. use a Map instead", "2026-09-01T03:00:00Z", {
    origin: "sdk",
    client: "sdk-ts",
  }), // Tue 11:00
  rec("幫我寫 reducer 的 unit test", "2026-09-02T15:30:00Z", { hasImage: true }), // Wed 23:30
  rec("still broken after the fix", "2026-09-02T18:12:00Z"), // Thu 02:12 → still "Wed" logical day
  rec("ok", "2026-09-03T03:00:00Z"), // Thu 11:00, cleaned away
  rec("deploy to staging please", "2026-09-05T01:00:00Z", {
    source: "codex",
    sessionId: "c1",
    id: "codex:c1:1",
    origin: "exec",
    project: "/home/bob/infra",
  }), // Sat 09:00
  rec("mail alice@example.com about it", "2026-09-06T01:00:00Z", { sessionId: "s2" }), // Sun 09:00
]

describe("stats", () => {
  it("computes stats from filtered and cleaned data", () => {
    const { stats } = processRecords(records, {
      ...options,
      slashCommands: { "/clear": 3, "/model": 1 },
    })
    expect(Schema.is(Stats)(stats)).toBe(true)
    expect(Schema.encodeSync(Stats)(stats)).toMatchSnapshot()
    expect(stats.totalPrompts).toBe(7)
    expect(stats.analyzedPrompts).toBe(6)
    expect(stats.totalSessions).toBe(3)
    expect(stats.latestTime).toBe("02:12")
    // 09-01, 09-02 (incl. 02:12 on 09-03), 09-03 11:00, 09-05, 09-06
    expect(stats.activeDays).toBe(5)
    expect(stats.longestStreakDays).toBe(3)
    expect(stats.topProjects).toEqual([
      { name: "drawstuff", count: 6 },
      { name: "infra", count: 1 },
    ])
    expect(stats.languageMix.zh + stats.languageMix.en + stats.languageMix.mixed).toBeCloseTo(1, 6)
    expect(stats.correctionRate).toBeCloseTo(2 / 6, 3)
  })

  it("latestTime is null without evening activity and handles empty input", () => {
    const { stats } = processRecords([rec("morning work item", "2026-09-01T02:00:00Z")], options)
    expect(stats.latestTime).toBeNull()
    const empty = processRecords([], options).stats
    expect(empty.dateRange).toBeNull()
    expect(Schema.is(Stats)(empty)).toBe(true)
  })

  it("latestTime prefers after-midnight over late evening", () => {
    const { stats } = processRecords(
      [rec("late one", "2026-09-01T15:59:00Z"), rec("later one", "2026-09-01T16:05:00Z")],
      options,
    )
    expect(stats.latestTime).toBe("00:05")
  })

  it.each([
    ["請幫我把登入頁面改成深色模式", "zh"],
    ["幫我把這個 reducer 改成 async", "zh"],
    ["fix the login bug please", "en"],
    ["use a Map instead of object 好嗎", "mixed"],
  ] as const)("language of %j is %s", (text, lang) => {
    expect(classifyLanguage(text)).toBe(lang)
  })

  it.each([
    ["不對，應該是 Map", true],
    ["No, revert that", true],
    ["that's not what I asked", true],
    ["no problem, thanks", false],
    ["Node is great", false],
  ] as const)("correction %j → %s", (text, expected) => {
    expect(isCorrection(text)).toBe(expected)
  })
})

describe("runPipeline", () => {
  it("redacts before truncating: a secret at the cut point never leaks in part", () => {
    const key = "sk-proj-A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6"
    const filler = "請幫我看這段設定為什麼不能用。".repeat(400)
    // the middle cut keeps the first 2376 characters: start the key just before it
    for (const pad of [2362, 2366, 2370, 2374]) {
      const text = `${"x ".repeat(pad / 2)}${key} ${filler}`
      const { prompts, report } = processRecords([rec(text, "2026-09-01T02:00:00Z")], options)
      const sent = prompts[0]!.text
      expect(report.truncated).toBe(1)
      for (let i = 0; i + 6 <= key.length; i++) expect(sent).not.toContain(key.slice(i, i + 6))
    }
  })

  it("counts redactions in project names (they are sent to the LLM)", () => {
    const { prompts, report } = processRecords(
      [rec("rename the folder please", "2026-09-01T02:00:00Z", { project: "/work/alice" })],
      options,
    )
    expect(prompts[0]!.project).toBe("[USER]")
    expect(report.redactions).toEqual({ username: 1 })
  })

  it.effect("produces safe prompts with redacted text and project names", () =>
    Effect.gen(function* () {
      const result = yield* runPipeline(Stream.fromIterable(records), options)
      expect(result.prompts.map((p) => p.text)).toContain("mail [EMAIL] about it")
      expect(result.prompts.every((p) => p.project === null || !p.project.includes("/"))).toBe(true)
      expect(result.report).toMatchSnapshot()
      expect(Object.keys(result.prompts[0]!).toSorted()).toEqual([
        "id",
        "project",
        "sessionId",
        "source",
        "text",
        "timestamp",
      ])
    }),
  )
})
