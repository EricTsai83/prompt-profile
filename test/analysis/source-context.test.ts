import { describe, expect, it } from "vitest"
import { sourceContext, SOURCE_CONTEXT_LIMIT } from "../../src/analysis/source-context.ts"
import { makePrompts } from "./fixtures.ts"

const prompts = () =>
  makePrompts({ from: "2026-08-01T01:00:00Z", days: 3, perDay: 2, textSize: 500 })

describe("source context for draft review", () => {
  it("retains the opening choice even when a selected citation quotes only a later choice", () => {
    const p = {
      ...prompts()[0]!,
      text: "Explore two navigation models. I will choose every implementation detail.",
    }
    const out = sourceContext([p], new Set([p.id]))
    expect(out.excerpts[0]).toEqual({ promptId: p.id, text: p.text, truncated: false })
    expect(out.coverage.included).toBe(1)
  })

  it("caps input, marks truncation, and prefers different sessions over a long conversation", () => {
    const ps = prompts().map((p, i) => ({
      ...p,
      id: `p${i}`,
      sessionId: i < 4 ? "long" : `other${i}`,
    }))
    const out = sourceContext(ps, new Set(ps.map((p) => p.id)), 600)
    expect(JSON.stringify(out.excerpts).length).toBeLessThanOrEqual(600)
    expect(out.excerpts.map((p) => p.promptId)).toEqual(["p0", "p4"])
    expect(out.excerpts.every((p) => p.truncated && Array.from(p.text).length <= 200)).toBe(true)
    expect(out.coverage.eligible).toBe(6)
    expect(out.coverage.included).toBe(2)
  })

  it("does not introduce uncited prompts or exceed the default bound", () => {
    const ps = prompts()
    expect(sourceContext(ps, new Set()).excerpts).toEqual([])
    expect(
      JSON.stringify(sourceContext(ps, new Set(ps.map((p) => p.id))).excerpts).length,
    ).toBeLessThanOrEqual(SOURCE_CONTEXT_LIMIT)
  })
})
