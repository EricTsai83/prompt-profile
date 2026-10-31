import { createHash, randomUUID } from "node:crypto"
import { Effect, FileSystem, Path, type PlatformError } from "effect"
import {
  libraryIndex,
  parseRunManifest,
  RUN_ID,
  type LibraryIndex,
  type RunManifest,
} from "../domain/index.ts"
import { FileError, isNotFound, toFileError, writePrivateFile } from "./files.ts"

type Io<A> = Effect.Effect<
  A,
  PlatformError.PlatformError | FileError,
  FileSystem.FileSystem | Path.Path
>

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

const write = (file: string, data: string | Uint8Array) =>
  Effect.gen(function* () {
    yield* writePrivateFile(yield* FileSystem.FileSystem, yield* Path.Path, file, data)
  })

/** `null` when nothing exists at `file`. Never follows a symlink. */
const lstatOrNull = (file: string) =>
  Effect.gen(function* () {
    return yield* (yield* FileSystem.FileSystem)
      .lstat(file)
      .pipe(Effect.catchIf(isNotFound, () => Effect.succeed(null)))
  })

/** A regular file, not a symlink. */
const regular = (file: string) =>
  Effect.map(lstatOrNull(file), (info) => info !== null && info.type === "File")

/** Existing folders retain their permissions. Never traverse a library-owned symlink. */
const reportsDirectory = (root: string, create: boolean): Io<string> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const directory = (yield* Path.Path).join(root, "reports")
    if (create) {
      yield* fs.makeDirectory(root, { recursive: true, mode: 0o700 })
      yield* fs.makeDirectory(directory, { mode: 0o700 }).pipe(
        Effect.catchIf(
          (e) => e.reason._tag === "AlreadyExists",
          () => Effect.void,
        ),
      )
    }
    if ((yield* fs.lstat(directory)).type !== "Directory")
      return yield* new FileError({
        path: directory,
        detail: "The reports path must be a regular directory",
      })
    return directory
  })

export interface RunStage {
  readonly id: string
  readonly directory: string
}

const createStage = (root: string): Io<RunStage> =>
  Effect.gen(function* () {
    const reports = yield* reportsDirectory(root, true)
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/gu, "")
      .replace(/\.\d{3}Z$/u, "Z")
    const id = `${stamp}-${randomUUID().replaceAll("-", "")}`
    const directory = (yield* Path.Path).join(reports, `.pending-${id}`)
    yield* (yield* FileSystem.FileSystem).makeDirectory(directory, { mode: 0o700 })
    return { id, directory }
  })

/** A completed run's manifest, or `null` when the folder is not a valid completed run. */
const readRun = (reports: string, name: string): Io<RunManifest | null> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = path.join(reports, name)
    if ((yield* fs.lstat(directory)).type !== "Directory") return null
    const manifestPath = path.join(directory, "run.json")
    const info = yield* fs.lstat(manifestPath)
    if (info.type !== "File" || info.size > 64_000n) return null
    const text = yield* fs.readFileString(manifestPath)
    const run = parseRunManifest(yield* Effect.try(() => JSON.parse(text) as unknown))
    if (
      !run ||
      run.id !== name ||
      !(yield* regular(path.join(directory, "profile.json"))) ||
      !(yield* regular(path.join(directory, "report.html")))
    )
      return null
    return run
  }).pipe(Effect.orElseSucceed(() => null))

const scan = (root: string): Io<LibraryIndex> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const reports = yield* reportsDirectory(root, false).pipe(
      Effect.catchIf(isNotFound, () => Effect.succeed(null)),
    )
    if (reports === null) return libraryIndex([])
    const runs: Array<RunManifest> = []
    let skipped = 0
    for (const name of yield* fs.readDirectory(reports)) {
      if (name.startsWith(".pending-")) continue
      const run = RUN_ID.test(name) ? yield* readRun(reports, name) : null
      if (run) runs.push(run)
      else skipped++
    }
    return libraryIndex(runs, skipped)
  })

