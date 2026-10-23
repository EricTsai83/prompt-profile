import { readFileSync } from "node:fs"
import type { Language } from "../domain/Profile.ts"

export type PromptName = "map" | "merge" | "reduce"

const LANGUAGE_NAMES: Record<Language, string> = {
  "zh-TW": "Traditional Chinese as used in Taiwan (繁體中文，台灣用語；不要使用簡體字)",
  en: "English",
}

const cache = new Map<PromptName, string>()

/**
 * Load an instruction file. In development it lives next to this module
 * (`src/analysis/prompts/`); tsdown copies the folder to `dist/prompts/`, which is the same
 * relative location from the bundled `dist/bin.js`.
 */
export const loadPrompt = (name: PromptName, language: Language): string => {
  let raw = cache.get(name)
  if (raw === undefined) {
    raw = readFileSync(new URL(`./prompts/${name}.md`, import.meta.url), "utf8")
    cache.set(name, raw)
  }
  return raw.replaceAll("{{LANGUAGE}}", LANGUAGE_NAMES[language])
}
