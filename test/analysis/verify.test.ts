import { describe, expect, it } from "@effect/vitest"
import {
  quoteMatches,
  verifyDimensions,
  verifyObservations,
  verifyImprovements,
  verifyTraits,
} from "../../src/analysis/verify.ts"

const texts = new Map([
  ["p1", "先不要寫 code，幫我把計畫拆成小步驟。"],
  ["p2", "fix  the <Button>\n component   please"],
  ["p3", "no, that's wrong. use a Map instead of an object"],
  ["p4", "render &lt;Button&gt; as text"],
  ["p5", "replace <Button> with &lt;Button&gt;"],
])

describe("quoteMatches", () => {
  it.each([
    ["exact", "幫我把計畫拆成小步驟", "p1", true],
    ["full-width vs half-width punctuation", "先不要寫 code,幫我", "p1", true],
    ["whitespace differences", "fix the <Button> component", "p2", true],
    ["escaped brackets", "fix the &lt;Button&gt; component", "p2", true],
    ["literal entities in the prompt", "render &lt;Button&gt;", "p4", true],
    ["literal entities next to brackets", "replace &lt;Button&gt; with &lt;Button&gt;", "p5", true],
    ["brackets unescaped by the LLM", "fix the <Button> component", "p2", true],
    ["entity unescaped by the LLM", "render <Button>", "p4", false],
    ["elided middle", "no, that's wrong… instead of an object", "p3", true],
    ["truncated with ellipsis", "use a Map instead…", "p3", true],
    ["case-insensitive", "No, That's Wrong", "p3", true],
    ["paraphrase", "please split the plan into steps", "p1", false],
    ["out of order segments", "instead of an object… no, that's wrong", "p3", false],
    ["empty", "…", "p3", false],
  ] as const)("%s", (_n, quote, id, expected) => {
    expect(quoteMatches(quote, texts.get(id)!)).toBe(expected)
  })
})

describe("verify", () => {
  it("stores quotes copied from the escaped chunk text unescaped", () => {
    const counts = { kept: 0, dropped: 0 }
    const traits = verifyTraits(
      [
        {
          name: "t",
          description: "d",
          confidence: "high",
          evidence: [{ promptId: "p2", quote: "fix  the &lt;Button&gt;" }],
        },
      ],
      texts,
      counts,
    )
    expect(traits[0]!.evidence).toEqual([{ promptId: "p2", quote: "fix  the <Button>" }])
  })

  it("keeps entities that are literally in the prompt", () => {
    const counts = { kept: 0, dropped: 0 }
    const evidence = verifyDimensions(
      [
        {
          key: "growth",
          title: "t",
          summary: "s",
          evidence: [{ promptId: "p4", quote: "render &lt;Button&gt; as text" }],
        },
      ],
      texts,
      counts,
    )[0]!.evidence
    expect(evidence).toEqual([{ promptId: "p4", quote: "render &lt;Button&gt; as text" }])
  })

  it("drops fake quotes, unknown ids and empty observations", () => {
    const counts = { kept: 0, dropped: 0 }
    const result = verifyObservations(
      {
        chunkId: "c",
        observations: [
          {
            dimension: "work_style",
            claim: "plans first",
            evidence: [
              { promptId: "p1", quote: "拆成小步驟" },
              { promptId: "nope", quote: "x" },
            ],
          },
          {
            dimension: "communication",
            claim: "made up",
            evidence: [{ promptId: "p3", quote: "I love tests" }],
          },
        ],
      },
      texts,
      counts,
    )
    expect(result.observations).toHaveLength(0)
    expect(counts).toEqual({ kept: 0, dropped: 3 })
  })

  it("downgrades traits with < 2 evidence and removes traits with none", () => {
    const counts = { kept: 0, dropped: 0 }
    const traits = verifyTraits(
      [
        {
          name: "a",
          description: "",
          confidence: "high",
          evidence: [
            { promptId: "p1", quote: "拆成小步驟" },
            { promptId: "p3", quote: "use a Map" },
          ],
        },
        {
          name: "b",
          description: "",
          confidence: "high",
          evidence: [
            { promptId: "p1", quote: "拆成小步驟" },
            { promptId: "p3", quote: "fake" },
          ],
        },
        {
          name: "c",
          description: "",
          confidence: "low",
          evidence: [{ promptId: "p2", quote: "fake" }],
        },
      ],
      texts,
      counts,
    )
    // Missing session metadata cannot establish independent support.
    expect(traits.map((t) => [t.name, t.confidence])).toEqual([["a", "low"]])
    expect(counts).toEqual({ kept: 2, dropped: 3 })
  })

  it("clears dimension assertions without complete evidence", () => {
    const dims = verifyDimensions(
      [{ key: "growth", title: "t", summary: "s", evidence: [{ promptId: "p1", quote: "nope" }] }],
      texts,
      { kept: 0, dropped: 0 },
    )
    expect(dims).toEqual([{ key: "growth", title: "growth", summary: "", evidence: [] }])
  })
})

