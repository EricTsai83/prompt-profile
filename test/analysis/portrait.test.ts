import { describe, expect, it } from "vitest"
import { verifyPortrait } from "../../src/analysis/portrait.ts"
import { roleCode } from "../../src/domain/Interaction.ts"

const texts = new Map([
  ["a", "Define the expected result first"],
  ["b", "Run the checks before finishing"],
])
const origins = new Map([
  ["a", { session: "one", week: "w1", order: 0 }],
  ["b", { session: "two", week: "w2", order: 1 }],
])
const evidence = [...texts].map(([promptId, quote]) => ({ promptId, quote }))
const portrait = {
  introduction: "This developer gives the agent room within clear boundaries.",
  chapters: [
    { title: "Setting the direction", body: "They define an outcome before delegating.", evidence },
  ],
  axes: [
    {
      key: "framing" as const,
      pole: "first" as const,
      explanation: "They define the outcome.",
      evidence,
      counterEvidence: [],
    },
  ],
}

describe("interaction portrait", () => {
  it("requires multiple sessions and rejects fabricated evidence before classifying", () => {
    const out = verifyPortrait(portrait, texts, origins, { kept: 0, dropped: 0 })!
    expect(out.axes[0]?.pole).toBe("first")
    const thin = verifyPortrait(
      portrait,
      texts,
      new Map([...origins].map(([id, o]) => [id, { ...o, session: "one" }])),
      { kept: 0, dropped: 0 },
    )!
    expect(thin.axes[0]?.pole).toBe("unclear")
    const fake = verifyPortrait(portrait, new Map(), origins, { kept: 0, dropped: 0 })
    expect(fake).toBeNull()
  })
  it("marks conflicting evidence as unclear and normalizes duplicate axes", () => {
    const axis = { ...portrait.axes[0]!, counterEvidence: [evidence[1]!] }
    const out = verifyPortrait({ ...portrait, axes: [axis, axis] }, texts, origins, {
      kept: 0,
      dropped: 0,
    })!
    expect(out.axes).toHaveLength(4)
    expect(out.axes.every((a) => a.pole === "unclear")).toBe(true)
    expect(roleCode(out.axes)).toBeNull()
  })
  it("uses a stable four-axis code only when all axes are supported", () => {
    expect(
      roleCode([
        { key: "framing", pole: "first" },
        { key: "pacing", pole: "second" },
        { key: "control", pole: "second" },
        { key: "closure", pole: "first" },
      ]),
    ).toBe("FBLC")
    expect(roleCode([])).toBeNull()
  })
})

it("does not assign a role from repeated quotes in one session", () => {
  const out = verifyPortrait(portrait, texts, new Map(), { kept: 0, dropped: 0 })!
  expect(roleCode(out.axes)).toBeNull()
})
