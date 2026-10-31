/**
 * Entry point of the standalone binaries (plan 19; `scripts/build-binaries.ts`). Bun embeds
 * the prompts, fonts and resvg wasm in the executable; register them by file name, then start
 * the same CLI as `bin.ts`.
 */
import { registerAssets } from "./platform/index.ts"

declare const Bun: { readonly embeddedFiles: ReadonlyArray<Blob & { readonly name: string }> }

const assets = new Map<string, Uint8Array>()
for (const file of Bun.embeddedFiles) {
  assets.set(file.name, new Uint8Array(await file.arrayBuffer()))
}
registerAssets(assets)

await import("./bin.ts")
