import { type FileSystem, Stream } from "effect"

export interface JsonlLine {
  readonly value: unknown
  /** 1-based line number within the file. */
  readonly lineNumber: number
}

/**
 * Stream a JSONL file line by line. Lines that fail to parse (including a partially
 * written last line) are skipped and reported through `onBadLine` — never an error.
 * A file that cannot be read (or fails mid-way) ends the stream early and is reported
 * through `onUnreadable`.
 *
 * `prefilter`: lines not containing this substring are skipped *before* JSON.parse
 * (a big speed-up for Claude Code transcripts where most lines are irrelevant). Skipped
 * lines are not counted as bad.
 */
export const readJsonl = (
  fs: FileSystem.FileSystem,
  path: string,
  options: {
    readonly onBadLine: () => void
    readonly onUnreadable: () => void
    readonly prefilter?: string
  },
): Stream.Stream<JsonlLine> =>
  Stream.suspend(() => {
    // per run: re-running the stream starts again at line 1
    let lineNumber = 0
    return fs.stream(path).pipe(
      Stream.decodeText,
      Stream.splitLines,
      Stream.map((line): JsonlLine | undefined => {
        lineNumber++
        if (line.trim() === "") return undefined
        if (options.prefilter !== undefined && !line.includes(options.prefilter)) return undefined
        try {
          return { value: JSON.parse(line) as unknown, lineNumber }
        } catch {
          options.onBadLine()
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
