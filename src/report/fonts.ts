import { Data, Effect, FileSystem, Path } from "effect"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { writePrivateFile } from "../platform/files.ts"

/**
 * Noto Sans TC is too large to ship in the npm package (≈ 5.7 MB per weight), so it is
 * downloaded on first card render into the cache and verified against a pinned SHA-256.
 * This is the only network request besides the LLM CLIs (see README privacy notes).
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

export class FontUnavailable extends Data.TaggedError("FontUnavailable")<{
  readonly reason: string
}> {}

export interface FontData {
  readonly name: string
  readonly data: Uint8Array
  readonly weight: 400 | 700
}

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex")

/** Inter (latin) ships with the package: dev → src/report/fonts, build → dist/fonts. */
export const embeddedLatinFonts = (): ReadonlyArray<FontData> =>
  (
    [
      [400, "Inter-Regular.woff"],
      [700, "Inter-Bold.woff"],
    ] as const
  ).map(([weight, file]) => ({
    name: "Inter",
    weight,
    data: new Uint8Array(readFileSync(new URL(`./fonts/${file}`, import.meta.url))),
  }))

export type Fetcher = (url: string) => Promise<Uint8Array>

const defaultFetch: Fetcher = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

/** Load the CJK fonts from `<cacheDir>/fonts`, downloading (and verifying) them if needed. */
export const loadCjkFonts = (
  cacheDir: string,
  fetcher: Fetcher = defaultFetch,
): Effect.Effect<ReadonlyArray<FontData>, FontUnavailable, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    return yield* Effect.forEach(CJK_FONTS, (font) =>
      Effect.gen(function* () {
        const file = path.join(cacheDir, "fonts", font.file)
        const cached = yield* fs.readFile(file).pipe(Effect.orElseSucceed(() => null))
        if (cached !== null && sha256(cached) === font.sha256) {
          return { name: "Noto Sans TC", weight: font.weight, data: cached }
        }
        const data = yield* Effect.tryPromise({
          try: () => fetcher(font.url),
          catch: (e) => new FontUnavailable({ reason: `download failed: ${String(e)}` }),
        })
        if (sha256(data) !== font.sha256) {
          return yield* new FontUnavailable({ reason: `checksum mismatch for ${font.file}` })
        }
        yield* writePrivateFile(fs, path, file, data).pipe(Effect.ignore)
        return { name: "Noto Sans TC", weight: font.weight, data }
      }),
    )
  })
