import { NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { AppLive } from "./cli/layers.ts"
import { cli } from "./cli/main.ts"

cli.pipe(Effect.provide(AppLive), NodeRuntime.runMain)
