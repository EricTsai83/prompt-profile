import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/index.ts"

it("renders context coverage in both languages without storing paths or requiring analysis", async () => {
  const base = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const profile = {
    ...base,
    languages: ["en", "zh-TW"] as const,
    context: { identity: "private-hash", selected: 7, excluded: 4, missing: 2 },
  }
  const html = renderHtml(profile)
  expect(html).toContain("7 records selected; 4 from other projects and 2 without project metadata")
  expect(html).toContain("選取 7 筆提示")
  expect(html).not.toContain("private-hash")
  expect(renderHtml(base)).not.toContain("Project retrospective:")
})

it("keeps coverage available under project exclusions without disclosing project names", async () => {
  const base = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const context = { identity: "test", selected: 1, excluded: 10, missing: 3 }
  const html = renderHtml(
    { ...base, context },
    { look: "classic", cardHide: [], exclude: ["projects"] },
  )
  expect(html).toContain("1 records selected; 10 from other projects")
  expect(html).not.toContain("drawstuff")
})

it("migrates released version 14 without inventing selection provenance", async () => {
  const json = JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))
  const legacy = await Effect.runPromise(decodeProfile({ ...json, schemaVersion: 14 }))
  expect(legacy.schemaVersion).toBe(20)
  expect(legacy.context).toBeUndefined()
})