const repair = (root: string, render: (index: LibraryIndex) => string): Io<LibraryIndex> =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    yield* reportsDirectory(root, true)
    for (let attempt = 0; attempt < 32; attempt++) {
      const index = yield* scan(root)
      yield* write(path.join(root, "library.json"), json(index))
      yield* write(path.join(root, "index.html"), render(index))
      const current = yield* scan(root)
      if (json(current) === json(index)) return current
    }
    return yield* new FileError({
      path: root,
      detail:
        "Reports kept arriving while rebuilding the library; run history again to repair its index",
    })
  })

const publish = (
  root: string,
  stage: RunStage,
  manifest: RunManifest,
  render: (index: LibraryIndex) => string,
): Io<{ readonly directory: string; readonly index: LibraryIndex }> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const reports = yield* reportsDirectory(root, true)
    const invalid = (detail: string) => new FileError({ path: stage.directory, detail })
    if (
      !RUN_ID.test(stage.id) ||
      manifest.id !== stage.id ||
      path.dirname(stage.directory) !== reports ||
      !path.basename(stage.directory).startsWith(".pending-") ||
      !RUN_ID.test(path.basename(stage.directory).slice(9)) ||
      !parseRunManifest(manifest)
    )
      return yield* invalid("Invalid report publication metadata")
    if (
      !(yield* regular(path.join(stage.directory, "profile.json"))) ||
      !(yield* regular(path.join(stage.directory, "report.html")))
    )
      return yield* invalid("A report must finish its profile and HTML before publication")
    yield* write(path.join(stage.directory, "run.json"), json(manifest))
    const directory = path.join(reports, stage.id)
    if ((yield* lstatOrNull(directory)) !== null)
      return yield* invalid("A report with this id already exists")
    yield* fs.rename(stage.directory, directory)
    const index = yield* repair(root, render).pipe(
      Effect.mapError(
        () =>
          new FileError({
            path: directory,
            detail: `Completed report retained at ${directory}; library index repair failed`,
          }),
      ),
    )
    return { directory, index }
  })

/** Every public operation fails only with a {@link FileError} about `path`. */
const io = <A>(path: string, effect: Io<A>) => effect.pipe(Effect.mapError(toFileError(path)))

/** Stage a new run: a private `.pending-<id>` folder inside `<root>/reports`. */
export const createRunStage = (root: string) => io(root, createStage(root))

/** The index is disposable; immutable completion manifests are the source of truth. */
export const scanLibrary = (root: string) => io(root, scan(root))

/**
 * Concurrent writers rescan after publishing. A writer that overwrote a newer index sees
 * its additional completion manifests and republishes the union before returning success.
 * A crash can leave a stale index, but cannot remove a completed run; repair is analysis-free.
 */
export const repairLibrary = (root: string, render: (index: LibraryIndex) => string) =>
  io(root, repair(root, render))

/** Publish a finished stage (its profile and HTML written) as an immutable completed run. */
export const publishRun = (
  root: string,
  stage: RunStage,
  manifest: RunManifest,
  render: (index: LibraryIndex) => string,
) => io(root, publish(root, stage, manifest, render))

/** Remove a stage that will not be published. */
export const discardRunStage = (stage: RunStage) =>
  Effect.gen(function* () {
    yield* (yield* FileSystem.FileSystem).remove(stage.directory, { recursive: true, force: true })
  }).pipe(Effect.ignore)

/**
 * Archive the root-level artifacts of the single-report layout as a completed run, without
 * changing or deleting any original. Returns the run folder, or `null` with nothing to archive.
 */
