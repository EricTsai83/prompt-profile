import { formatDuration } from "../../src/report/format.ts"
import { expect, it } from "vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { makeExecutionAccounting } from "../../src/llm/accounting.ts"
import { generationOf } from "../../src/domain/Execution.ts"
import { renderHtml } from "../../src/report/html.ts"
import { summarizeExecution, type ExecutionAttempt } from "../../src/domain/Execution.ts"
import { ZERO_TOKENS } from "../../src/domain/Usage.ts"

it("shows unavailable cost without a fake price and labels token units individually", async () => {
  const p = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const a = makeExecutionAccounting("00000000-0000-0000-0000-000000000000", 0)
  const attempt: ExecutionAttempt = {
    id: 1,
    callId: 1,
    stage: "map",
    engine: "codex",
    model: null,
    modelSource: null,
    startedAtMs: 0,
    finishedAtMs: 100,
    outcome: "succeeded",
    tokens: { ...ZERO_TOKENS, input: 1200, output: 80 },
    unknownTokenKinds: ["cacheWrite5m", "cacheWrite1h", "cacheWriteUnknown", "reasoning"],
    cost: null,
  }
  const g = generationOf(a.record(100))
  const page = renderHtml({
    ...p,
    generation: { ...g, summary: summarizeExecution([attempt], 0, 0, 100) },
  })
  const section = page.slice(
    page.indexOf('<section class="panel" id="report-generation"'),
    page.indexOf("</section>", page.indexOf('<section class="panel" id="report-generation"')),
  )
  expect(section).toContain("Cost unavailable")
  expect(section).toContain("成本無法取得")
  expect(section).toContain("1,200")
  expect(section).toContain("Input tokens")
  expect(section).toContain("文字計量單位")
  expect(section).not.toContain("0.000000")
  expect(section).not.toContain('class="generation-cost-chart"')
  expect(section).not.toContain('data-token-kind="cacheWrite5m"')
  expect(section).toContain('data-token-kind="cacheRead"')
})

it("charts measured stage costs while keeping partial amounts and missing calls explicit", async () => {
  const p = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const a = makeExecutionAccounting("00000000-0000-0000-0000-000000000000", 0)
  const g = generationOf(a.record(100))
  const attempt: ExecutionAttempt = {
    id: 1,
    callId: 1,
    stage: "map",
    engine: "claude-code",
    model: "synthetic",
    modelSource: "reported",
    startedAtMs: 0,
    finishedAtMs: 100,
    outcome: "succeeded",
    tokens: null,
    cost: { provenance: "reported", usd: 0.02, pricingVersion: null, tier: null },
  }
  const page = renderHtml({
    ...p,
    generation: {
      ...g,
      summary: summarizeExecution(
        [attempt, { ...attempt, id: 2, callId: 2, stage: "review", cost: null }],
        0,
        0,
        100,
      ),
    },
  })
  expect(page).toContain('class="generation-cost-chart"')
  expect(page).toContain("$0.0200")
  expect(page).toContain("Cost by analysis stage")
  expect(page).toContain("Known subtotal")
  expect(page).toContain("1 of 2 calls")
})

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

it("shows localized elapsed and total call times as separate readable durations", async () => {
  const p = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const a = makeExecutionAccounting("00000000-0000-0000-0000-000000000000", 0)
  a.finish("succeeded")
  const generation = generationOf(a.record(1))
  const html = renderHtml({
    ...p,
    generation: {
      ...generation,
      summary: { ...generation.summary, wallDurationMs: 634458, callDurationMs: 1016692 },
    },
  })
  expect(html).toContain("10 min 34 s")
  expect(html).toContain("16 min 57 s")
  expect(html).toContain("10 分 34 秒")
  expect(html).toContain("16 分 57 秒")
  expect(html).toContain("Generation elapsed time")
  expect(html).toContain("Total model call time")
  expect(html).toContain("報告產生耗時")
  expect(html).toContain("模型呼叫累計時間")
  expect(html).toContain("Calls may run in parallel")
  expect(html).not.toContain("634458 / 1016692")
  expect(html).not.toContain("summed call time (ms)")
})

it.each([
  [0, "0 s", "0 秒"],
  [250, "Less than 1 s", "不到 1 秒"],
  [1000, "1 s", "1 秒"],
  [59999, "1 min", "1 分"],
  [3661000, "1 h 1 min 1 s", "1 小時 1 分 1 秒"],
  [90061000, "1 d 1 h 1 min 1 s", "1 天 1 小時 1 分 1 秒"],
] as const)(
  "formats %i ms without losing zero or subsecond distinctions",
  (milliseconds, en, zh) => {
    expect(formatDuration(milliseconds, "en")).toBe(en)
    expect(formatDuration(milliseconds, "zh-TW")).toBe(zh)
  },
)
