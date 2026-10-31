import { expect, it } from "vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { makeExecutionAccounting } from "../../src/llm/accounting.ts"
import { generationOf } from "../../src/domain/Execution.ts"
import { renderHtml } from "../../src/report/html.ts"

it("explains unavailable legacy and bilingual generation independently of historical usage, and obeys usage exclusions", async () => {
  const p = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  expect(renderHtml(p)).toContain("Generation metadata is unavailable")
  const a = makeExecutionAccounting("00000000-0000-0000-0000-000000000000", 100)
  a.finish("partial")
  const withGeneration = { ...p, generation: generationOf(a.record(200)) }
  const html = renderHtml(withGeneration)
  expect(html).toContain("Report generation")
  expect(html).toContain("報告產生用量")
  expect(html).toContain("not subscription bills")
  expect(html).toContain("未完整完成")
  expect(html).toContain("known zero")
  expect(
    renderHtml(withGeneration, { look: "classic", cardHide: [], exclude: ["usage"] }),
  ).not.toContain("Report generation")
})

it("preserves execution identifiers through the final privacy audit", async () => {
  const { checkOutput } = await import("../../src/pipeline/audit.ts")
  const { parseExecution } = await import("../../src/domain/Execution.ts")
  const p = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const r = parseExecution(
    JSON.parse(readFileSync("test/fixtures/execution.partial.json", "utf8")),
  )!
  const result = checkOutput(
    { ...p, generation: generationOf(r) },
    { mode: "mask", allow: [], username: null },
  )
  expect(result.profile.generation!.executionId).toBe(r.id)
})
