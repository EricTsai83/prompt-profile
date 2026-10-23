import { Command } from "effect/cli"
import { VERSION } from "../version.ts"

export const command = Command.make("prompt-profile").pipe(
  Command.withDescription("Analyze your AI coding agent prompts and generate a personal profile."),
)

export const cli = Command.run(command, { version: VERSION })
