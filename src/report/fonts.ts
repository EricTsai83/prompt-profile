import { readFileSync } from "node:fs"

export interface FontData {
  readonly name: string
  readonly data: Uint8Array
  readonly weight: 400 | 700
}

/** Inter ships with the package (dev → src/report/fonts, build → dist/fonts). */
export const embeddedFonts = (): ReadonlyArray<FontData> =>
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
