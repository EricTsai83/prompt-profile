import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import {
  parseEffort,
  parseRenderOptions,
  renderRetryCommand,
  rerunCommand,
} from "../../src/cli/options.ts"

const parse = (name: string | undefined) =>
  Effect.runPromise(Effect.result(parseRenderOptions("classic", undefined, undefined, name)))

describe("--name", () => {
  it("is a trimmed render option; blank means no name", async () => {
    expect(await parse("  Eric  ")).toMatchObject({ success: { name: "Eric" } })
    expect(await parse("   ")).toMatchObject({ success: { name: null } })
    expect(await parse(undefined)).toMatchObject({ success: { name: null } })
  })

  it("rejects a name longer than 60 characters", async () => {
    expect(await parse("x".repeat(61))).toMatchObject({
      failure: { _tag: "InvalidArgument", flag: "--name" },
    })
  })

  it("is repeated by the re-run and render retry commands", () => {
    const flags = {
      since: "6m",
      out: "prompt-profile-report",
      full: false,
      yes: false,
      name: "Eric Tsai",
    }
    expect(rerunCommand(flags)).toContain("--name 'Eric Tsai'")
    expect(renderRetryCommand("p/profile.json", "p", flags)).toContain("--name 'Eric Tsai'")
  })
})

describe("--effort", () => {
  it.each(["low", "medium", "high", "xhigh", "max"])("accepts %s", async (value) => {
    expect(await Effect.runPromise(Effect.result(parseEffort(value)))).toMatchObject({
      success: value,
    })
  })

  it.each(["minimal", "none", "MEDIUM2", ""])(
    "rejects %s, which one of the CLIs lacks",
    async (value) => {
      expect(await Effect.runPromise(Effect.result(parseEffort(value)))).toMatchObject({
        failure: { _tag: "InvalidArgument", flag: "--effort" },
      })
    },
  )

  it("is not set by default and is repeated by the re-run command", async () => {
    expect(await Effect.runPromise(Effect.result(parseEffort(undefined)))).toMatchObject({
      success: null,
    })
    const flags = { since: "3m", out: "prompt-profile-report", full: false, yes: false }
    expect(rerunCommand({ ...flags, effort: "medium" })).toContain("--effort medium")
  })
})
