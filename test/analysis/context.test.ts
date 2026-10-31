import { expect, it } from "vitest"
import { keyParts } from "../../src/analysis/plan.ts"
import { cacheKey } from "../../src/analysis/cache.ts"

it("isolates cache identity across scoped and unscoped analyses of identical prompt text", () => {
  const options = { timezone: "UTC", full: false, noCache: false, model: null }
  const key = (contextIdentity?: string) =>
    cacheKey(keyParts("map", "same-input", "codex", { ...options, contextIdentity }))
  expect(key("one")).not.toBe(key("two"))
  expect(key("one")).not.toBe(key())
  expect(key("one")).toBe(key("one"))
})