describe("independent evidence", () => {
  it("counts normalized duplicate quotes once", () => {
    const counts = { kept: 0, dropped: 0 }
    const result = verifyTraits(
      [
        {
          name: "t",
          description: "d",
          confidence: "high",
          evidence: [
            { promptId: "p2", quote: "fix the <Button>" },
            { promptId: "p2", quote: "FIX  THE &lt;Button&gt;" },
          ],
        },
      ],
      texts,
      counts,
    )
    expect(result[0]!.evidence).toHaveLength(1)
    expect(counts).toEqual({ kept: 1, dropped: 1 })
  })

  it("different excerpts of one prompt do not count as independent support", () => {
    const result = verifyTraits(
      [
        {
          name: "t",
          description: "d",
          confidence: "high",
          evidence: [
            { promptId: "p3", quote: "no, that's wrong" },
            { promptId: "p3", quote: "use a Map" },
          ],
        },
      ],
      texts,
      { kept: 0, dropped: 0 },
    )
    expect(result[0]!.confidence).toBe("low")
  })

  it("caps confidence when independent prompts belong to one session", () => {
    const result = verifyTraits(
      [
        {
          name: "t",
          description: "d",
          confidence: "high",
          evidence: [
            { promptId: "p1", quote: "拆成小步驟" },
            { promptId: "p3", quote: "use a Map" },
          ],
        },
      ],
      texts,
      { kept: 0, dropped: 0 },
      new Map([
        ["p1", { session: "session", week: "w1" }],
        ["p3", { session: "session", week: "w2" }],
      ]),
    )
    expect(result[0]!.confidence).toBe("low")
    expect(result[0]!.support).toEqual({ sessions: 1, weeks: 2 })
  })

  const threePrompts = (confidence: "high" | "medium" | "low") => [
    {
      name: "t",
      description: "d",
      confidence,
      evidence: [
        { promptId: "p1", quote: "拆成小步驟" },
        { promptId: "p2", quote: "fix  the <Button>" },
        { promptId: "p3", quote: "use a Map" },
      ],
    },
  ]

  it("high confidence needs three sessions across at least two weeks", () => {
    const run = (weeks: [string, string, string], confidence: "high" | "low" = "high") =>
      verifyTraits(
        threePrompts(confidence),
        texts,
        { kept: 0, dropped: 0 },
        new Map([
          ["p1", { session: "s1", week: weeks[0] }],
          ["p2", { session: "s2", week: weeks[1] }],
          ["p3", { session: "s3", week: weeks[2] }],
        ]),
      )[0]!
    expect(run(["w1", "w1", "w1"]).confidence).toBe("medium")
    expect(run(["w1", "w1", "w2"])).toMatchObject({
      confidence: "high",
      support: { sessions: 3, weeks: 2 },
    })
    // support only caps; it never raises the model's confidence
    expect(run(["w1", "w2", "w3"], "low").confidence).toBe("low")
  })
})

describe("improvements", () => {
  const base = { title: "t", pattern: "p", impact: "i", suggestion: "s" }

  it("keeps verified evidence and a rewrite of one of its prompts; drops the rest", () => {
    const counts = { kept: 0, dropped: 0 }
    const result = verifyImprovements(
      [
        {
          ...base,
          title: "kept",
          evidence: [
            { promptId: "p3", quote: "no, that's wrong" },
            { promptId: "p1", quote: "invented" },
          ],
          rewrite: { promptId: "p3", after: "Use a Map and keep insertion order." },
        },
        {
          ...base,
          title: "rewrite of an unverified prompt",
          evidence: [{ promptId: "p2", quote: "fix the <Button>" }],
          rewrite: { promptId: "p1", after: "x" },
        },
        {
          ...base,
          title: "no verified evidence",
          evidence: [{ promptId: "p1", quote: "invented" }],
          rewrite: { promptId: "p1", after: "x" },
        },
      ],
      texts,
      counts,
    )
    expect(result.map((r) => [r.title, r.evidence.length, r.rewrite?.promptId ?? null])).toEqual([
      ["rewrite of an unverified prompt", 1, null],
    ])
    expect(counts).toEqual({ kept: 1, dropped: 3 })
  })
})
