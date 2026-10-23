import { createRequire } from "node:module"

declare const __PKG_VERSION__: string | undefined

/**
 * Package version. Injected by tsdown at build time; during development and tests
 * (tsx / vitest) it falls back to reading package.json.
 */
export const VERSION: string =
  typeof __PKG_VERSION__ === "string"
    ? __PKG_VERSION__
    : (createRequire(import.meta.url)("../package.json") as { version: string }).version
