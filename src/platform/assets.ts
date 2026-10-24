import { readFileSync } from "node:fs"

/**
 * Files shipped with the program: analysis prompts, fonts, the resvg wasm. The npm build reads
 * them from beside `dist/bin.js`; a standalone binary (plan 19) has no files beside it, so
 * `src/standalone.ts` registers the copies embedded in the executable, by file name.
 */
let embedded: ReadonlyMap<string, Uint8Array> | undefined

export const registerAssets = (assets: ReadonlyMap<string, Uint8Array> | undefined): void => {
  embedded = assets
}

/** The registered copy of `name`, otherwise the file `locate()` points to. */
export const readAsset = (name: string, locate: () => string | URL): Uint8Array =>
  embedded?.get(name) ?? new Uint8Array(readFileSync(locate()))
