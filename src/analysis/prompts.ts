import { readFileSync } from "node:fs"

export type PromptName = "map" | "merge" | "reduce" | "translate"

const cache = new Map<PromptName, string>()

/**
 * Load an instruction file. In development it lives next to this module
 * (`src/analysis/prompts/`); tsdown copies the folder to `dist/prompts/`, which is the same
 * relative location from the bundled `dist/bin.js`.
 */
export const loadPrompt = (name: PromptName): string => {
  let raw = cache.get(name)
  if (raw === undefined) {
    raw = readFileSync(new URL(`./prompts/${name}.md`, import.meta.url), "utf8")
    cache.set(name, raw)
  }
  return raw
}
