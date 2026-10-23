import { Effect, type FileSystem, Path } from "effect"
import type { SourceAdapter, SourceRead } from "../domain/SourceAdapter.ts"
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
export interface SourceResult extends SourceRead {
  readonly adapter: SourceAdapter
}

/** Read every source concurrently (they are independent); results keep the adapters' order. */
export const readSources = (
  adapters: ReadonlyArray<SourceAdapter>,
): Effect.Effect<ReadonlyArray<SourceResult>> =>
  Effect.forEach(
    adapters,
    (adapter) => adapter.read.pipe(Effect.map((result) => ({ adapter, ...result }))),
    { concurrency: "unbounded" },
  )
