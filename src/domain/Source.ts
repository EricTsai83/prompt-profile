import { Schema } from "effect"

/** All supported prompt sources. Adding a source: extend this list and `adapters/registry.ts`. */
export const SOURCE_IDS = ["claude-code", "codex"] as const
export const SourceId = Schema.Literals(SOURCE_IDS)
export type SourceId = typeof SourceId.Type

export const ORIGINS = ["interactive", "sdk", "exec", "unknown"] as const
export const Origin = Schema.Literals(ORIGINS)
export type Origin = typeof Origin.Type
