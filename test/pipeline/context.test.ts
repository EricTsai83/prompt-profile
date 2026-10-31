import { describe, expect, it } from "@effect/vitest"
import { selectContext } from "../../src/pipeline/context.ts"
import { rec } from "./records.ts"

const records = [
  rec("Investigate the failure", "2026-09-01T00:00:00Z", { project: "/work/app" }),
  rec("yes", "2026-09-01T00:01:00Z", { project: "/work/app" }),
  rec("Excluded name", "2026-09-01T00:02:00Z", { project: "/work/secret" }),
  rec("Unknown", "2026-09-01T00:03:00Z", { project: null }),
]
describe("context selection", () => {
  it("selects exact metadata and retains follow-ups without importing missing metadata", () => {
    const result = selectContext(records, "label:app")
    expect(result.records.map((r) => r.text)).toEqual(["Investigate the failure", "yes"])
    expect(result.coverage).toMatchObject({ selected: 2, excluded: 1, missing: 1 })
    expect(JSON.stringify(result.coverage)).not.toContain("secret")
    expect(JSON.stringify(result.coverage)).not.toContain("/work")
  })
  it("rejects ambiguous labels and invalid selectors without disclosing paths", () => {
    expect(() =>
      selectContext([...records, { ...records[0]!, project: "/other/app" }], "label:app"),
    ).toThrow("ambiguous")
    expect(() => selectContext(records, "app")).toThrow(
      "Expected label:NAME or path:/absolute/path",
    )
    expect(() => selectContext(records, "path:app")).toThrow(
      "Expected label:NAME or path:/absolute/path",
    )
  })
  it("distinguishes renamed paths, absent contexts and source identities", () => {
    expect(selectContext(records, "path:/renamed/app").records).toEqual([])
    const duplicate = { ...records[0]!, source: "codex" as const, id: "codex:duplicate" }
    expect(selectContext([...records, duplicate], "path:/work/app").records).toHaveLength(3)
  })
})

import { cleanRecords } from "../../src/pipeline/clean.ts"
it("keeps short follow-ups with a substantive opening, and counts orphan acknowledgements", () => {
  const result = cleanRecords(records.slice(0, 2), true)
  expect(result.prompts.map((p) => p.text)).toEqual(["Investigate the failure", "yes"])
  expect(cleanRecords([records[1]!], true).excluded).toEqual({ acknowledgement: 1 })
})
