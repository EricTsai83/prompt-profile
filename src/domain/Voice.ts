import { Schema } from "effect"

/** Perspective of generated prose; source quotes always retain their original wording. */
export const VOICES = ["first", "second"] as const
export const Voice = Schema.Literals(VOICES)
export type Voice = typeof Voice.Type
export const DEFAULT_VOICE: Voice = "second"
