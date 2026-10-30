import { readAsset } from "../platform/assets.ts"

export type PromptName = "map" | "merge" | "reduce" | "review" | "translate"

const cache = new Map<PromptName, string>()

/**
 * Load an instruction file. In development it lives next to this module
 * (`src/analysis/prompts/`); tsdown copies the folder to `dist/prompts/`, which is the same
 * relative location from the bundled `dist/bin.js`. A standalone binary embeds them instead.
 */
export const loadPrompt = (name: PromptName): string => {
  let raw = cache.get(name)
  if (raw === undefined) {
    raw = new TextDecoder().decode(
      readAsset(`${name}.md`, () => new URL(`./prompts/${name}.md`, import.meta.url)),
    )
    cache.set(name, raw)
  }
  return raw
}
