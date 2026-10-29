import { Effect } from "effect"
import {
  LlmTranslation,
  matchesBase,
  type Language,
  type Profile,
  type Translation as TranslationType,
} from "../domain/Profile.ts"
import { LlmRunner, makeLlmSchema, type LlmError } from "../llm/LlmRunner.ts"
import { Progress } from "./progress.ts"
import { loadPrompt } from "./prompts.ts"

const TRANSLATION_SCHEMA = makeLlmSchema("LlmTranslation", LlmTranslation)

/** How each non-English language is named in the translation request. */
export const LANGUAGE_NAMES: Record<Exclude<Language, "en">, string> = {
  "zh-TW": "Traditional Chinese as written in Taiwan (zh-TW)",
}

/** The generated text only: no quotes, evidence, confidence or statistics leave the program. */
export const translationInput = (p: Profile): TranslationType => ({
  portrait: p.portrait
    ? {
        introduction: p.portrait.introduction,
        chapters: p.portrait.chapters.map(({ title, body }) => ({ title, body })),
        axes: p.portrait.axes.map(({ key, explanation }) => ({ key, explanation })),
      }
    : null,
  headline: p.headline,
  archetype: p.archetype,
  dimensions: p.dimensions.map(({ key, title, summary }) => ({ key, title, summary })),
  traits: p.traits.map(({ name, description }) => ({ name, description })),
  funFacts: p.funFacts,
  improvements: p.improvements.map(({ title, pattern, impact, suggestion }) => ({
    title,
    pattern,
    impact,
    suggestion,
  })),
})

/** Same shape as the English text, with dimensions in the English order; else null. */
const aligned = (p: Profile, t: TranslationType): TranslationType | null => {
  if (!matchesBase(p, t)) return null
  return { ...t, dimensions: p.dimensions.map((d) => t.dimensions.find((x) => x.key === d.key)!) }
}

/**
 * Add a translation for every requested non-English language (one call each). A failed or
 * malformed translation drops only that language; an interrupt still stops the run.
 * `languages` keeps the requested order; English is the base text even when not offered.
 */
export const addTranslations = (
  profile: Profile,
  requested: ReadonlyArray<Language>,
): Effect.Effect<Profile, LlmError, LlmRunner | Progress> =>
  Effect.gen(function* () {
    const runner = yield* LlmRunner
    const progress = yield* Progress
    const input = JSON.stringify(translationInput(profile))
    const translations: Record<string, TranslationType> = {}
    for (const language of requested) {
      if (language === "en" || translations[language] !== undefined) continue
      yield* progress.onTranslateStart(language)
      const result = yield* runner
        .generate({
          system: loadPrompt("translate"),
          prompt: `language: ${language} (${LANGUAGE_NAMES[language]})\n\nprofile:\n${input}`,
          schema: TRANSLATION_SCHEMA,
        })
        .pipe(
          Effect.map((r) => aligned(profile, r.value)),
          Effect.catchIf(
            (e: LlmError) => e._tag !== "Interrupted",
            () => Effect.succeed(null),
          ),
        )
      yield* progress.onTranslated(language, result !== null)
      if (result !== null) translations[language] = result
    }
    const languages = [...new Set(requested)].filter(
      (l) => l === "en" || translations[l] !== undefined,
    )
    return {
      ...profile,
      languages: languages.length > 0 ? (languages as [Language, ...Array<Language>]) : ["en"],
      translations,
    }
  })
