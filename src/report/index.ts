import { Effect, FileSystem, Path } from "effect"
import { createHash } from "node:crypto"
import { encodeProfile, type Profile } from "../domain/Profile.ts"
import { writePrivateFile } from "../platform/files.ts"
import { renderCard } from "./card.ts"
import { embeddedFonts } from "./fonts.ts"
import { renderHtml } from "./html.ts"
import {
  DEFAULT_RENDER_OPTIONS,
  hiddenParts,
  isDefaultRender,
  lookOf,
  RENDER_MANIFEST_VERSION,
  type RenderOptions,
} from "./looks.ts"

export { renderHtml } from "./html.ts"
export { renderCard } from "./card.ts"
export * from "./looks.ts"

export interface ReportFiles {
  readonly html: string
  readonly profileJson: string
  /** `null` when the card could not be produced (see `cardError`). */
  readonly card: string | null
  readonly cardError: string | null
}

/**
 * Write `report.html`, `profile.json` and `card.png` into `outDir` (overwriting those three
 * files only). A card failure never fails the report. A non-default render also writes
 * `render.json`: its options and the profile it came from (`source`, relative to `outDir`).
 */
export const writeReport = (
  profile: Profile,
  outDir: string,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
  source: string | null = null,
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

    // Remove the previous card before publishing any new data. A failed card render or
    // interrupted run must never leave a share card belonging to an older profile.
    yield* fs
      .remove(cardPath, { force: true })
      .pipe(Effect.mapError((e) => new Error(`cannot remove old card ${cardPath}: ${e.message}`)))
    const profileText = `${JSON.stringify(encodeProfile(profile), null, 2)}\n`
    yield* write(profileJson, profileText)
    yield* write(html, renderHtml(profile, options))
    if (!isDefaultRender(options)) {
      const manifest = {
        renderVersion: RENDER_MANIFEST_VERSION,
        look: options.look,
        lookVersion: lookOf(options.look)?.version ?? 1,
        cardHidden: hiddenParts(options),
        profileSha256: createHash("sha256").update(profileText).digest("hex"),
        source,
      }
      yield* write(path.join(outDir, "render.json"), `${JSON.stringify(manifest, null, 2)}\n`)
    }

    const card = yield* Effect.gen(function* () {
      const png = yield* renderCard(profile, embeddedFonts(), options)
      yield* write(cardPath, png)
      return { card: cardPath, cardError: null }
    }).pipe(Effect.catch((e) => Effect.succeed({ card: null, cardError: e.message })))
    return { html, profileJson, ...card }
  })
