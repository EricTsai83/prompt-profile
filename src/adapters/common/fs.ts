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

const STAT_CONCURRENCY = 16

/**
 * Recursively find files whose name matches `predicate`. Sorted for deterministic output.
 * Symlinks are followed, but each real folder is visited once (no loops, no aliases).
 */
export const findFiles = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  root: string,
  predicate: (name: string) => boolean,
): Effect.Effect<ReadonlyArray<string>> =>
  Effect.gen(function* () {
    const visited = new Set<string>()
    const out: Array<string> = []
    const visit = (dir: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const real = yield* fs.realPath(dir).pipe(Effect.orElseSucceed(() => dir))
        if (visited.has(real)) return
        visited.add(real)
        const names = (yield* listDir(fs, dir)).toSorted()
        const entries = yield* Effect.forEach(
          names,
          (name) => {
            const full = path.join(dir, name)
            return isDirectory(fs, full).pipe(Effect.map((isDir) => ({ name, full, isDir })))
          },
          { concurrency: STAT_CONCURRENCY },
        )
        // sequential: `visited` decides which alias of a folder is kept, in sorted order
        for (const e of entries) {
          if (e.isDir) yield* visit(e.full)
          else if (predicate(e.name)) out.push(e.full)
        }
      })
    yield* visit(root)
    return out
  })
