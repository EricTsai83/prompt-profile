import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"

it("explains selected evidence coverage in both languages without calling it full-history frequency", async () => {
  const sample = await Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )
  const p = {
    ...sample,
    traits: sample.traits.map((t) => ({ ...t, support: { sessions: 2, weeks: 1 } })),
  }
  const html = renderHtml(p)
  expect(html).toContain("Selected evidence")
  expect(html).toContain("not full-history frequencies")
  expect(html).toContain("所選證據")
  expect(html).toContain("不代表完整歷史中的頻率")
})

it("does not present inconsistent legacy spread as selected quote coverage", async () => {
  const sample = await Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )
  const p = { ...sample, traits: [{ ...sample.traits[0]!, support: { sessions: 40, weeks: 30 } }] }
  const html = renderHtml(p)
  expect(html).not.toContain("from 40 sessions")
  expect(html).toContain("Session spread is unavailable for these selected quotes")
})
