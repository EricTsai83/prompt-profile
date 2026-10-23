import { Effect, FileSystem, Path, Schema } from "effect"
import { Profile, type Profile as ProfileType } from "../domain/Profile.ts"
import { writePrivateFile } from "../platform/files.ts"
import { cardNeedsCjk, renderCard } from "./card.ts"
import { embeddedLatinFonts, loadCjkFonts, type Fetcher } from "./fonts.ts"
import { renderHtml } from "./html.ts"

export { renderHtml } from "./html.ts"
export { renderCard } from "./card.ts"

export interface ReportFiles {
  readonly html: string
  readonly profileJson: string
  /** `null` when the card could not be produced (see `cardError`). */
  readonly card: string | null
  readonly cardError: string | null
}

export interface WriteReportOptions {
  readonly outDir: string
  /** Where downloaded fonts are cached (`<cache>/fonts`). */
  readonly cacheDir: string
  readonly fetcher?: Fetcher
}

/**
 * Write `report.html`, `profile.json` and `card.png` into `outDir` (overwriting those three
 * files only). A card failure never fails the report.
 */
export const writeReport = (
  profile: ProfileType,
  options: WriteReportOptions,
): Effect.Effect<ReportFiles, Error, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const html = path.join(options.outDir, "report.html")
    const profileJson = path.join(options.outDir, "profile.json")
    const cardPath = path.join(options.outDir, "card.png")
    const write = (file: string, data: string | Uint8Array) =>
      writePrivateFile(fs, path, file, data).pipe(
        Effect.mapError((e) => new Error(`cannot write ${file}: ${e.message}`)),
      )

    yield* write(profileJson, `${JSON.stringify(Schema.encodeSync(Profile)(profile), null, 2)}\n`)
    yield* write(html, renderHtml(profile))

    const card = yield* Effect.gen(function* () {
      const latin = embeddedLatinFonts()
      const cjk = cardNeedsCjk(profile)
        ? yield* loadCjkFonts(options.cacheDir, options.fetcher)
        : []
      const png = yield* renderCard(profile, [...latin, ...cjk])
      yield* write(cardPath, png)
      return { card: cardPath, cardError: null }
    }).pipe(
      Effect.catch((e: { readonly message?: string; readonly reason?: string }) =>
        Effect.succeed({ card: null, cardError: e.reason ?? e.message ?? String(e) }),
      ),
    )
    return { html, profileJson, ...card }
  })
