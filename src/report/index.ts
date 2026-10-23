import { Effect, FileSystem, Path } from "effect"
import { encodeProfile, type Profile } from "../domain/Profile.ts"
import { writePrivateFile } from "../platform/files.ts"
import { renderCard } from "./card.ts"
import { embeddedFonts } from "./fonts.ts"
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

/**
 * Write `report.html`, `profile.json` and `card.png` into `outDir` (overwriting those three
 * files only). A card failure never fails the report.
 */
export const writeReport = (
  profile: Profile,
  outDir: string,
): Effect.Effect<ReportFiles, Error, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const html = path.join(outDir, "report.html")
    const profileJson = path.join(outDir, "profile.json")
    const cardPath = path.join(outDir, "card.png")
    const write = (file: string, data: string | Uint8Array) =>
      writePrivateFile(fs, path, file, data).pipe(
        Effect.mapError((e) => new Error(`cannot write ${file}: ${e.message}`)),
      )

    yield* write(profileJson, `${JSON.stringify(encodeProfile(profile), null, 2)}\n`)
    yield* write(html, renderHtml(profile))

    const card = yield* Effect.gen(function* () {
      const png = yield* renderCard(profile, embeddedFonts())
      yield* write(cardPath, png)
      return { card: cardPath, cardError: null }
    }).pipe(Effect.catch((e) => Effect.succeed({ card: null, cardError: e.message })))
    return { html, profileJson, ...card }
  })
