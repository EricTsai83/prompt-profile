import { describe, expect, it } from "@effect/vitest"
import path from "node:path"
import { resolveCacheDir } from "../../src/platform/paths.ts"

describe("resolveCacheDir", () => {
  it("uses XDG_CACHE_HOME, else ~/.cache", () => {
    expect(resolveCacheDir({ XDG_CACHE_HOME: "/x" }, "/home/u", path)).toBe("/x/prompt-profile")
    expect(resolveCacheDir({ XDG_CACHE_HOME: "" }, "/home/u", path)).toBe(
      "/home/u/.cache/prompt-profile",
    )
    expect(resolveCacheDir({}, "/home/u", path)).toBe("/home/u/.cache/prompt-profile")
  })
})
