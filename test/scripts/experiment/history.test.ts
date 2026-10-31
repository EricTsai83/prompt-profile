import { DateTime } from "effect"
import { describe, expect, it } from "vitest"
import { prepareHistory } from "../../../scripts/experiment/history.ts"
import { toRecords, type Persona } from "../../../scripts/eval-personas.ts"
import { personaFiles } from "./helpers.ts"

describe("local history snapshot", () => {
  it("freezes redacted input with a fixed clock and counted diagnostics", () => {
    const records = toRecords(
      "fictional",
      JSON.parse(personaFiles("curious-learner").raw) as Persona,
    )
    records[0] = {
      ...records[0]!,
      text: "Please review contact alice@example.com and explain the changes.",
    }
    const snapshot = prepareHistory(
      records,
      {
        now: DateTime.makeUnsafe("2026-10-31T00:00:00Z"),
        timezone: "Asia/Taipei",
        username: null,
      },
      [{ source: "codex", badLines: 2, unreadableFiles: 1 }],
    )
    expect(snapshot.prepared.name).toBe("local-history")
    expect(JSON.stringify(snapshot)).not.toContain("alice@example.com")
    expect(snapshot.prepared.prompts.some((p) => p.text.includes("[EMAIL]"))).toBe(true)
    expect(snapshot.metadata.diagnostics[0]!.badLines).toBe(2)
    expect(snapshot.metadata.now).toBe("2026-10-31T00:00:00.000Z")
    expect(snapshot.prepared.preparedSha256).toHaveLength(64)
    const frozen = JSON.stringify(snapshot)
    records[0] = { ...records[0]!, text: "Changed after collection" }
    expect(JSON.stringify(snapshot)).toBe(frozen)
  })
  it("rejects empty prepared history before launching cases", () => {
    expect(() =>
      prepareHistory(
        [],
        {
          now: DateTime.makeUnsafe("2026-10-31T00:00:00Z"),
          timezone: "UTC",
          username: null,
        },
        [],
      ),
    ).toThrow("No analysable local history")
  })
})
