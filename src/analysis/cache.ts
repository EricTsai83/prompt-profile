import { Context, Data, Effect, FileSystem, Layer, Option, Path, Schema } from "effect"
import { ChunkObservations } from "../domain/ChunkObservations.ts"
import { writePrivateFile } from "../platform/files.ts"
import { sha256 } from "./hash.ts"

/** One sub-folder per kind. These hold prompt excerpts; the cache folder also holds fonts. */
export const CACHE_KINDS = ["map", "merge"] as const

export interface CacheKeyParts {
  readonly kind: (typeof CACHE_KINDS)[number]
  /** chunkId for map, hash of the input observations for merge. */
  readonly inputId: string
  readonly analysisVersion: string
  readonly pipelineVersion: string
  readonly runner: string
  readonly model: string | null
}

export const cacheKey = (p: CacheKeyParts): string =>
  sha256(p.kind, p.inputId, p.analysisVersion, p.pipelineVersion, p.runner, p.model ?? "")

/** The cache file stores the key parts so a mismatch (hash collision, tampering) is a miss. */
export const CacheEntry = Schema.Struct({
  kind: Schema.Literals(CACHE_KINDS),
  inputId: Schema.String,
  analysisVersion: Schema.String,
  pipelineVersion: Schema.String,
  runner: Schema.String,
  model: Schema.NullOr(Schema.String),
  /** Model reported by the CLI when the entry was produced. */
  producedBy: Schema.NullOr(Schema.String),
  value: ChunkObservations,
})
export type CacheEntry = typeof CacheEntry.Type

export class CacheClearFailed extends Data.TaggedError("CacheClearFailed")<{
  readonly path: string
}> {}

export interface AnalysisCacheShape {
  readonly get: (parts: CacheKeyParts) => Effect.Effect<Option.Option<CacheEntry>>
  readonly set: (entry: CacheEntry) => Effect.Effect<void>
  /** Delete every analysis entry (they contain prompt excerpts). */
  readonly clear: Effect.Effect<void, CacheClearFailed>
  readonly location: string
}

export class AnalysisCache extends Context.Service<AnalysisCache, AnalysisCacheShape>()(
  "prompt-profile/AnalysisCache",
) {}

const sameParts = (e: CacheEntry, p: CacheKeyParts) =>
  e.kind === p.kind &&
  e.inputId === p.inputId &&
  e.analysisVersion === p.analysisVersion &&
  e.pipelineVersion === p.pipelineVersion &&
  e.runner === p.runner &&
  e.model === p.model

const decodeEntry = Schema.decodeUnknownOption(Schema.fromJsonString(CacheEntry))
const encodeEntry = Schema.encodeSync(Schema.fromJsonString(CacheEntry))

/** File-backed cache. Failures never fail the analysis: a broken entry is a miss. */
export const fileCacheLayer = (dir: string) =>
  Layer.effect(
    AnalysisCache,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const fileFor = (parts: CacheKeyParts) =>
        path.join(dir, parts.kind, `${cacheKey(parts)}.json`)
      return {
        location: dir,
        get: (parts) =>
          fs.readFileString(fileFor(parts)).pipe(
            Effect.map((text) => decodeEntry(text).pipe(Option.filter((e) => sameParts(e, parts)))),
            Effect.orElseSucceed(() => Option.none()),
          ),
        set: (entry) =>
          writePrivateFile(fs, path, fileFor(entry), encodeEntry(entry)).pipe(Effect.ignore),
        // only the analysis entries: downloaded fonts in the same folder are kept
        clear: Effect.forEach(CACHE_KINDS, (kind) =>
          fs
            .remove(path.join(dir, kind), { recursive: true, force: true })
            .pipe(Effect.mapError(() => new CacheClearFailed({ path: path.join(dir, kind) }))),
        ).pipe(Effect.asVoid),
      }
    }),
  )

/** In-memory cache for tests. */
export const makeMemoryCache = (): AnalysisCacheShape & {
  readonly entries: Map<string, CacheEntry>
} => {
  const entries = new Map<string, CacheEntry>()
  return {
    entries,
    location: "memory",
    get: (parts) =>
      Effect.sync(() =>
        Option.fromNullishOr(entries.get(cacheKey(parts))).pipe(
          Option.filter((e) => sameParts(e, parts)),
        ),
      ),
    set: (entry) => Effect.sync(() => void entries.set(cacheKey(entry), entry)),
    clear: Effect.sync(() => entries.clear()),
  }
}

export const memoryCacheLayer = () => Layer.succeed(AnalysisCache, makeMemoryCache())
