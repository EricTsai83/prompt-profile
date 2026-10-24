import { Effect, FileSystem, Path } from "effect"
import { createHash } from "node:crypto"
import { encodeProfile, LANGUAGES, type Language, type Profile } from "../domain/Profile.ts"
import { writePrivateFile } from "../platform/files.ts"
import { renderCard } from "./card.ts"
import { CJK_LANGUAGES, embeddedFonts, FontUnavailable, type FontData } from "./fonts.ts"
import { renderHtml, renderShareHtml } from "./html.ts"
import {
  DEFAULT_RENDER_OPTIONS,
  hiddenParts,
  isDefaultRender,
  lookOf,
  RENDER_MANIFEST_VERSION,
  type RenderOptions,
} from "./looks.ts"

export { renderHtml, renderShareHtml } from "./html.ts"
export { renderCard } from "./card.ts"
export * from "./looks.ts"

export interface CardFile {
  readonly language: Language
  /** `null` when the card could not be produced (see `error`). */
  readonly file: string | null
  readonly error: string | null
}

export interface ReportFiles {
  readonly html: string
  /** The page for other people: no quotes, project names or exact dates. */
  readonly share: string
  readonly profileJson: string
  /** The default language's card (`card.png`). */
  readonly card: string | null
  readonly cardError: string | null
  /** One per profile language, the default first. */
  readonly cards: ReadonlyArray<CardFile>
}

/** `card.png` for the default language, `card.<lang>.png` for the others. */
export const cardFileName = (lang: Language, isDefault: boolean): string =>
  isDefault ? "card.png" : `card.${lang}.png`

/** Where CJK card fonts come from; the CLI passes a cached download. */
export type CjkFonts = Effect.Effect<
  ReadonlyArray<FontData>,
  FontUnavailable,
  FileSystem.FileSystem | Path.Path
>

const noCjkFonts: CjkFonts = Effect.fail(new FontUnavailable({ reason: "no CJK font available" }))

/**
 * Write `report.html`, `profile.json` and one card per language into `outDir` (overwriting
 * only those files). A card failure never fails the report. A non-default render also writes
 * `render.json`: its options and the profile it came from (`source`, relative to `outDir`).
 */
export const writeReport = (
  profile: Profile,
  outDir: string,
  options: RenderOptions = DEFAULT_RENDER_OPTIONS,
  source: string | null = null,
  cjkFonts: CjkFonts = noCjkFonts,
): Effect.Effect<ReportFiles, Error, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const html = path.join(outDir, "report.html")
    const profileJson = path.join(outDir, "profile.json")
    const write = (file: string, data: string | Uint8Array) =>
      writePrivateFile(fs, path, file, data).pipe(
        Effect.mapError((e) => new Error(`cannot write ${file}: ${e.message}`)),
      )

    // Remove the previous cards before publishing any new data. A failed card render or
    // interrupted run must never leave a share card belonging to an older profile.
    const oldCards = ["card.png", ...LANGUAGES.map((l) => cardFileName(l, false))]
    for (const name of oldCards) {
      const file = path.join(outDir, name)
      yield* fs
        .remove(file, { force: true })
        .pipe(Effect.mapError((e) => new Error(`cannot remove old card ${file}: ${e.message}`)))
    }
    const profileText = `${JSON.stringify(encodeProfile(profile), null, 2)}\n`
    yield* write(profileJson, profileText)
    yield* write(html, renderHtml(profile, options))
    const share = path.join(outDir, "share.html")
    yield* write(share, renderShareHtml(profile, options))
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

    const cjk = yield* Effect.cached(cjkFonts)
    const cards: Array<CardFile> = []
    for (const [i, language] of profile.languages.entries()) {
      const file = path.join(outDir, cardFileName(language, i === 0))
      cards.push(
        yield* Effect.gen(function* () {
          const extra = CJK_LANGUAGES.has(language) ? yield* cjk : []
          const png = yield* renderCard(profile, [...embeddedFonts(), ...extra], options, language)
          yield* write(file, png)
          return { language, file, error: null }
        }).pipe(
          Effect.catch((e: Error | FontUnavailable) =>
            Effect.succeed({
              language,
              file: null,
              error: "reason" in e ? e.reason : e.message,
            }),
          ),
        ),
      )
    }
    const first = cards[0]!
    return { html, share, profileJson, card: first.file, cardError: first.error, cards }
  })
