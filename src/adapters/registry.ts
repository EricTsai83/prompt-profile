import { Effect, type FileSystem, Path, Stream } from "effect"
import type { PromptRecord } from "../domain/PromptRecord.ts"
import type { SourceAdapter } from "../domain/SourceAdapter.ts"
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

/** Merge all adapters' streams. Not sorted: sorting needs the whole batch (pipeline). */
export const readAll = (adapters: ReadonlyArray<SourceAdapter>): Stream.Stream<PromptRecord> =>
  Stream.mergeAll(
    adapters.map((a) => a.read),
    { concurrency: "unbounded" },
  )
