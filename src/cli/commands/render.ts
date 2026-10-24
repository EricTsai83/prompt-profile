import { Effect, FileSystem, Path } from "effect"
import { decodeProfile } from "../../domain/Profile.ts"
import { Environment } from "../../platform/Environment.ts"
import { FileError } from "../errors.ts"
import { messages } from "../messages.ts"
import { Output } from "../services.ts"
import { isDefaultRender, variantName, type LookId } from "../../report/looks.ts"
import { parseRenderOptions } from "../options.ts"
import { resolveOut, writeReportFiles } from "../steps.ts"

/**
 * `render`: re-create report.html and card.png from an existing profile.json. Non-default
 * render options without --out go to `variants/<name>/`, so the original is kept.
 */
export const runRender = (options: {
  readonly file: string
  readonly out: string | undefined
  readonly look: LookId
  readonly cardHide: string | undefined
}) =>
  Effect.gen(function* () {
    const renderOptions = yield* parseRenderOptions(options.look, options.cardHide)
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
    const outDir = options.out
      ? yield* resolveOut(options.out)
      : isDefaultRender(renderOptions)
        ? path.dirname(input)
        : path.join(path.dirname(input), "variants", variantName(renderOptions))
    const source = path.relative(outDir, input)
    const files = yield* writeReportFiles(profile, outDir, renderOptions, source)
    const t = messages
    yield* out.line(t.rendered(files.html))
    yield* out.line(t.renderedNoAnalysis)
    for (const card of files.cards)
      yield* out.line(
        card.file ? t.cardLine(card.file) : t.cardSkipped(card.language, card.error ?? "?"),
      )
  })
