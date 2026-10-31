import { readFileSync } from "node:fs"
import { DateTime, Effect } from "effect"
import { expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"
import { translationInput } from "../../src/analysis/translate.ts"

it("separates requested practices from ability and keeps structured moves tied to sources", async () => {
  const base = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const p = {
    ...base,
    languages: ["en"] as const,
    translations: {},
    evidenceOrigins: [
      {
        promptId: "a",
        session: "PRIVATE_SESSION_ID",
        time: DateTime.makeUnsafe("2026-10-01T00:00:00Z"),
        turn: 2,
        of: 8,
      },
    ],
    collaboration: {
      moves: [
        {
          name: "Compare then check",
          description: "Requests alternatives before checks.",
          episodeIds: ["E1", "E3"],
          benefit: null,
          cost: null,
          support: { sessions: 2, weeks: 1 },
        },
      ],
      signals: [
        {
          kind: "verification" as const,
          basis: "user_request" as const,
          observation: "Requests boundary checks",
          context: "patch reviews",
          evidence: [{ promptId: "a", quote: "PRIVATE_SIGNAL_QUOTE" }],
          support: { sessions: 1, weeks: 1 },
        },
      ],
      rejected: { moves: 0, signals: 0, effects: 0 },
    },
  }
  const out = renderHtml(p)
  expect(out).toContain("Compare then check")
  expect(out).toContain("Observed understanding signals")
  expect(out).toContain("Requested practice")
  expect(out).toContain("Not observed in this evidence")
  expect(out).toContain("No supported benefit or cost claim here")
  expect(out).toContain("PRIVATE_SIGNAL_QUOTE")
  expect(out).toContain("prompt 2/8")
  expect(out).not.toContain("PRIVATE_SESSION_ID")
  expect(renderHtml(p, { look: "classic", cardHide: [], exclude: ["quotes"] })).not.toContain(
    "PRIVATE_SIGNAL_QUOTE",
  )
  expect(JSON.stringify(translationInput(p))).not.toContain("PRIVATE_SIGNAL_QUOTE")
  expect(translationInput(p).collaboration?.moves[0]?.name).toBe("Compare then check")
})

it("shows open-ended habits beyond three, without a fixed-axis overview", async () => {
  const base = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const moves = Array.from({ length: 5 }, (_, i) => ({
    name: `Supported habit ${i}`,
    description: `A contextual request ${i}`,
    episodeIds: base.episodes.map((e) => e.id),
    benefit: null,
    cost: null,
    support: { sessions: 2, weeks: 1 },
  }))
  const output = renderHtml({
    ...base,
    collaboration: { moves, signals: [], rejected: { moves: 0, signals: 0, effects: 0 } },
  })
  const identity = output.split('<section id="overview"')[1]!.split('<section id="detail"')[0]!
  expect(identity.includes("Supported habit 4")).toBe(true)
  expect(identity.includes('class="preference-map')).toBe(false)
  expect(identity.includes("How you work with AI")).toBe(true)
  expect(identity.includes("你習慣怎麼和 AI 一起做事")).toBe(true)
})

it("folds understanding signals seen in one conversation behind their own disclosure", async () => {
  const base = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const signal = (observation: string, sessions: number) => ({
    kind: "verification" as const,
    basis: "user_request" as const,
    observation,
    context: "patch reviews",
    evidence: [],
    support: { sessions, weeks: sessions },
  })
  const out = renderHtml({
    ...base,
    languages: ["en", "zh-TW"] as const,
    collaboration: {
      moves: [],
      signals: [signal("RECURRING_SIGNAL", 2), signal("ONE_OFF_SIGNAL", 1)],
      rejected: { moves: 0, signals: 0, effects: 0 },
    },
    translations: {
      "zh-TW": {
        ...base.translations["zh-TW"]!,
        collaboration: {
          moves: [],
          signals: [
            { observation: "RECURRING_SIGNAL", context: "c" },
            { observation: "ONE_OFF_SIGNAL", context: "c" },
          ],
        },
      },
    },
  })
  const section = /<section class="understanding">.*?<\/section>/s.exec(out)![0]
  const folded = /<details class="signal-once">.*?<\/details>/s.exec(section)?.[0] ?? ""
  expect(folded).toContain("ONE_OFF_SIGNAL")
  expect(folded).toContain("Seen in one conversation only (1)")
  expect(folded).toContain("只在一段對話中看到（1）")
  expect(folded).not.toContain("RECURRING_SIGNAL")
  expect(section).toContain("RECURRING_SIGNAL")
})

it("shows each example conversation under one habit only on the identity view", async () => {
  const base = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const move = (name: string, episodeIds: string[]) => ({
    name,
    description: `${name} description`,
    episodeIds,
    benefit: null,
    cost: null,
    support: { sessions: 2, weeks: 2 },
  })
  const out = renderHtml({
    ...base,
    languages: ["en"] as const,
    translations: {},
    collaboration: {
      moves: [move("First habit", ["E1", "E2"]), move("Second habit", ["E1", "E3"])],
      signals: [],
      rejected: { moves: 0, signals: 0, effects: 0 },
    },
  })
  const section = /<section class="identity-moves structured-moves">.*?<\/section>/s.exec(out)![0]
  const task = base.episodes[0]!.task
  expect(section.split(task).length - 1).toBe(1)
  // the second habit still gets the example nobody showed yet
  expect(section).toContain(base.episodes[2]!.task)
})
