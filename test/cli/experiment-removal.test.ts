import { expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { makeHarness } from "./harness.ts"

it.effect("does not offer a command for recording experiment feedback", () =>
  Effect.gen(function* () {
    const h = makeHarness()
    const r = yield* h.run(["--help"])
    expect(r.stdout).not.toContain("experiment [")
    expect(r.stdout).not.toContain("Record a selected experiment")
  }),
)
