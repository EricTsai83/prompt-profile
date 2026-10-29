import { Data, Effect, FileSystem, Path } from "effect"
import { createHash } from "node:crypto"
import type { Language } from "../domain/Profile.ts"
import { readAsset } from "../platform/assets.ts"
import { writePrivateFile } from "../platform/files.ts"
import { THEMES } from "./theme.ts"

export interface FontData {
  readonly name: string
  readonly data: Uint8Array
  readonly weight: 400 | 700 | 800
}

const read = (file: string) => readAsset(file, () => new URL(`./fonts/${file}`, import.meta.url))

/** Fonts shipped with the package (dev → src/report/fonts, build → dist/fonts), by family. */
export const EMBEDDED_FONTS: Readonly<
  Record<string, ReadonlyArray<{ readonly weight: FontData["weight"]; readonly file: string }>>
> = {
  Inter: [
    { weight: 400, file: "Inter-Regular.woff" },
    { weight: 700, file: "Inter-Bold.woff" },
  ],
  // The display face of the share-first looks (static ExtraBold, SIL OFL).
  Bricolage: [{ weight: 800, file: "BricolageGrotesque-ExtraBold.woff" }],
}

/** The embedded fonts some theme's card declares. */
export const embeddedFonts = (): ReadonlyArray<FontData> => {
  const families = new Set(THEMES.flatMap((t) => [t.type.card.body, t.type.card.display]))
  return Object.entries(EMBEDDED_FONTS)
    .filter(([name]) => families.has(name))
    .flatMap(([name, faces]) => faces.map((f) => ({ name, weight: f.weight, data: read(f.file) })))
}

/** An embedded face as a data URL, so the HTML report stays offline. */
export const fontDataUrl = (family: string, weight: number): string => {
  const face = EMBEDDED_FONTS[family]?.find((f) => f.weight === weight)
  if (face === undefined) throw new Error(`no embedded font ${family} ${weight}`)
  return `data:font/woff;base64,${Buffer.from(read(face.file)).toString("base64")}`
}

/**
 * Noto Sans TC is too large to ship in the npm package (≈ 5.7 MB per weight), so it is
 * downloaded on the first card in a CJK language into the cache and verified against a pinned
 * SHA-256. This is the renderer's only network request (see README privacy notes).
 */
export const CJK_FONTS = [
  {
    weight: 400 as const,
    file: "NotoSansTC-Regular.otf",
    url: "https://raw.githubusercontent.com/notofonts/noto-cjk/165c01b46ea533872e002e0785ff17e44f6d97d8/Sans/SubsetOTF/TC/NotoSansTC-Regular.otf",
    sha256: "5bab0cb3c1cf89dde07c4a95a4054b195afbcfe784d69d75c340780712237537",
  },
  {
    weight: 700 as const,
    file: "NotoSansTC-Bold.otf",
    url: "https://raw.githubusercontent.com/notofonts/noto-cjk/165c01b46ea533872e002e0785ff17e44f6d97d8/Sans/SubsetOTF/TC/NotoSansTC-Bold.otf",
    sha256: "55420b259eb119bf5f2a0aadba10cf9d736c12d64ab93e78546d69ef5f43558b",
  },
] as const

/** Languages whose card needs the CJK font. */
export const CJK_LANGUAGES: ReadonlySet<Language> = new Set(["zh-TW"])

export class FontUnavailable extends Data.TaggedError("FontUnavailable")<{
  readonly reason: string
}> {}

/** `signal` aborts when the download is no longer needed (e.g. the other font failed). */
export type Fetcher = (url: string, signal: AbortSignal) => Promise<Uint8Array>

const defaultFetch: Fetcher = async (url, signal) => {
  const res = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex")

/** Load the CJK fonts from `<cacheDir>/fonts`, downloading (and verifying) them if needed. */
export const loadCjkFonts = (
  cacheDir: string,
  fetcher: Fetcher = defaultFetch,
): Effect.Effect<ReadonlyArray<FontData>, FontUnavailable, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    return yield* Effect.forEach(
      CJK_FONTS,
      (font) =>
        Effect.gen(function* () {
          const file = path.join(cacheDir, "fonts", font.file)
          const cached = yield* fs.readFile(file).pipe(Effect.orElseSucceed(() => null))
          if (cached !== null && sha256(cached) === font.sha256) {
            return { name: "Noto Sans TC", weight: font.weight, data: cached }
          }
          const data = yield* Effect.tryPromise({
            try: (signal) => fetcher(font.url, signal),
            catch: (e) => new FontUnavailable({ reason: `download failed: ${String(e)}` }),
          })
          if (sha256(data) !== font.sha256) {
            return yield* new FontUnavailable({ reason: `checksum mismatch for ${font.file}` })
          }
          yield* writePrivateFile(fs, path, file, data).pipe(Effect.ignore)
          return { name: "Noto Sans TC", weight: font.weight, data }
        }),
      { concurrency: CJK_FONTS.length },
    )
  })
