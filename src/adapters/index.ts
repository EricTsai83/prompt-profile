/** The adapters: each source's local data read into `PromptRecord`s (see `registry.ts`). */
export { makeAdapters, readSources } from "./registry.ts"
export { resolveClaudeRoot } from "./claude-code/adapter.ts"
export { readSkillCatalog } from "./claude-code/skills.ts"
