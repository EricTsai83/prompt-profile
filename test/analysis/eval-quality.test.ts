import { expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { scoreProfile } from "../../scripts/eval-quality.ts"

const rubric = {
  requiredConcepts: [{ name: "testing", patterns: ["test[- ]first", "testing"] }],
  forbiddenPatterns: ["you have depression"],
  minTraits: 1,
  minEvidenceRetention: 0.8,
  maxEmptyDimensions: 2,
}

it.effect("gates missing concepts, unsupported inferences and low evidence quality", () =>
  Effect.gen(function* () {
    const sample = yield* decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    )
    const profile = {
      ...sample,
      headline: "You have depression",
      traits: [],
      dimensions: sample.dimensions.map((d) => ({ ...d, summary: "unrelated", evidence: [] })),
      coverage: { ...sample.coverage, evidenceKept: 1, evidenceDropped: 9 },
    }
    const score = scoreProfile(profile, rubric)
    expect(score.passed).toBe(false)
    expect(score.failures).toEqual(
      expect.arrayContaining([
        "Missing concept: testing",
        "Forbidden inference: you have depression",
        "Too few traits",
        "Evidence retention below threshold",
        "Too many dimensions without evidence",
      ]),
    )
  }),
)

it.effect("accepts supported profiles and does not count quoted text as an inferred concept", () =>
  Effect.gen(function* () {
    const sample = yield* decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    )
    const profile = {
      ...sample,
      headline: "You prefer test-first development",
      dimensions: sample.dimensions.map((d) => ({
        ...d,
        evidence: [{ promptId: "p", quote: "testing" }],
      })),
      coverage: { ...sample.coverage, evidenceKept: 10, evidenceDropped: 0 },
    }
    expect(scoreProfile(profile, rubric).passed).toBe(true)
    const onlyInQuotes = { ...profile, headline: "A developer" }
    const missing = scoreProfile(onlyInQuotes, {
      ...rubric,
      requiredConcepts: [{ name: "quote-only", patterns: ["^testing$"] }],
    })
    expect(missing.failures).toContain("Missing concept: quote-only")
  }),
)

it.effect("counts universal claims in generated text, not in quotes", () =>
  Effect.gen(function* () {
    const sample = yield* decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    )
    const profile = {
      ...sample,
      headline: "You always plan first and never skip tests",
      traits: sample.traits.map((t, i) =>
        i === 0
          ? {
              ...t,
              description: "Every change starts with a plan.",
              evidence: [{ promptId: "p", quote: "always do this every time" }],
            }
          : t,
      ),
    }
    const loose = scoreProfile(profile, { ...rubric, requiredConcepts: [] })
    expect(loose.overgeneralisations).toBe(3)
    expect(loose.passed).toBe(true)
    const strict = scoreProfile(profile, {
      ...rubric,
      requiredConcepts: [],
      maxOvergeneralisations: 2,
    })
    expect(strict.passed).toBe(false)
    expect(strict.failures).toContain("Too many universal claims (3 > 2)")
  }),
)
