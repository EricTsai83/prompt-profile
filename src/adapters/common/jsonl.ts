import { Effect, type FileSystem, Stream } from "effect"
import { zstdDecompressSync } from "node:zlib"

/**
 * The file's bytes; a `.zst` file (Codex compresses older rollouts with zstd) is decompressed
 * whole. A file that cannot be decompressed fails like an unreadable one.
 */
const bytesOf = (fs: FileSystem.FileSystem, path: string): Stream.Stream<Uint8Array, unknown> =>
  path.endsWith(".zst")
    ? Stream.fromEffect(
        fs
          .readFile(path)
          .pipe(Effect.flatMap((data) => Effect.try(() => zstdDecompressSync(data)))),
      )
    : fs.stream(path)

export interface JsonlLine {
  readonly value: unknown
  /** The raw line (for substring checks; parse `value` for data). */
  readonly raw: string
  /** 1-based line number within the file. */
  readonly lineNumber: number
  /** With `prefilter`: the first needle (in the given order) the line contains. */
  readonly needle?: string
}

/**
 * Stream a JSONL file line by line. Lines that fail to parse (including a partially
 * written last line) are skipped and reported through `onBadLine` — never an error.
 * A file that cannot be read (or fails mid-way) ends the stream early and is reported
 * through `onUnreadable`.
 *
 * `prefilter`: lines containing none of these substrings are skipped *before* JSON.parse
 * (a big speed-up for Claude Code transcripts where most lines are irrelevant). Skipped
 * lines are not counted as bad.
 */
export const readJsonl = (
  fs: FileSystem.FileSystem,
  path: string,
  options: {
    /** Gets the raw line, e.g. to tell which kind of data was lost. */
    readonly onBadLine: (raw: string) => void
    readonly onUnreadable: () => void
    readonly prefilter?: string | ReadonlyArray<string>
  },
): Stream.Stream<JsonlLine> =>
  Stream.suspend(() => {
    // per run: re-running the stream starts again at line 1
    let lineNumber = 0
    const needles =
      options.prefilter === undefined
        ? undefined
        : typeof options.prefilter === "string"
          ? [options.prefilter]
          : options.prefilter
    return bytesOf(fs, path).pipe(
      Stream.decodeText,
      Stream.splitLines,
      Stream.map((line): JsonlLine | undefined => {
        lineNumber++
        if (line.trim() === "") return undefined
        const needle = needles?.find((n) => line.includes(n))
        if (needles !== undefined && needle === undefined) return undefined
        try {
          return {
            value: JSON.parse(line) as unknown,
            raw: line,
            lineNumber,
            ...(needle === undefined ? {} : { needle }),
          }
        } catch {
          options.onBadLine(line)
          return undefined
        }
      }),
      Stream.filter((x): x is JsonlLine => x !== undefined),
      Stream.catch(() =>
        Stream.suspend(() => {
          options.onUnreadable()
          return Stream.empty
        }),
      ),
    )
  })
