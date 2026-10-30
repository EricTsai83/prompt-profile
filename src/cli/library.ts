import { createHash } from "node:crypto"
import { Effect, FileSystem, Path } from "effect"
import { rm } from "node:fs/promises"
import { decodeProfile, type Profile } from "../domain/Profile.ts"
import { manifestOf } from "../domain/Library.ts"
import { roleCode } from "../domain/Interaction.ts"
import { PIPELINE_VERSION } from "../pipeline/version.ts"
import { checkOutput } from "../pipeline/audit.ts"
import { createRunStage, publishRun, preserveLegacy, scanLibrary } from "../platform/library.ts"
import { renderLibrary } from "../report/library.ts"
import { renderHtml } from "../report/html.ts"
import { DEFAULT_RENDER_OPTIONS, type RenderOptions } from "../report/looks.ts"
import { Environment } from "../platform/Environment.ts"
import { FileError, OutputCheckBlocked } from "./errors.ts"
import { writeReportFiles, type OutputCheck, DEFAULT_CHECK } from "./steps.ts"

export const libraryIo = <A>(root: string, task: () => Promise<A>) =>
  Effect.tryPromise({
    try: task,
    catch: (e) => new FileError({ path: root, detail: e instanceof Error ? e.message : String(e) }),
  })

export const previousProfile = (root: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const index = yield* libraryIo(root, () => scanLibrary(root)).pipe(
      Effect.orElseSucceed(() => null),
    )
    const file = index?.latest
      ? path.join(root, "reports", index.latest, "profile.json")
      : path.join(root, "profile.json")
    const text = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(() => null))
    if (text === null) return null
    return yield* Effect.try(() => JSON.parse(text) as unknown).pipe(
      Effect.flatMap(decodeProfile),
      Effect.orElseSucceed(() => null),
    )
  })

/** Archive only readable legacy profiles; unreadable originals remain untouched at the root. */
const archiveLegacy = (root: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const text = yield* fs
      .readFileString(path.join(root, "profile.json"))
      .pipe(Effect.orElseSucceed(() => null))
    if (text === null) return
    const profile = yield* Effect.try(() => JSON.parse(text) as unknown).pipe(
      Effect.flatMap(decodeProfile),
      Effect.orElseSucceed(() => null),
    )
    if (!profile) return
    const base = manifestOf(
      profile,
      `legacy-${"0".repeat(32)}`,
      "unknown",
      profile.portrait ? roleCode(profile.portrait.axes) : null,
      ["dates"],
      profile.languages.map((language) => ({
        language,
        file: null,
        error: "Legacy card availability not checked",
      })),
    )
    yield* libraryIo(root, () =>
      preserveLegacy(
        root,
        {
          ...base,
          legacyFingerprint: createHash("sha256").update(text).digest("hex"),
          schemaVersion: (JSON.parse(text) as { schemaVersion: number }).schemaVersion,
        },
        renderHtml(profile),
        renderLibrary,
      ),
    )
  })

/** Check before staging, then publish one new immutable analysis directory. */
export const writeAnalysisReport = (
  profile: Profile,
  root: string,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
  check: OutputCheck = DEFAULT_CHECK,
) =>
  Effect.gen(function* () {
    const env = yield* Environment
    const path = yield* Path.Path
    const preflight = checkOutput(profile, { ...check, username: env.username })
    if (preflight.blocked) return yield* new OutputCheckBlocked({ findings: preflight.findings })
    yield* archiveLegacy(root)
    const stage = yield* libraryIo(root, () => createRunStage(root))
    return yield* Effect.gen(function* () {
      const files = yield* writeReportFiles(
        profile,
        stage.directory,
        { ...options, libraryHref: "../../index.html" },
        null,
        check,
      )
      const manifest = manifestOf(
        files.profile,
        stage.id,
        PIPELINE_VERSION,
        files.profile.portrait ? roleCode(files.profile.portrait.axes) : null,
        options.exclude ?? [],
        files.cards.map((c) => ({
          language: c.language,
          file: c.file ? path.basename(c.file) : null,
          error: c.error,
        })),
      )
      const published = yield* libraryIo(root, () =>
        publishRun(
          root,
          stage,
          { ...manifest, createdAt: new Date().toISOString() },
          renderLibrary,
        ),
      )
      const relocated = (file: string) =>
        path.join(published.directory, path.relative(stage.directory, file))
      return {
        ...files,
        html: relocated(files.html),
        profileJson: relocated(files.profileJson),
        card: files.card ? relocated(files.card) : null,
        cards: files.cards.map((c) => ({ ...c, file: c.file ? relocated(c.file) : null })),
        libraryHome: path.join(root, "index.html"),
      }
    }).pipe(
      Effect.onError(() =>
        libraryIo(root, () => rm(stage.directory, { recursive: true, force: true })).pipe(
          Effect.ignore,
        ),
      ),
    )
  })
