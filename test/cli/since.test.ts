import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect } from "effect"
import { parseSince } from "../../src/cli/options.ts"

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
