import { describe, expect, it } from "@effect/vitest"
import {
  abilityCap,
  projectConversations,
  verifyAbilities,
  type AbilitySources,
} from "../../src/analysis/abilities.ts"
import { keepRecurringTraits } from "../../src/analysis/verify.ts"
import { ABILITY_KEYS, MIN_PROJECT_CONVERSATIONS } from "../../src/domain/Profile.ts"

// Hand-written prompts: id → session, analysed period (chunk), project and text.
const PROMPTS = [
  [
    "p1",
    "s1",
    "w1",
    "invoices",
    "Here is the stack trace and the failing test; fix only parser.ts.",
  ],
  ["p2", "s2", "w1", "invoices", "Run the tests again and show me they pass before committing."],
  ["p3", "s3", "w2", "canvas", "The expected output is a sorted list; the log is attached below."],
  ["p4", "s3", "w2", "canvas", "Error: cannot read property x. Expected the menu to close."],
  ["p5", "s4", "w2", "canvas", "Do not push to main; open a draft pull request instead."],
] as const

const sources = (projects: ReadonlyMap<string, number> = new Map()): AbilitySources => ({
  texts: new Map(PROMPTS.map(([id, , , , text]) => [id, text])),
  origins: new Map(PROMPTS.map(([id, session, week]) => [id, { session, week }])),
  projectOf: new Map(PROMPTS.map(([id, , , project]) => [id, project])),
  projects,
})

const quote = (id: string, text: string) => ({ promptId: id, quote: text })
const ability = (
  key: string,
  score: number | null,
  evidence: ReadonlyArray<{ promptId: string; quote: string }>,
  byProject: ReadonlyArray<{
    project: string
    score: number | null
    evidence: ReadonlyArray<{ promptId: string; quote: string }>
  }> = [],
) => ({ key, score, evidence, byProject }) as never

const counts = () => ({ kept: 0, dropped: 0 })

describe("abilityCap", () => {
  it("allows above 60 only with two conversations, above 85 only with three across two periods", () => {
    expect(abilityCap({ sessions: 1, weeks: 1 })).toBe(60)
    expect(abilityCap({ sessions: 2, weeks: 1 })).toBe(85)
    expect(abilityCap({ sessions: 3, weeks: 1 })).toBe(85)
    expect(abilityCap({ sessions: 3, weeks: 2 })).toBe(100)
  })
})

