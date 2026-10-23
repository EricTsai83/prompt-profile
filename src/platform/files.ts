import { Effect, type FileSystem, type Path } from "effect"

/**
 * Write `data` to `file` privately: directory 0700, file 0600, via a temp file + rename so
 * an interrupted write never leaves a broken file.
 */
export const writePrivateFile = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  file: string,
  data: string | Uint8Array,
) =>
  Effect.gen(function* () {
    const dir = path.dirname(file)
    yield* fs.makeDirectory(dir, { recursive: true, mode: 0o700 })
    yield* fs.chmod(dir, 0o700)
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
    if (typeof data === "string") yield* fs.writeFileString(tmp, data, { mode: 0o600 })
    else yield* fs.writeFile(tmp, data, { mode: 0o600 })
    yield* fs.chmod(tmp, 0o600)
    yield* fs.rename(tmp, file)
  })
