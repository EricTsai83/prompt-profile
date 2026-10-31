import { NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { AppLive, cli } from "./cli/index.ts"

cli.pipe(Effect.provide(AppLive), NodeRuntime.runMain)
