import { describe, expect, it } from "@effect/vitest"
import { DateTime } from "effect"
import { filterRecords } from "../../src/pipeline/filter.ts"
import { rec } from "./records.ts"

const until = DateTime.makeUnsafe("2026-10-24T00:00:00Z")

describe("filter", () => {
  it("applies the since boundary inclusively and drops future records", () => {
    const since = DateTime.makeUnsafe("2026-09-01T00:00:00Z")
    const records = [
      rec("before", "2026-08-31T23:59:59Z"),
      rec("at boundary", "2026-09-01T00:00:00Z"),
      rec("future", "2026-10-25T00:00:00Z"),
    ]
    expect(filterRecords(records, { since, until }).records.map((r) => r.text)).toEqual([
      "at boundary",
    ])
    expect(filterRecords(records, { since: null, until }).records).toHaveLength(2)
  })

  it("sorts by timestamp, then id (stable)", () => {
    const records = [
      rec("b", "2026-09-02T00:00:00Z", { id: "x:2" }),
      rec("a2", "2026-09-01T00:00:00Z", { id: "x:b" }),
      rec("a1", "2026-09-01T00:00:00Z", { id: "x:a" }),
    ]
    expect(filterRecords(records, { since: null, until }).records.map((r) => r.text)).toEqual([
      "a1",
      "a2",
      "b",
    ])
  })

  it("removes long text repeated across ≥ 3 sessions", () => {
    const template = "Review this pull request carefully. ".repeat(10)
    const records = [
      rec(template, "2026-09-01T00:00:00Z", { sessionId: "a" }),
      rec(template, "2026-09-02T00:00:00Z", { sessionId: "b" }),
      rec(` ${template}`, "2026-09-03T00:00:00Z", { sessionId: "c" }),
      rec("short repeated", "2026-09-01T00:00:00Z", { sessionId: "a" }),
      rec("short repeated", "2026-09-02T00:00:00Z", { sessionId: "b" }),
      rec("short repeated", "2026-09-03T00:00:00Z", { sessionId: "c" }),
      rec("Long but only twice. ".repeat(12), "2026-09-01T00:00:00Z", { sessionId: "a" }),
      rec("Long but only twice. ".repeat(12), "2026-09-02T00:00:00Z", { sessionId: "b" }),
    ]
    const result = filterRecords(records, { since: null, until })
    expect(result.records).toHaveLength(5)
    expect(result.excluded).toEqual({ "repeated-template": 3 })
  })

  it("excludes whole sessions whose first prompt matches a delegation pattern", () => {
    const records = [
      rec("You are a subagent. Task: fix tests", "2026-09-01T00:00:00Z", { sessionId: "child" }),
      rec("follow-up in child", "2026-09-01T00:01:00Z", { sessionId: "child" }),
      rec("You are a subagent? no, I typed this", "2026-09-01T00:02:00Z", {
        sessionId: "human",
        id: "h:1",
      }),
      rec("hello", "2026-09-01T00:00:30Z", { sessionId: "human", id: "h:0" }),
    ]
    const result = filterRecords(records, {
      since: null,
      until,
      delegationPatterns: [/^You are a subagent\./],
    })
    expect(result.records.map((r) => r.sessionId)).toEqual(["human", "human"])
    expect(result.excluded).toEqual({ "delegated-subtask": 2 })
  })
})
