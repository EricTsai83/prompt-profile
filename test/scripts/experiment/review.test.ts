import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { expect, it } from "vitest"
import { decodeProfile } from "../../../src/domain/Profile.ts"
import { buildReviewPacket, type ReviewInput } from "../../../scripts/experiment/review.ts"

const profile = () =>
  Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
const manifest = (hash = "same", full = true): ReviewInput => ({
  experimentId: "fictional",
  cases: [
    {
      id: "person/base/r1",
      persona: "person",
      dir: "cases/person/base/r1",
      status: "ok",
      effectiveOptions: { full: true },
      input: { preparedSha256: "same", selectedPromptIds: ["p1"] },
    },
    {
      id: "person/candidate/r1",
      persona: "person",
      dir: "cases/person/candidate/r1",
      status: "ok",
      effectiveOptions: { full },
      input: { preparedSha256: hash, selectedPromptIds: ["p1"] },
    },
  ],
})

it("keeps mechanical success separate from semantic review and supplies concrete evidence", async () => {
  const base = await profile()
  const p = {
    ...base,
    traits: [],
    dimensions: [],
    portrait: null,
    collaboration: null,
    steering: null,
    translations: {},
    episodes: [],
    improvements: [
      {
        ...base.improvements[0]!,
        title: "A fictional suggestion",
        pattern: "You repeat a checklist.",
        impact: "The agent guessed your intent.",
        suggestion: "Use a task reference.",
        evidence: [{ promptId: "p1", quote: "Check the bounds." }],
      },
    ],
  }
  const packet = buildReviewPacket(
    manifest(),
    new Map([
      ["person/base/r1", { ok: true, profile: p }],
      ["person/candidate/r1", { ok: true, profile: p }],
    ]),
    new Map([["p1", "Check the bounds. Explain uncertainty."]]),
  )
  expect(packet.mechanical.problems).toEqual([])
  expect(packet.semanticStatus).toBe("needs-review")
  const item = packet.items.find((i) => i.field === "improvements[0]")!
  expect(item.claim).toContain("The agent guessed your intent.")
  expect(item.evidence[0]).toMatchObject({
    promptId: "p1",
    quote: "Check the bounds.",
    sourceText: "Check the bounds. Explain uncertainty.",
    valid: true,
    selected: true,
  })
  expect(item.decision).toBe("unreviewed")
  expect(item.missingContext).toContain("image-contents")
  expect(
    buildReviewPacket(manifest(), new Map([["person/base/r1", { ok: true, profile: p }]]), null)
      .items[0]!.id,
  ).toBe(packet.items[0]!.id)
})

it("blocks causal model comparisons when inputs differ and detects quote failures", async () => {
  const base = await profile()
  const packet = buildReviewPacket(
    manifest("different"),
    new Map([["person/base/r1", { ok: true, profile: base }]]),
    new Map(),
  )
  expect(packet.mechanical.problems.some((p) => p.code === "input-mismatch")).toBe(true)
  expect(packet.mechanical.problems.some((p) => p.code === "quote-mismatch")).toBe(true)
  expect(packet.mechanical.problems.some((p) => p.code === "profile-unavailable")).toBe(true)
  expect(packet.modelComparisonReady).toBe(false)
})

it("does not claim source verification when no frozen source is available", async () => {
  const base = await profile()
  const packet = buildReviewPacket(
    manifest("same", false),
    new Map([["person/base/r1", { ok: true, profile: base }]]),
    null,
  )
  expect(packet.modelComparisonReady).toBe(false)
  expect(
    packet.items.flatMap((i) => i.evidence).every((e) => e.valid === null && e.sourceText === null),
  ).toBe(true)
  expect(packet.mechanical.sourceVerification).toBe("unavailable")
})
