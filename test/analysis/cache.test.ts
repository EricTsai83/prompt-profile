import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Path } from "effect"
import { mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  AnalysisCache,
  cacheKey,
  fileCacheLayer,
  resolveCacheDir,
  type CacheKeyParts,
} from "../../src/analysis/cache.ts"

const parts: CacheKeyParts = {
  kind: "map",
  inputId: "chunk-1",
  analysisVersion: "1",
  pipelineVersion: "1",
  runner: "claude-code",
  model: null,
  language: "en",
}
const entry = { ...parts, producedBy: "m", value: { chunkId: "chunk-1", observations: [] } }

describe("file cache", () => {
  const dir = join(mkdtempSync(join(tmpdir(), "pp-cache-")), "prompt-profile")

  it.effect("round-trips with private permissions", () =>
    Effect.gen(function* () {
      const cache = yield* AnalysisCache
      yield* cache.set(entry)
      expect(Option.getOrThrow(yield* cache.get(parts))).toEqual(entry)
      expect(statSync(dir).mode & 0o777).toBe(0o700)
      const file = join(dir, "map", `${cacheKey(parts)}.json`)
      expect(statSync(file).mode & 0o777).toBe(0o600)
      expect(readdirSync(join(dir, "map")).filter((f) => f.endsWith(".tmp"))).toEqual([])
    }).pipe(Effect.provide(fileCacheLayer(dir)), Effect.provide(NodeServices.layer)),
  )

  it.effect("a changed ANALYSIS_VERSION / model is a miss", () =>
    Effect.gen(function* () {
      const cache = yield* AnalysisCache
      yield* cache.set(entry)
      expect(Option.isNone(yield* cache.get({ ...parts, analysisVersion: "2" }))).toBe(true)
      expect(Option.isNone(yield* cache.get({ ...parts, model: "opus" }))).toBe(true)
    }).pipe(Effect.provide(fileCacheLayer(dir)), Effect.provide(NodeServices.layer)),
  )

  it.effect("a corrupted file is ignored", () =>
    Effect.gen(function* () {
      const cache = yield* AnalysisCache
      yield* cache.set(entry)
      writeFileSync(join(dir, "map", `${cacheKey(parts)}.json`), "{not json")
      expect(Option.isNone(yield* cache.get(parts))).toBe(true)
      yield* cache.clear
      expect(() => statSync(dir)).toThrow(/ENOENT/)
    }).pipe(Effect.provide(fileCacheLayer(dir)), Effect.provide(NodeServices.layer)),
  )

  it.effect("resolves XDG_CACHE_HOME or ~/.cache", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path
      expect(resolveCacheDir({ XDG_CACHE_HOME: "/x" }, "/home/u", path)).toBe("/x/prompt-profile")
      expect(resolveCacheDir({}, "/home/u", path)).toBe("/home/u/.cache/prompt-profile")
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
