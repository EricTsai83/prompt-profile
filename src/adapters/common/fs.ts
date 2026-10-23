import { Effect, type FileSystem, type Path } from "effect"

/** Entries of a directory; missing / unreadable directory → []. */
export const listDir = (
  fs: FileSystem.FileSystem,
  dir: string,
): Effect.Effect<ReadonlyArray<string>> =>
  fs.readDirectory(dir).pipe(Effect.orElseSucceed(() => []))

export const isDirectory = (fs: FileSystem.FileSystem, p: string): Effect.Effect<boolean> =>
  fs.stat(p).pipe(
    Effect.map((s) => s.type === "Directory"),
    Effect.orElseSucceed(() => false),
  )

/** Recursively find files whose name matches `predicate`. Sorted for deterministic output. */
export const findFiles = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
  predicate: (name: string) => boolean,
): Effect.Effect<ReadonlyArray<string>> =>
  Effect.gen(function* () {
    const out: Array<string> = []
    const visit = (dir: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        for (const name of (yield* listDir(fs, dir)).toSorted()) {
          const full = path.join(dir, name)
          if (yield* isDirectory(fs, full)) yield* visit(full)
          else if (predicate(name)) out.push(full)
        }
      })
    yield* visit(root)
    return out
  })
