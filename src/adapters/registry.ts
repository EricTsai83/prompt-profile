import { Effect, type FileSystem, Path, Stream } from "effect"
import type { PromptRecord } from "../domain/PromptRecord.ts"
import type { AdapterDiagnostics, SourceAdapter } from "../domain/SourceAdapter.ts"
import { makeClaudeCodeAdapter, resolveClaudeRoot } from "./claude-code/adapter.ts"
import { makeCodexAdapter, resolveCodexRoot } from "./codex/adapter.ts"

export interface AdapterEnv {
  readonly home: string
  readonly env: Readonly<Record<string, string | undefined>>
}

/** Every supported source. Adding a source: implement `SourceAdapter` and add it here. */
export const makeAdapters = (
  config: AdapterEnv,
): Effect.Effect<ReadonlyArray<SourceAdapter>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    return [
      yield* makeClaudeCodeAdapter(resolveClaudeRoot(config.env, config.home, path)),
      yield* makeCodexAdapter(resolveCodexRoot(config.env, config.home, path)),
    ]
  })

/** What one source produced. Records are not sorted: sorting needs the whole batch (pipeline). */
export interface SourceResult {
  readonly adapter: SourceAdapter
  readonly records: ReadonlyArray<PromptRecord>
  readonly diagnostics: AdapterDiagnostics
  readonly locations: ReadonlyArray<string>
}

/** Read every source concurrently (they are independent); results keep the adapters' order. */
export const readSources = (
  adapters: ReadonlyArray<SourceAdapter>,
): Effect.Effect<ReadonlyArray<SourceResult>> =>
  Effect.forEach(
    adapters,
    (adapter) =>
      Effect.gen(function* () {
        const records = yield* Stream.runCollect(adapter.read)
        return {
          adapter,
          records,
          diagnostics: yield* adapter.diagnostics,
          locations: yield* adapter.locations,
        }
      }),
    { concurrency: "unbounded" },
  )
