import {
  LlmChunkAnalysis,
  LlmChunkObservations,
  LlmProfileDraft,
  LlmTranslation,
  toLlmJsonSchema,
} from "../domain/index.ts"
import { SYSTEM_PREAMBLE } from "../llm/index.ts"
import type { CacheKeyParts } from "./cache.ts"
import { sha256 } from "./hash.ts"
import { loadPrompt, type PromptName } from "./prompts.ts"

/** Bump a stage revision for changes in its code/format not captured by prompt/schema hashes. */
export const STAGE_REVISIONS = {
  map: "1",
  merge: "1",
  draft: "2",
  review: "2",
  translation: "1",
} as const

const dependencies: Record<CacheKeyParts["kind"], ReadonlyArray<PromptName>> = {
  map: ["map"],
  merge: ["merge"],
  draft: ["reduce"],
  review: ["reduce", "review"],
  translation: ["translate"],
}
const schemas = {
  map: LlmChunkAnalysis,
  merge: LlmChunkObservations,
  draft: LlmProfileDraft,
  review: LlmProfileDraft,
  translation: LlmTranslation,
}

/** Downstream prompt edits must not evict upstream evidence. */
export const stageVersion = (kind: CacheKeyParts["kind"]): string =>
  sha256(
    STAGE_REVISIONS[kind],
    SYSTEM_PREAMBLE,
    ...dependencies[kind].map(loadPrompt),
    JSON.stringify(toLlmJsonSchema(schemas[kind])),
  )
