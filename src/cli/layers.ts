import { NodeServices } from "@effect/platform-node"
import { Layer } from "effect"
import { EnvironmentLive } from "../platform/Environment.ts"
import { LlmProviderLive, OpenerLive } from "./services.ts"

/** Production wiring: Node platform services + environment + real CLIs. */
export const AppLive = Layer.mergeAll(LlmProviderLive, OpenerLive).pipe(
  Layer.provideMerge(EnvironmentLive),
  Layer.provideMerge(NodeServices.layer),
)
