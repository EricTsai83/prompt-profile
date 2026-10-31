import { DEFAULT_VOICE, type Voice } from "../domain/index.ts"
import { loadPrompt, type PromptName } from "./prompts.ts"

const INSTRUCTIONS: Record<Voice, string> = {
  first:
    "Describe the profile owner in first person: I/my in English, 我/我的 in Traditional Chinese. This is an AI-authored self-description, not proof the owner endorses each claim. Preserve uncertainty; do not turn tentative observations into personal admissions.",
  second:
    "Address the profile owner in second person: you/your in English, 你/你的 in Traditional Chinese.",
}

export const narrationPrompt = (name: PromptName, voice: Voice = DEFAULT_VOICE): string =>
  `${loadPrompt(name)}\n\nNarration voice: ${voice}\n${INSTRUCTIONS[voice]}\nApply this perspective to all generated descriptive prose, including the headline, narrative, observations and experiments. Keep neutral noun headings natural. Use explicit subjects where needed in Chinese. Exact source quotes remain unchanged; sample prompts retain their intended speaker. Never use pronoun replacement to change evidence or invent facts.`
