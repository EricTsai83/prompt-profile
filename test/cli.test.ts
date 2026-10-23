import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { Command } from "effect/cli"
import { TestConsole } from "effect/testing"
import { command } from "../src/cli/main.ts"
import { VERSION } from "../src/version.ts"

describe("cli", () => {
  it.effect("--version prints the package version", () =>
    Effect.gen(function* () {
      yield* Command.runWith(command, { version: VERSION })(["--version"])
      const lines = yield* TestConsole.logLines
      expect(lines.join("\n")).toContain(VERSION)
    }).pipe(Effect.provide([NodeServices.layer, TestConsole.layer])),
  )
})
