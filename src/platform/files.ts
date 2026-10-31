import { Data, Effect, PlatformError, type FileSystem, type Path } from "effect"
import { randomUUID } from "node:crypto"

/** A local file operation failed; `detail` is shown to the user. */
export class FileError extends Data.TaggedError("FileError")<{
  readonly path: string
  readonly detail: string
}> {}

/** Turn a low-level failure into a {@link FileError} about `path`; a `FileError` is kept. */
export const toFileError =
  (path: string) =>
  (e: PlatformError.PlatformError | FileError): FileError =>
    e._tag === "FileError" ? e : new FileError({ path, detail: e.message })

export const isNotFound = (e: unknown): boolean =>
  PlatformError.isPlatformError(e) && e.reason._tag === "NotFound"

/**
 * Write `data` to `file` privately: missing folders are created 0700, the file is 0600.
 * Written to a uniquely named temp file first, then renamed, so an interrupted write never
 * leaves a broken file; a failed write removes its temp file.
 *
 * An existing folder keeps its permissions: it may be the user's own (`--out .`).
 */
export const writePrivateFile = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  file: string,
  data: string | Uint8Array,
) =>
  Effect.gen(function* () {
    // recursive mkdir applies `mode` to every folder it creates, and only to those
    yield* fs.makeDirectory(path.dirname(file), { recursive: true, mode: 0o700 })
    const tmp = `${file}.${randomUUID()}.tmp`
    yield* Effect.gen(function* () {
      if (typeof data === "string") yield* fs.writeFileString(tmp, data, { mode: 0o600 })
      else yield* fs.writeFile(tmp, data, { mode: 0o600 })
      // `mode` above is masked by the umask; make sure the file is exactly 0600
      yield* fs.chmod(tmp, 0o600)
      yield* fs.rename(tmp, file)
    }).pipe(Effect.onError(() => fs.remove(tmp).pipe(Effect.ignore)))
  })
