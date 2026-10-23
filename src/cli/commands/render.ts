import { Effect, FileSystem, Path } from "effect"
import { decodeProfile } from "../../domain/Profile.ts"
import { Environment } from "../../platform/Environment.ts"
import { FileError } from "../errors.ts"
import { messages } from "../messages.ts"
import { Output } from "../services.ts"
import { resolveOut, writeReportFiles } from "../steps.ts"

/** `render`: re-create report.html and card.png from an existing profile.json. */
export const runRender = (options: { readonly file: string; readonly out: string | undefined }) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const env = yield* Environment
    const out = yield* Output
    const input = path.resolve(env.cwd, options.file)
    const text = yield* fs
      .readFileString(input)
      .pipe(Effect.mapError((e) => new FileError({ path: input, detail: e.message })))
    const json = yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: () => new FileError({ path: input, detail: "not valid JSON" }),
    })
    const profile = yield* decodeProfile(json)
    const outDir = options.out ? yield* resolveOut(options.out) : path.dirname(input)
    const files = yield* writeReportFiles(profile, outDir)
    const t = messages
    yield* out.line(t.rendered(files.html))
    yield* out.line(files.card ? t.cardLine(files.card) : t.cardSkipped(files.cardError ?? "?"))
  })
