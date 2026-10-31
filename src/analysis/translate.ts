import { narrationPrompt } from "./voice.ts"
import { Effect } from "effect"
import {
  LlmTranslation,
  matchesBase,
  type Language,
  type Profile,
  type Translation as TranslationType,
} from "../domain/index.ts"
import { LlmRunner, makeLlmSchema, type LlmError } from "../llm/index.ts"
import { TranslationFailed } from "./errors.ts"
import { Progress } from "./progress.ts"

const TRANSLATION_SCHEMA = makeLlmSchema("LlmTranslation", LlmTranslation)

/** How each non-English language is named in the translation request. */
export const LANGUAGE_NAMES: Record<Exclude<Language, "en">, string> = {
  "zh-TW": "Traditional Chinese as written in Taiwan (zh-TW)",
}

/** The generated text only: no quotes, evidence, confidence or statistics leave the program. */
export const translationInput = (p: Profile): TranslationType => ({
  collaboration: p.collaboration
    ? {
        moves: p.collaboration.moves.map(({ name, description, benefit, cost }) => ({
          name,
          description,
          benefit: benefit ? { claim: benefit.claim } : null,
          cost: cost ? { claim: cost.claim } : null,
        })),
        signals: p.collaboration.signals.map(({ observation, context }) => ({
          observation,
          context,
        })),
      }
    : null,
  portrait: p.portrait
    ? {
        introduction: p.portrait.introduction,
        chapters: p.portrait.chapters.map(({ title, body }) => ({ title, body })),
        axes: p.portrait.axes.map(({ key, explanation, sides }) => ({
          key,
          explanation,
          sides: sides.map(({ context }) => ({ context })),
        })),
      }
    : null,
  headline: p.headline,
  archetype: p.archetype,
  dimensions: p.dimensions.map(({ key, title, summary }) => ({ key, title, summary })),
  traits: p.traits.map(({ name, description }) => ({ name, description })),
  funFacts: p.funFacts,
  improvements: p.improvements.map(({ title, pattern, impact, suggestion, experiment }) => ({
    title,
    pattern,
    impact,
    suggestion,
    experiment: experiment ?? null,
  })),
  episodes: p.episodes.map(({ task }) => ({ task })),
  patterns: p.patterns.map(({ claim }) => ({ claim })),
})

/** Reject blank fields and clearly English prose, while preserving short technical names.
 * This is a bounded language sanity check, not a translation-quality evaluator.
 */
const completeText = (source: unknown, target: unknown, language: Language): boolean => {
  if (typeof source === "string") {
    if (typeof target !== "string") return false
    if (source.trim() && !target.trim()) return false
    return !(
      language === "zh-TW" &&
      (source.match(/[A-Za-z]+/g)?.length ?? 0) >= 6 &&
      (target.match(/[A-Za-z]+/g)?.length ?? 0) >= 6 &&
      !/\p{Script=Han}/u.test(target)
    )
  }
  if (Array.isArray(source))
    return (
      Array.isArray(target) &&
      source.length === target.length &&
      source.every((item, i) => completeText(item, target[i], language))
    )
  if (source && typeof source === "object") {
    if (!target || typeof target !== "object") return false
    return Object.entries(source).every(
      ([key, value]) =>
        key === "key" || completeText(value, (target as Record<string, unknown>)[key], language),
    )
  }
  return source === target
}

/** Same shape as the English text, with dimensions in the English order; else null. */
const aligned = (p: Profile, t: TranslationType, language: Language): TranslationType | null => {
  if (!matchesBase(p, t)) return null
  const ordered = {
    ...t,
    dimensions: p.dimensions.map((d) => t.dimensions.find((x) => x.key === d.key)!),
  }
  return completeText(translationInput(p), ordered, language) ? ordered : null
}

/**
 * Add a translation for every requested non-English language (up to two calls each). A failed or
 * malformed translation drops only that language if English was also requested.
 * When no requested language survives, fail instead of substituting English.
 * Interrupts and accounting/budget stops propagate immediately.
 * `languages` keeps the requested order; English is the base text even when not offered.
 */
export const addTranslations = (
  profile: Profile,
  requested: ReadonlyArray<Language>,
): Effect.Effect<Profile, LlmError | TranslationFailed, LlmRunner | Progress> =>
  Effect.gen(function* () {
    const runner = yield* LlmRunner
    const progress = yield* Progress
    const input = JSON.stringify(translationInput(profile))
    const translations: Record<string, TranslationType> = {}
    for (const language of requested) {
      if (language === "en" || translations[language] !== undefined) continue
      let result: TranslationType | null = null
      for (let attempt = 0; attempt < 2 && result === null; attempt++) {
        yield* progress.onTranslateStart(language)
        result = yield* runner
          .generate({
            stage: "translation",
            system: narrationPrompt("translate", profile.voice),
            prompt: `language: ${language} (${LANGUAGE_NAMES[language]})${attempt > 0 ? "\nThe previous translation was incomplete or invalid. Translate every nonempty field, including all narrative paragraphs. Return the complete object." : ""}\n\nprofile:\n${input}`,
            schema: TRANSLATION_SCHEMA,
          })
          .pipe(
            Effect.map((r) => aligned(profile, r.value, language)),
            Effect.catchIf(
              (e: LlmError) =>
                e._tag !== "Interrupted" &&
                e._tag !== "CallBudgetExceeded" &&
                e._tag !== "CostBudgetExceeded" &&
                e._tag !== "AccountingUnavailable",
              () => Effect.succeed(null),
            ),
          )
      }
      yield* progress.onTranslated(language, result !== null)
      if (result !== null) translations[language] = result
    }
    const languages = [...new Set(requested)].filter(
      (l) => l === "en" || translations[l] !== undefined,
    )
    if (languages.length === 0)
      return yield* Effect.fail(new TranslationFailed({ language: requested.join(",") }))
    return {
      ...profile,
      languages: languages as [Language, ...Array<Language>],
      translations,
    }
  })
