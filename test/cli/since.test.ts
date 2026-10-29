import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect } from "effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseSince } from "../../src/cli/options.ts"
import { makeHarness } from "./harness.ts"

const now = DateTime.makeUnsafe("2026-10-24T00:00:00Z")
const iso = (value: string) =>
  parseSince(value, now).pipe(Effect.map((d) => (d === null ? null : DateTime.formatIso(d))))

describe("parseSince", () => {
  it.effect.each([
    ["all", null],
    ["6m", "2026-04-24T00:00:00.000Z"],
    ["2w", "2026-10-10T00:00:00.000Z"],
    ["30d", "2026-09-24T00:00:00.000Z"],
    ["1y", "2025-10-24T00:00:00.000Z"],
    // reaching back past 1970 (or out of the Date range) means everything
    ["60y", null],
    ["999999y", null],
    ["99999999999999999999d", null],
  ] as const)("%s", ([value, expected]) =>
    Effect.gen(function* () {
      expect(yield* iso(value)).toBe(expected)
    }),
  )

  it.effect("a start exactly at the Unix epoch is kept", () =>
    Effect.gen(function* () {
      const since = yield* parseSince("56y", DateTime.makeUnsafe("2026-01-01T00:00:00Z"))
      expect(since === null ? null : DateTime.toEpochMillis(since)).toBe(0)
    }),
  )

  it.effect.each(["0d", "abc", "6", "-1m", "1h"])("rejects %s", (value) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(parseSince(value, now))
      expect(error._tag).toBe("InvalidArgument")
    }),
  )
})

describe("default range", () => {
  it.effect("is the last 3 months when --since is not given", () =>
    Effect.gen(function* () {
      const h = makeHarness({ statuses: [] })
      const r = yield* h.run(["stats", "--out", join(h.root, "s")])
      expect(r.code).toBe(0)
      const { window } = JSON.parse(readFileSync(join(h.root, "s", "stats.json"), "utf8"))
      const until = new Date(window.until)
      until.setUTCMonth(until.getUTCMonth() - 3)
      expect(window.since).toBe(until.toISOString())
    }),
  )
})
