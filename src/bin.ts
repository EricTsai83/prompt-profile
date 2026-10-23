import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { cli } from "./cli/main.ts"

cli.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain)
