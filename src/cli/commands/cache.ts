import { Effect } from "effect"
import { AnalysisCache } from "../../analysis/cache.ts"
import type { Language } from "../../domain/Profile.ts"
import { cliMessages } from "../i18n.ts"
import { Output } from "../services.ts"

/** `cache clear`: delete the analysis cache (it contains prompt excerpts). */
export const runCacheClear = (language: Language) =>
  Effect.gen(function* () {
    const cache = yield* AnalysisCache
    const out = yield* Output
    yield* cache.clear
    yield* out.line(cliMessages[language].cacheCleared(cache.location))
  })
