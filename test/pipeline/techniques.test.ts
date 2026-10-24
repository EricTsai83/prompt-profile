import { describe, expect, it } from "@effect/vitest"
import { DateTime } from "effect"
import type { TechniqueEvent } from "../../src/domain/Techniques.ts"
import { processRecords } from "../../src/pipeline/index.ts"
import { promptTechniquesOf } from "../../src/pipeline/techniques.ts"
import { rec } from "./records.ts"

const now = DateTime.makeUnsafe("2026-10-24T00:00:00Z")
const options = { since: null, now, timezone: "Asia/Taipei", username: "alice" }

describe("prompt techniques", () => {
  it.each([
    ["don't write code yet, break the plan into small steps", ["planFirst", "constraints"]],
    ["先不要寫 code，幫我把計畫拆成小步驟", ["planFirst", "constraints"]],
    ["TypeError: x is undefined when I click save, see src/app/save.ts", ["context", "filePaths"]],
    ["it should return 404 when the user is missing; add a test", ["acceptance", "verification"]],
    [
      "for example like the shadow-sm in tailwind, and output a markdown table",
      ["examples", "outputFormat"],
    ],
    ["1. rename the flag\n2. update the docs", ["structured"]],
    ["為什麼 Safari 上 sticky header 會跳一下？", ["whyExplain"]],
    ["ok thanks", []],
  ])("%s", (text, expected) => {
    expect(promptTechniquesOf(text).toSorted()).toEqual([...expected].toSorted())
  })
})

describe("techniques in stats", () => {
  const records = [
    rec("plan the migration first, list the steps", "2026-09-01T02:00:00Z", { sessionId: "a" }),
    rec("now add a test for the rollback", "2026-09-01T03:00:00Z", { sessionId: "a" }),
    rec("why does the build fail?", "2026-09-01T02:30:00Z", { sessionId: "b" }),
    rec("rename the variable in src/x.ts", "2026-10-02T02:00:00Z", { sessionId: "c" }),
  ]
  const ms = (iso: string) => Date.parse(iso)
  const events: Array<TechniqueEvent> = [
    {
      source: "claude-code",
      sessionId: "a",
      timestampMs: ms("2026-09-01T02:10:00Z"),
      kind: "subagents",
    },
    {
      source: "claude-code",
      sessionId: "a",
      timestampMs: ms("2026-09-01T02:20:00Z"),
      kind: "subagents",
    },
    {
      source: "claude-code",
      sessionId: "c",
      timestampMs: ms("2026-10-02T02:05:00Z"),
      kind: "planMode",
    },
    // outside the window: ignored
    {
      source: "claude-code",
      sessionId: "z",
      timestampMs: ms("2027-01-01T00:00:00Z"),
      kind: "skills",
    },
  ]

  it("counts workflow uses and sessions, prompt shares, months and overlap", () => {
    const t = processRecords(records, { ...options, events }).stats.techniques!
    expect(t.tools.subagents).toEqual({ count: 2, sessions: 1 })
    expect(t.tools.planMode).toEqual({ count: 1, sessions: 1 })
    expect(t.tools.skills).toEqual({ count: 0, sessions: 0 })
    expect(t.prompts.planFirst).toBe(0.25)
    expect(t.prompts.verification).toBe(0.25)
    expect(t.monthly.map((m) => [m.month, m.sessions, m.prompts, m.tools.subagents])).toEqual([
      ["2026-09", 2, 3, 1],
      ["2026-10", 1, 1, 0],
    ])
    // sessions a (02:00–03:00) and b (02:30) overlap on one day
    expect(t.maxParallel).toBe(2)
    expect(t.parallelDays).toBe(1)
  })

  it("workflow shares use only sessions with transcript metadata; months are continuous", () => {
    const covered: Array<TechniqueEvent> = [
      ...events,
      {
        source: "claude-code",
        sessionId: "a",
        timestampMs: ms("2026-09-01T02:00:00Z"),
        kind: "transcript",
      },
      {
        source: "claude-code",
        sessionId: "c",
        timestampMs: ms("2026-10-02T02:00:00Z"),
        kind: "transcript",
      },
    ]
    const gap = [
      ...records,
      rec("a prompt in december", "2026-12-03T02:00:00Z", { sessionId: "d" }),
    ]
    const t = processRecords(gap, {
      ...options,
      now: DateTime.makeUnsafe("2027-01-01T00:00:00Z"),
      events: covered,
    }).stats.techniques!
    // b has no transcript: only a and c count
    expect(t.coveredSessions).toBe(2)
    expect(t.monthly.map((m) => [m.month, m.covered])).toEqual([
      ["2026-09", 1],
      ["2026-10", 1],
      // a month without any activity is still shown
      ["2026-11", 0],
      ["2026-12", 0],
    ])
  })

  it("without events the workflow counts are zero, not missing", () => {
    const t = processRecords(records, options).stats.techniques!
    expect(t.tools.subagents).toEqual({ count: 0, sessions: 0 })
  })
})
