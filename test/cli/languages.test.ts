import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { defaultLanguages, parseLanguages } from "../../src/cli/options.ts"

describe("report languages", () => {
  it.each([
    ["zh_TW.UTF-8", ["zh-TW", "en"]],
    ["zh-Hant-TW", ["zh-TW", "en"]],
    ["zh_CN.UTF-8", ["zh-TW", "en"]],
    ["en_US.UTF-8", ["en"]],
    ["de-DE", ["en"]],
    ["", ["en"]],
  ] as const)("locale %s → %j", (locale, expected) => {
    expect(defaultLanguages(locale)).toEqual(expected)
  })

  it.effect("--lang keeps the given order and drops duplicates", () =>
    Effect.gen(function* () {
      expect(yield* parseLanguages("zh-TW, en,zh-TW", "en_US")).toEqual(["zh-TW", "en"])
      expect(yield* parseLanguages("en", "zh_TW")).toEqual(["en"])
      expect(yield* parseLanguages(undefined, "zh_TW")).toEqual(["zh-TW", "en"])
    }),
  )

  it.effect.each(["fr", "zh-TW,", "", "EN"])("--lang %j is rejected", (value) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(parseLanguages(value, "en_US"))
      expect(error).toMatchObject({ _tag: "InvalidArgument", flag: "--lang", value })
    }),
  )
})