describe("verifyAbilities", () => {
  it("returns the six abilities in order, unassessed (null, never 0) when not scored", () => {
    const result = verifyAbilities([], sources(), counts())
    expect(result.map((a) => a.key)).toEqual([...ABILITY_KEYS])
    expect(result.every((a) => a.score === null && a.evidence.length === 0)).toBe(true)
  })

  it("lowers a score above its evidence cap to the cap", () => {
    const result = verifyAbilities(
      [
        ability("context", 90, [quote("p1", "Here is the stack trace")]),
        ability("verification", 95, [
          quote("p1", "the failing test"),
          quote("p2", "show me they pass"),
        ]),
        ability("steering", 100, [
          quote("p1", "fix only parser.ts"),
          quote("p2", "Run the tests again"),
          quote("p3", "The expected output is a sorted list"),
        ]),
      ],
      sources(),
      counts(),
    )
    const score = (key: string) => result.find((a) => a.key === key)!
    expect(score("context").score).toBe(60)
    expect(score("verification").score).toBe(85)
    expect(score("steering")).toMatchObject({ score: 100, support: { sessions: 3, weeks: 2 } })
  })

  it("keeps a score within its cap, rounded to a multiple of 5 within 0–100", () => {
    const result = verifyAbilities(
      [
        ability("context", 43, [quote("p1", "Here is the stack trace")]),
        ability("planning", -10, [quote("p2", "Run the tests again")]),
      ],
      sources(),
      counts(),
    )
    expect(result[0]!.score).toBe(45)
    expect(result[1]!.score).toBe(0)
  })

  it("drops unverified quotes, counts them, and leaves an ability with none unassessed", () => {
    const c = counts()
    const result = verifyAbilities(
      [
        ability("context", 80, [
          quote("p1", "Here is the stack trace"),
          quote("p2", "this was never written"),
          quote("missing", "anything"),
        ]),
        ability("recovery", 70, [quote("p3", "revert everything")]),
      ],
      sources(),
      c,
    )
    const context = result.find((a) => a.key === "context")!
    // one verified conversation left: capped at 60
    expect(context).toMatchObject({ score: 60, evidence: [quote("p1", "Here is the stack trace")] })
    expect(result.find((a) => a.key === "recovery")).toMatchObject({ score: null, evidence: [] })
    expect(c).toEqual({ kept: 1, dropped: 3 })
  })

  it("counts repeated quotes of one conversation once", () => {
    const result = verifyAbilities(
      [
        ability("context", 80, [
          quote("p3", "The expected output is a sorted list"),
          quote("p4", "Expected the menu to close"),
        ]),
      ],
      sources(),
      counts(),
    )
    expect(result[0]).toMatchObject({ score: 60, support: { sessions: 1, weeks: 1 } })
  })

  it("scores a project from that project's quotes only, for projects with enough conversations", () => {
    const projects = new Map([
      ["canvas", MIN_PROJECT_CONVERSATIONS + 5],
      ["invoices", MIN_PROJECT_CONVERSATIONS],
    ])
    const result = verifyAbilities(
      [
        ability(
          "context",
          75,
          [quote("p1", "Here is the stack trace"), quote("p3", "the log is attached below")],
          [
            {
              project: "canvas",
              score: 80,
              // p1 belongs to invoices: it cannot support a canvas score
              evidence: [
                quote("p1", "Here is the stack trace"),
                quote("p3", "the log is attached below"),
                quote("p4", "Expected the menu to close"),
              ],
            },
            { project: "invoices", score: 50, evidence: [quote("p3", "the log is attached")] },
            { project: "tiny", score: 50, evidence: [quote("p5", "Do not push to main")] },
          ],
        ),
      ],
      sources(projects),
      counts(),
    )
    const context = result[0]!
    expect(context.score).toBe(75)
    expect(context.byProject).toEqual([
      {
        project: "canvas",
        analysedSessions: MIN_PROJECT_CONVERSATIONS + 5,
        // both remaining quotes come from one conversation
        score: 60,
        evidence: [
          quote("p3", "the log is attached below"),
          quote("p4", "Expected the menu to close"),
        ],
        support: { sessions: 1, weeks: 1 },
      },
      {
        project: "invoices",
        analysedSessions: MIN_PROJECT_CONVERSATIONS,
        score: null,
        evidence: [],
        support: { sessions: 0, weeks: 0 },
      },
    ])
  })

  it("keeps the first entry of a repeated ability", () => {
    const result = verifyAbilities(
      [
        ability("context", 40, [quote("p1", "Here is the stack trace")]),
        ability("context", 55, [quote("p2", "Run the tests again")]),
      ],
      sources(),
      counts(),
    )
    expect(result.filter((a) => a.key === "context")).toHaveLength(1)
    expect(result[0]!.score).toBe(40)
  })
})

describe("projectConversations", () => {
  it("counts each project's analysed conversations and keeps those with enough", () => {
    const prompts = Array.from({ length: MIN_PROJECT_CONVERSATIONS + 1 }, (_, i) => [
      { source: "codex", sessionId: `a${i}`, project: "big" },
      { source: "codex", sessionId: `a${i}`, project: "big" },
      { source: "codex", sessionId: `b${i % 3}`, project: "small" },
      { source: "codex", sessionId: `c${i}`, project: null },
    ]).flat()
    expect([...projectConversations(prompts)]).toEqual([["big", MIN_PROJECT_CONVERSATIONS + 1]])
  })
})

describe("keepRecurringTraits", () => {
  const trait = (name: string, sessions: number | null) => ({
    name,
    support: sessions === null ? null : { sessions, weeks: 1 },
  })

  it("drops traits seen in one conversation only", () => {
    const kept = keepRecurringTraits([
      trait("a", 3),
      trait("once", 1),
      trait("b", 2),
      trait("c", 4),
      trait("also once", 1),
    ])
    expect(kept.map((t) => t.name)).toEqual(["a", "b", "c"])
  })

  it("keeps the earliest single-conversation traits needed to leave three", () => {
    const kept = keepRecurringTraits([
      trait("once", 1),
      trait("a", 3),
      trait("again once", 1),
      trait("third once", 1),
    ])
    expect(kept.map((t) => t.name)).toEqual(["once", "a", "again once"])
  })

  it("keeps traits whose spread is unknown", () => {
    const kept = keepRecurringTraits([
      trait("a", null),
      trait("b", 1),
      trait("c", 2),
      trait("d", 2),
    ])
    expect(kept.map((t) => t.name)).toEqual(["a", "c", "d"])
  })
})
