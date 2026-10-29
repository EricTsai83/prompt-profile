import { describe, expect, it } from "vitest"
import { verifyPortrait } from "../../src/analysis/portrait.ts"
import { axisState, roleCode } from "../../src/domain/Interaction.ts"

const texts = new Map([
  ["a", "Define the expected result first"],
  ["b", "Run the checks before finishing"],
  ["c", "Just try a few designs and show me"],
  ["d", "Explore options for the prototype"],
])
const origins = new Map([
  ["a", { session: "one", week: "w1" }],
  ["b", { session: "two", week: "w2" }],
  ["c", { session: "three", week: "w2" }],
  ["d", { session: "four", week: "w3" }],
])
const quote = (promptId: string) => ({ promptId, quote: texts.get(promptId)! })
const side = (pole: "first" | "second", context: string, ids: ReadonlyArray<string>) => ({
  pole,
  context,
  evidence: ids.map(quote),
  sessions: 0,
})
const portrait = {
  introduction: "This developer gives the agent room within clear boundaries.",
  chapters: [
    {
      title: "Setting the direction",
      body: "They define an outcome before delegating.",
      evidence: [quote("a")],
    },
  ],
  axes: [
    {
      key: "framing" as const,
      explanation: "They define outcomes for production work and explore for prototypes.",
      sides: [
        side("first", "production changes", ["a", "b"]),
        side("second", "prototypes", ["c", "d"]),
      ],
    },
  ],
}
const counts = () => ({ kept: 0, dropped: 0 })

describe("interaction portrait", () => {
  it("keeps both ways of working on an axis, each with its context and conversations", () => {
    const out = verifyPortrait(portrait, texts, origins, counts())!
    const framing = out.axes.find((a) => a.key === "framing")!
    expect(framing.sides.map((s) => [s.pole, s.context, s.sessions])).toEqual([
      ["first", "production changes", 2],
      ["second", "prototypes", 2],
    ])
    expect(axisState(framing)).toBe("both")
    // both ways are characteristic: no single role is chosen for them
    expect(roleCode(out.axes)).toBeNull()
  })

  it("keeps a way seen in one conversation without calling it characteristic", () => {
    const once = {
      ...portrait,
      axes: [{ ...portrait.axes[0]!, sides: [side("first", "reviews", ["a"])] }],
    }
    const framing = verifyPortrait(once, texts, origins, counts())!.axes[0]!
    expect(framing.sides[0]!.sessions).toBe(1)
    expect(axisState(framing)).toBe("none")
    // repeated quotes in one session are one conversation
    const sameSession = verifyPortrait(
      portrait,
      texts,
      new Map([...origins].map(([id, o]) => [id, { ...o, session: "one" }])),
      counts(),
    )!
    expect(axisState(sameSession.axes[0]!)).toBe("none")
  })

  it("rejects the portrait when a side cites fabricated evidence", () => {
    const fake = {
      ...portrait,
      axes: [
        {
          ...portrait.axes[0]!,
          sides: [{ ...side("first", "x", ["a"]), evidence: [{ promptId: "a", quote: "never" }] }],
        },
      ],
    }
    expect(verifyPortrait(fake, texts, origins, counts())).toBeNull()
  })

  it("normalizes to four axes and at most one side per pole", () => {
    const axis = {
      ...portrait.axes[0]!,
      sides: [side("first", "kept", ["a", "b"]), side("first", "dropped", ["c"])],
    }
    const out = verifyPortrait({ ...portrait, axes: [axis, axis] }, texts, origins, counts())!
    expect(out.axes.map((a) => a.key)).toEqual(["framing", "pacing", "control", "closure"])
    expect(out.axes[0]!.sides.map((s) => s.context)).toEqual(["kept"])
    expect(out.axes.slice(1).every((a) => a.sides.length === 0)).toBe(true)
  })

  it("assigns a role only when every axis has exactly one characteristic way", () => {
    const one = (pole: "first" | "second") => [{ pole, sessions: 2 }]
    expect(
      roleCode([
        { key: "framing", sides: one("first") },
        { key: "pacing", sides: one("second") },
        { key: "control", sides: one("second") },
        { key: "closure", sides: one("first") },
      ]),
    ).toBe("FBLC")
    expect(
      roleCode([
        { key: "framing", sides: one("first") },
        { key: "pacing", sides: [{ pole: "second", sessions: 1 }] },
        { key: "control", sides: one("second") },
        { key: "closure", sides: one("first") },
      ]),
    ).toBeNull()
    expect(roleCode([])).toBeNull()
  })
})
