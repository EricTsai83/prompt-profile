/**
 * First line of every prompt prompt-profile sends to an LLM. Adapters skip prompts that
 * start with it, as a second safeguard (on top of --no-session-persistence / --ephemeral)
 * against analysing our own analysis calls.
 *
 * Only a *leading* marker counts: a user who merely mentions the marker in a normal prompt
 * (e.g. while developing this tool) must not lose that prompt.
 */
export const ANALYSIS_MARKER = "[prompt-profile:analysis]"

export const isAnalysisPrompt = (text: string): boolean =>
  text.trimStart().startsWith(ANALYSIS_MARKER)