export const preserveLegacy = (
  root: string,
  base: RunManifest,
  fallbackHtml: string,
  render: (index: LibraryIndex) => string,
) =>
  io(
    root,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const file = path.join(root, "profile.json")
      if (!(yield* regular(file))) return null
      const data = yield* fs.readFile(file)
      const fingerprint = createHash("sha256").update(data).digest("hex")
      if (base.legacyFingerprint && base.legacyFingerprint !== fingerprint)
        return yield* new FileError({
          path: file,
          detail: "Legacy profile changed while preserving it; originals retained",
        })
      const id = `legacy-${fingerprint.slice(0, 32)}`
      const archived = path.join(root, "reports", id)
      const isArchived = Effect.map(scan(root), (index) => index.runs.some((r) => r.id === id))
      if (yield* isArchived) return archived

      const stage = { ...(yield* createStage(root)), id }
      const copyFile = (from: string, to: string) =>
        Effect.gen(function* () {
          if (!(yield* regular(from))) return false
          const bytes = yield* fs
            .readFile(from)
            .pipe(Effect.catchIf(isNotFound, () => Effect.succeed(null)))
          if (bytes === null) return false
          yield* write(to, bytes)
          return true
        })
      const copyTree = (from: string, to: string, depth = 0): Io<void> =>
        Effect.gen(function* () {
          if (depth > 16)
            return yield* new FileError({
              path: from,
              detail: "Legacy variants exceed the supported nesting depth; originals retained",
            })
          if ((yield* lstatOrNull(from))?.type !== "Directory") return
          yield* fs.makeDirectory(to, { mode: 0o700 })
          for (const name of yield* fs.readDirectory(from)) {
            const child = yield* fs.lstat(path.join(from, name))
            if (child.type === "Directory")
              yield* copyTree(path.join(from, name), path.join(to, name), depth + 1)
            else if (child.type === "File")
              yield* copyFile(path.join(from, name), path.join(to, name))
          }
        })

      return yield* Effect.gen(function* () {
        yield* write(path.join(stage.directory, "profile.json"), data)
        if (
          !(yield* copyFile(
            path.join(root, "report.html"),
            path.join(stage.directory, "report.html"),
          ))
        )
          yield* write(path.join(stage.directory, "report.html"), fallbackHtml)
        const cards = []
        for (const c of base.cards) {
          const name = c.language === base.languages[0] ? "card.png" : `card.${c.language}.png`
          const copied = yield* copyFile(path.join(root, name), path.join(stage.directory, name))
          cards.push({
            language: c.language,
            file: copied ? name : null,
            error: copied ? null : "Legacy card unavailable",
          })
        }
        yield* copyFile(path.join(root, "render.json"), path.join(stage.directory, "render.json"))
        yield* copyTree(path.join(root, "variants"), path.join(stage.directory, "variants"))
        yield* publish(root, stage, { ...base, id, cards, legacyFingerprint: fingerprint }, render)
        return archived
      }).pipe(
        // a concurrent writer may have archived the same profile first
        Effect.catch((e) =>
          Effect.flatMap(isArchived, (done) => (done ? Effect.succeed(archived) : Effect.fail(e))),
        ),
        Effect.ensuring(discardRunStage(stage)),
      )
    }),
  )

const runFolder = (path: Path.Path, directory: string) =>
  RUN_ID.test(path.basename(directory)) && path.basename(path.dirname(directory)) === "reports"

/** Locate a canonical archive source, including a preserved root-level legacy profile. */
export const archivedSource = (input: string) =>
  io(
    input,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const real = yield* fs.realPath(input)
      for (let directory = path.dirname(real); ; directory = path.dirname(directory)) {
        if (runFolder(path, directory)) return path.join(directory, "profile.json")
        if (path.dirname(directory) === directory) break
      }
      if (path.basename(real) !== "profile.json") return null
      const root = path.dirname(real)
      const index = yield* scan(root)
      if (!index.runs.length) return null
      const fingerprint = createHash("sha256")
        .update(yield* fs.readFile(real))
        .digest("hex")
      const run = index.runs.find((r) => r.legacyFingerprint === fingerprint)
      return run ? path.join(root, "reports", run.id, "profile.json") : null
    }),
  )

/** Whether `directory` is (an alias of) a completed run folder, which must stay immutable. */
export const protectsAnalysisDirectory = (directory: string) =>
  io(
    directory,
    Effect.gen(function* () {
      const real = yield* (yield* FileSystem.FileSystem)
        .realPath(directory)
        .pipe(Effect.catchIf(isNotFound, () => Effect.succeed(null)))
      return real !== null && runFolder(yield* Path.Path, real)
    }),
  )
