import { Effect } from "effect"
import { AnalysisCache } from "../../analysis/index.ts"
import { messages } from "../messages.ts"
import { Output } from "../services.ts"

/** `cache clear`: delete the analysis cache (it contains prompt excerpts). */
export const runCacheClear = Effect.gen(function* () {
  const cache = yield* AnalysisCache
  const out = yield* Output
  yield* cache.clear
  yield* out.line(messages.cacheCleared(cache.location))
})
