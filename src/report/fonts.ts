import { readFileSync } from "node:fs"

export interface FontData {
  readonly name: string
  readonly data: Uint8Array
  readonly weight: 400 | 700 | 800
}

const read = (file: string) =>
  new Uint8Array(readFileSync(new URL(`./fonts/${file}`, import.meta.url)))

/** The display face of the share-first looks (static ExtraBold, SIL OFL). */
export const DISPLAY_FONT = "Bricolage"
const DISPLAY_FILE = "BricolageGrotesque-ExtraBold.woff"

/** Fonts ship with the package (dev → src/report/fonts, build → dist/fonts). */
export const embeddedFonts = (): ReadonlyArray<FontData> => [
  { name: "Inter", weight: 400, data: read("Inter-Regular.woff") },
  { name: "Inter", weight: 700, data: read("Inter-Bold.woff") },
  { name: DISPLAY_FONT, weight: 800, data: read(DISPLAY_FILE) },
]

/** The display font as a data URL, so the HTML report stays offline. */
export const displayFontDataUrl = (): string =>
  `data:font/woff;base64,${Buffer.from(read(DISPLAY_FILE)).toString("base64")}`
