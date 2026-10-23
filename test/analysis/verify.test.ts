import { describe, expect, it } from "@effect/vitest"
import {
  quoteMatches,
  verifyDimensions,
  verifyObservations,
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
    expect(result.observations).toHaveLength(1)
    expect(result.observations[0]!.evidence).toHaveLength(1)
    expect(counts).toEqual({ kept: 1, dropped: 2 })
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
    expect(traits.map((t) => [t.name, t.confidence])).toEqual([
      ["a", "high"],
      ["b", "medium"],
    ])
    expect(counts).toEqual({ kept: 3, dropped: 2 })
  })

  it("keeps dimension summaries even without evidence", () => {
    const dims = verifyDimensions(
      [{ key: "growth", title: "t", summary: "s", evidence: [{ promptId: "p1", quote: "nope" }] }],
      texts,
      { kept: 0, dropped: 0 },
    )
    expect(dims).toEqual([{ key: "growth", title: "t", summary: "s", evidence: [] }])
  })
})
