import { NodeServices } from "@effect/platform-node"
import { Layer } from "effect"
import { EnvironmentLive } from "../platform/index.ts"
import { FontSourceLive, LlmProviderLive, OpenerLive } from "./services.ts"

/** Production wiring: Node platform services + environment + real CLIs. */
export const AppLive = Layer.mergeAll(LlmProviderLive, OpenerLive, FontSourceLive).pipe(
  Layer.provideMerge(EnvironmentLive),
  Layer.provideMerge(NodeServices.layer),
)
