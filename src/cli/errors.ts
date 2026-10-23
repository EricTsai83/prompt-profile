import { Data, Runtime } from "effect"

/** No prompts found at all, or none in the selected range. */
export class NoData extends Data.TaggedError("NoData")<{
  readonly reason: "empty" | "out-of-range"
  readonly locations: ReadonlyArray<string>
}> {}

/** A paid action in a non-interactive session without --yes. */
export class NeedsConfirmation extends Data.TaggedError("NeedsConfirmation")<{}> {}

export class InvalidArgument extends Data.TaggedError("InvalidArgument")<{
  readonly flag: string
  readonly value: string
}> {}

export class FileError extends Data.TaggedError("FileError")<{
  readonly path: string
  readonly detail: string
}> {}

/**
 * Terminal failure after the error has been rendered: carries the process exit code and
 * suppresses Effect's default error log.
 */
export class Exit extends Data.TaggedError("Exit")<{ readonly code: number }> {
  readonly [Runtime.errorExitCode]: number
  readonly [Runtime.errorReported] = false
  constructor(args: { readonly code: number }) {
    super(args)
    this[Runtime.errorExitCode] = args.code
  }
}
