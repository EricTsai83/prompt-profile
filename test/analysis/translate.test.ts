import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { expect, it } from "vitest"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { addTranslations, translationInput } from "../../src/analysis/translate.ts"
import { Progress, silentProgress } from "../../src/analysis/progress.ts"
import { LlmRunner, CallBudgetExceeded } from "../../src/llm/LlmRunner.ts"
import { makeFakeLlmRunner } from "../../src/llm/fake.ts"

const setup = async () => {
  const base = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const portrait = JSON.parse(readFileSync("test/fixtures/portrait.sample.json", "utf8"))
  const zh = JSON.parse(readFileSync("test/fixtures/portrait.sample.zh-TW.json", "utf8"))
  const profile = { ...base, portrait }
  const translated = { ...translationInput(profile), ...base.translations["zh-TW"]!, portrait: zh }
  return { profile, translated }
}
it("retries blank or untranslated narrative once and keeps only the complete replacement", async () => {
  const { profile, translated } = await setup()
  const before = JSON.stringify(profile)
  for (const body of ["   ", profile.portrait.chapters[0].body]) {
    let calls = 0
    const fake = makeFakeLlmRunner({
      respond: () =>
        ++calls === 1
          ? {
              ...translated,
              portrait: {
                ...translated.portrait,
                chapters: translated.portrait.chapters.map(
                  (c: { title: string; body: string }, i: number) => (i ? c : { ...c, body }),
                ),
              },
            }
          : translated,
    })
    const result = await Effect.runPromise(
      addTranslations(profile, ["zh-TW"]).pipe(
        Effect.provideService(LlmRunner, fake),
        Effect.provideService(Progress, silentProgress),
      ),
    )
    expect(fake.calls()).toBe(2)
    expect(result.languages).toEqual(["zh-TW"])
    expect(result.translations["zh-TW"]?.portrait).toEqual(translated.portrait)
    expect(JSON.stringify(profile)).toBe(before)
  }
})
it("does not silently replace a failed Chinese-only request with English", async () => {
  const { profile, translated } = await setup()
  const fake = makeFakeLlmRunner({ respond: () => ({ ...translated, portrait: null }) })
  const result = await Effect.runPromise(
    addTranslations(profile, ["zh-TW"]).pipe(
      Effect.provideService(LlmRunner, fake),
      Effect.provideService(Progress, silentProgress),
      Effect.result,
    ),
  )
  expect(result).toMatchObject({ _tag: "Failure", failure: { _tag: "TranslationFailed" } })
  expect(fake.calls()).toBe(2)
})
it("explicitly reports omitted Chinese when English was also requested", async () => {
  const { profile, translated } = await setup()
  const fake = makeFakeLlmRunner({ respond: () => ({ ...translated, headline: "" }) })
  const events: boolean[] = []
  const result = await Effect.runPromise(
    addTranslations(profile, ["zh-TW", "en"]).pipe(
      Effect.provideService(LlmRunner, fake),
      Effect.provideService(Progress, {
        ...silentProgress,
        onTranslated: (_l, ok) =>
          Effect.sync(() => {
            events.push(ok)
          }),
      }),
    ),
  )
  expect(result.languages).toEqual(["en"])
  expect(result.translations).toEqual({})
  expect(events.at(-1)).toBe(false)
})
it("propagates a translation budget stop without retrying", async () => {
  const { profile } = await setup()
  const fake = makeFakeLlmRunner({
    failures: new Map([[1, new CallBudgetExceeded({ runner: "claude-code", limit: 1 })]]),
  })
  const result = await Effect.runPromise(
    addTranslations(profile, ["zh-TW"]).pipe(
      Effect.provideService(LlmRunner, fake),
      Effect.provideService(Progress, silentProgress),
      Effect.result,
    ),
  )
  expect(result._tag).toBe("Failure")
  expect(fake.calls()).toBe(1)
})

it("preserves technical names and numeric text without spending a retry", async () => {
  const { profile, translated } = await setup()
  const fake = makeFakeLlmRunner({
    respond: () => ({
      ...translated,
      archetype: {
        name: "Claude Code",
        description: "以 React 和 TypeScript 協作，先比較 2 個方案。",
      },
    }),
  })
  const result = await Effect.runPromise(
    addTranslations(profile, ["zh-TW"]).pipe(
      Effect.provideService(LlmRunner, fake),
      Effect.provideService(Progress, silentProgress),
    ),
  )
  expect(result.translations["zh-TW"]?.archetype.name).toBe("Claude Code")
  expect(fake.calls()).toBe(1)
})
