import { expect, it, vi } from "vitest"
import { keyParts } from "../../src/analysis/plan.ts"
import { loadPrompt } from "../../src/analysis/prompts.ts"

vi.mock("../../src/analysis/prompts.ts", () => ({
  loadPrompt: vi.fn<(name: string) => string>((name) => name),
}))

it("editing translation or review instructions preserves upstream map and merge cache keys", () => {
  const options = { timezone: "UTC", full: false, noCache: false, model: null }
  const key = (kind: Parameters<typeof keyParts>[0]) =>
    keyParts(kind, "same-input", "codex", options)
  const before = {
    map: key("map"),
    merge: key("merge"),
    draft: key("draft"),
    review: key("review"),
    translation: key("translation"),
  }
  vi.mocked(loadPrompt).mockImplementation((name) =>
    name === "translate" ? "updated translation" : name,
  )
  expect(key("map")).toEqual(before.map)
  expect(key("merge")).toEqual(before.merge)
  expect(key("draft")).toEqual(before.draft)
  expect(key("review")).toEqual(before.review)
  expect(key("translation")).not.toEqual(before.translation)
  vi.mocked(loadPrompt).mockImplementation((name) => (name === "review" ? "updated review" : name))
  expect(key("map")).toEqual(before.map)
  expect(key("merge")).toEqual(before.merge)
  expect(key("draft")).toEqual(before.draft)
  expect(key("review")).not.toEqual(before.review)
  vi.mocked(loadPrompt).mockImplementation((name) =>
    name === "reduce" ? "updated drafting" : name,
  )
  expect(key("draft")).not.toEqual(before.draft)
  expect(key("review")).not.toEqual(before.review)
  expect(key("map")).toEqual(before.map)
})
