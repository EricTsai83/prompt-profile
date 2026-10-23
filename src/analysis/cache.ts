import { Context, Effect, FileSystem, Layer, Option, Path, Schema } from "effect"
import { ChunkObservations } from "../domain/ChunkObservations.ts"
import { Language } from "../domain/Profile.ts"
import { writePrivateFile } from "../platform/files.ts"
import { sha256 } from "./hash.ts"

export interface CacheKeyParts {
  readonly kind: "map" | "merge"
  /** chunkId for map, hash of the input observations for merge. */
  readonly inputId: string
  readonly analysisVersion: string
  readonly pipelineVersion: string
  readonly runner: string
  readonly model: string | null
  readonly language: Language
}

export const cacheKey = (p: CacheKeyParts): string =>
  sha256(
    p.kind,
    p.inputId,
    p.analysisVersion,
    p.pipelineVersion,
    p.runner,
    p.model ?? "",
    p.language,
  )

/** The cache file stores the key parts so a mismatch (hash collision, tampering) is a miss. */
export const CacheEntry = Schema.Struct({
  kind: Schema.Literals(["map", "merge"]),
  inputId: Schema.String,
  analysisVersion: Schema.String,
  pipelineVersion: Schema.String,
  runner: Schema.String,
  model: Schema.NullOr(Schema.String),
  language: Language,
  /** Model reported by the CLI when the entry was produced. */
  producedBy: Schema.NullOr(Schema.String),
  value: ChunkObservations,
})
export type CacheEntry = typeof CacheEntry.Type

export interface AnalysisCacheShape {
  readonly get: (parts: CacheKeyParts) => Effect.Effect<Option.Option<CacheEntry>>
  readonly set: (entry: CacheEntry) => Effect.Effect<void>
  readonly clear: Effect.Effect<void>
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
  e.model === p.model &&
  e.language === p.language

/** `$XDG_CACHE_HOME/prompt-profile`, else `~/.cache/prompt-profile` (macOS too). */
export const resolveCacheDir = (
  env: Readonly<Record<string, string | undefined>>,
  home: string,
  path: Path.Path,
): string => path.join(env["XDG_CACHE_HOME"] || path.join(home, ".cache"), "prompt-profile")

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
        clear: fs.remove(dir, { recursive: true }).pipe(Effect.ignore),
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
