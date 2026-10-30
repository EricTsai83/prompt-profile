import { readFileSync } from "node:fs"
import { DateTime, Effect } from "effect"
import { expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"

it("shows supported window differences with context and protects previous project names", async () => {
  const base = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const since = DateTime.makeUnsafe("2026-10-01T00:00:00Z"),
    until = DateTime.makeUnsafe("2026-10-08T00:00:00Z")
  const p = {
    ...base,
    historyComparison: {
      previousProjects: ["PrivateOldProject"],
      previousGeneratedAt: since,
      previousWindow: { since, until },
      currentWindow: { since: until, until: DateTime.makeUnsafe("2026-10-15T00:00:00Z") },
      toolComparable: false,
      changes: [
        {
          key: "framing" as const,
          before: "first" as const,
          after: "second" as const,
          previousContexts: ["PrivateOldProject"],
          contexts: ["prototype work"],
          previousSources: [],
          previousEvidence: [{ promptId: "old", quote: "PrivateOldProject needs a fixed target" }],
          evidence: [{ promptId: "new", quote: "Explore the prototype options" }],
        },
      ],
    },
  }
  const out = renderHtml(p)
  expect(out).toContain("Differences between comparable windows")
  expect(out).toContain("PrivateOldProject")
  expect(out).toContain("Explore the prototype options")
  const hidden = renderHtml(p, { look: "classic", cardHide: [], exclude: ["projects", "dates"] })
  expect(hidden).not.toContain("PrivateOldProject")
  expect(hidden).not.toContain("Oct 1,")
  expect(renderHtml(p, { look: "classic", cardHide: [], exclude: ["quotes"] })).not.toContain(
    "PrivateOldProject needs a fixed target",
  )
  expect(renderHtml({ ...p, historyComparison: null })).not.toContain(
    "Differences between comparable windows",
  )
})
