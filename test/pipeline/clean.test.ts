import { describe, expect, it } from "@effect/vitest"
import {
  CLEAN_RULES,
  cleanRecords,
  collapseCode,
  looksLikeCode,
  truncateMiddle,
} from "../../src/pipeline/clean.ts"
import { rec } from "./records.ts"

describe("clean rules", () => {
  it.each([
    ["too-short", "ok", undefined],
    ["too-short", "  y ", undefined],
    ["acknowledgement", "continue", undefined],
    ["acknowledgement", "Yes!", undefined],
    ["acknowledgement", "繼續吧", undefined],
    ["acknowledgement", "好的。", undefined],
    ["consecutive-duplicate", "please run the tests", "please run the tests"],
  ] as const)("%s: %j", (name, text, prev) => {
    expect(CLEAN_RULES.find((r) => r.test(text, prev))?.name).toBe(name)
  })

  it.each([
    ["a real prompt", "fix the login bug", undefined],
    ["acknowledgement inside a sentence", "yes, but also rename the file", undefined],
    ["same text, different previous", "please run the tests", "something else"],
  ] as const)("keeps %s", (_n, text, prev) => {
    expect(CLEAN_RULES.find((r) => r.test(text, prev))).toBeUndefined()
  })

  it("counts excluded prompts per rule and keeps image-only short prompts", () => {
    const result = cleanRecords([
      rec("ok", "2026-09-01T00:00:00Z"),
      rec("fix it please", "2026-09-01T00:01:00Z"),
      rec("fix it please", "2026-09-01T00:02:00Z"),
      rec("fix it please", "2026-09-01T00:03:00Z", { sessionId: "other" }),
      rec("?", "2026-09-01T00:04:00Z", { hasImage: true }),
    ])
    expect(result.prompts.map((p) => p.text)).toEqual(["fix it please", "fix it please", "?"])
    expect(result.excluded).toEqual({ "too-short": 1, "consecutive-duplicate": 1 })
  })
})

describe("code collapsing", () => {
  it("collapses code fences", () => {
    const text = "why does this fail?\n```ts\nconst a = 1\nconst b = 2\n```\nthanks"
    expect(collapseCode(text)).toEqual({
      text: "why does this fail?\n[pasted code: 2 lines]\nthanks",
      blocks: 1,
    })
  })

  it("collapses stack traces", () => {
    const text = [
      "the app crashes:",
      "TypeError: Cannot read properties of undefined (reading 'x')",
      "    at render (/app/src/view.ts:10:5)",
      "    at main (/app/src/index.ts:3:1)",
      "    at node:internal/main:1:1",
      "any idea?",
    ].join("\n")
    expect(collapseCode(text).text).toBe("the app crashes:\n[pasted code: 4 lines]\nany idea?")
  })

  it("collapses pasted JSON", () => {
    const text = 'response looks like\n{\n  "id": 1,\n  "name": "x",\n  "tags": []\n}\nparse it'
    expect(collapseCode(text).text).toBe("response looks like\n[pasted code: 5 lines]\nparse it")
  })

  it("does not collapse a multi-line Chinese paragraph", () => {
    const text =
      "我想要做三件事：\n第一，把登入頁面改成深色模式；\n第二，把 API 的錯誤訊息統一；\n第三，補上測試。"
    expect(collapseCode(text)).toEqual({ text, blocks: 0 })
  })

  it("does not collapse a single code-like line", () => {
    expect(collapseCode("rename `const x = 1;` to y").blocks).toBe(0)
    expect(looksLikeCode("    at foo (a.ts:1:2)")).toBe(true)
    expect(looksLikeCode("請幫我修好這個問題，謝謝你；")).toBe(false)
  })

  it("truncates long text in the middle", () => {
    const text = "a".repeat(3000) + "b".repeat(3000)
    const out = truncateMiddle(text)
    expect(out.truncated).toBe(true)
    expect(Array.from(out.text).length).toBeLessThanOrEqual(4000)
    expect(out.text.startsWith("aaa")).toBe(true)
    expect(out.text.endsWith("bbb")).toBe(true)
    expect(out.text).toMatch(/\[… \d+ characters omitted …\]/)
    expect(truncateMiddle("short").truncated).toBe(false)
  })
})
