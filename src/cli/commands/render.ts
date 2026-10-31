import {
  type AvatarChoice,
  reportContents,
  isDefaultRender,
  variantName,
  type LookId,
} from "../../report/index.ts"
import {
  archivedSource,
  Environment,
  FileError,
  protectsAnalysisDirectory,
} from "../../platform/index.ts"
import { Effect, FileSystem, Path } from "effect"
import type { CheckMode } from "../../pipeline/index.ts"
import { decodeProfile } from "../../domain/index.ts"
import { messages, summaryLines } from "../messages.ts"
import { Output } from "../services.ts"
import { parseAllow, parseRenderOptions } from "../options.ts"
import { resolveOut, writeReportFiles } from "../steps.ts"

/**
 * `render`: re-create report.html and card.png from an existing profile.json. Non-default
 * render options without --out go to `variants/<name>/`, so the original is kept.
 */
export const runRender = (options: {
  readonly file: string
  readonly out: string | undefined
  readonly avatar?: AvatarChoice | undefined
  readonly look: LookId
  readonly cardHide: string | undefined
  readonly exclude?: string | undefined
  readonly name?: string | undefined
  readonly check?: CheckMode
  readonly allow?: string | undefined
}) =>
  Effect.gen(function* () {
    const renderOptions = yield* parseRenderOptions(
      options.look,
      options.cardHide,
      options.exclude,
      options.name,
      options.avatar,
    )
    const allow = yield* parseAllow(options.allow)
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
    const archive = yield* archivedSource(input)
    const outDir = options.out
      ? yield* resolveOut(options.out)
      : archive
        ? path.join(path.dirname(archive), "variants", variantName(renderOptions))
        : isDefaultRender(renderOptions)
          ? path.dirname(input)
          : path.join(path.dirname(input), "variants", variantName(renderOptions))
    if (yield* protectsAnalysisDirectory(outDir))
      return yield* new FileError({
        path: outDir,
        detail:
          "Archived analysis is immutable. Omit --out for a render variant or choose an external output folder.",
      })
    const source = path.relative(outDir, archive ?? input)
    const libraryHref =
      archive && outDir.startsWith(`${path.dirname(archive)}${path.sep}`)
        ? path
            .relative(outDir, path.resolve(path.dirname(archive), "../..", "index.html"))
            .replaceAll("\\", "/")
        : undefined
    const files = yield* writeReportFiles(
      profile,
      outDir,
      { ...renderOptions, ...(libraryHref ? { libraryHref } : {}) },
      source,
      {
        mode: options.check ?? "mask",
        allow,
      },
    )
    const t = messages
    yield* out.line(t.rendered(files.html))
    yield* out.line(t.renderedNoAnalysis)
    for (const card of files.cards)
      yield* out.line(
        card.file ? t.cardLine(card.file) : t.cardSkipped(card.language, card.error ?? "?"),
      )
    for (const line of summaryLines(
      reportContents(files.profile, renderOptions),
      files.findings,
      input,
    ))
      yield* out.line(line)
  })
