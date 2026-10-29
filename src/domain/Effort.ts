import { Schema } from "effect"

/**
 * `--effort`: the reasoning effort both CLIs accept (`claude --effort`; Codex
 * `model_reasoning_effort`, which also takes `none` / `minimal`). Unset: each CLI's default.
 */
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const
export const Effort = Schema.Literals(EFFORTS)
export type Effort = typeof Effort.Type
