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
