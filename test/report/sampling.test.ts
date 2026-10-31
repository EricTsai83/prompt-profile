import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/index.ts"

it("labels sampled analysis chunks without presenting them as distinct weeks", async () => {
  const base = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const profile = {
    ...base,
    languages: ["en", "zh-TW"] as const,
    traits: base.traits.map((t) => ({ ...t, support: { sessions: 1, weeks: 1 } })),
    coverage: { ...base.coverage, sampled: true, chunksAnalyzed: 25, chunksTotal: 116 },
  }
  const html = renderHtml(profile)
  expect(html.includes("25 of 116 analysis chunks sampled")).toBe(true)
  expect(html).toContain("抽樣分析 25 / 116 個區塊")
  expect(html).not.toContain("25 of 116 weeks")
  expect(html).not.toContain("25 / 116 週")
  expect(html.includes("A week can span several chunks")).toBe(true)
  expect(html.includes("同一週可能拆成多個區塊")).toBe(true)
  expect(html.includes("in 1 analysis chunk")).toBe(true)
  expect(html.includes("1 個分析區塊")).toBe(true)
})
