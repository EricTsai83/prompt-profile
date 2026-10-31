import { escapeHtml } from "../../src/report/html-template.ts"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"

const sample = () =>
  Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
it.each([
  ["first", "How I collaborate", "我的協作方式", "第一人稱（我）"],
  ["second", "How you collaborate", "你的協作方式", "第二人稱（你）"],
  ["third", "How they collaborate", "協作方式", "第三人稱（這位使用者）"],
] as const)(
  "renders stored %s narration labels (including legacy third person) without rewriting prose or quotes",
  async (voice, en, zh, label) => {
    const base = await sample()
    const profile = { ...base, voice }
    const before = JSON.stringify(profile)
    const html = renderHtml(profile)
    expect(html).toContain(en)
    expect(html).toContain(zh)
    expect(html).toContain(label)
    expect(html).toContain(escapeHtml(base.episodes[0]!.turns[0]!.quote))
    expect(JSON.stringify(profile)).toBe(before)
  },
)
it("migrates version 18 without inventing its original perspective", async () => {
  const base = JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))
  const legacy = await Effect.runPromise(decodeProfile({ ...base, schemaVersion: 18 }))
  expect(legacy.voice).toBeUndefined()
  expect(renderHtml(legacy)).not.toContain("Narration: ")
})
