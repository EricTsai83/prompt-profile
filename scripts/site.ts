/**
 * The GitHub Pages site: `pnpm site [outDir]` (default `dist-site/`). Copies the hand-written
 * `docs/` and adds every public example, rendered from the fictional fixtures by the current
 * code, so the README images and demo reports always match `main`. CI builds and deploys it
 * (`.github/workflows/pages.yml`); none of the generated files are committed.
 */
import { Effect } from "effect"
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { decodeProfile, encodeProfile, type Profile } from "../src/domain/Profile.ts"
import { renderCard } from "../src/report/card.ts"
import { embeddedFonts } from "../src/report/fonts.ts"
import { renderHtml } from "../src/report/html.ts"
import { LOOK_IDS, PRODUCT_LOOK_IDS, REPORT_PARTS, type LookId } from "../src/report/looks.ts"

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), "utf8"))

/** The fictional sample profile. Its zh-TW translation predates portraits, so it has none. */
const sampleProfile = (): Promise<Profile> =>
  Effect.runPromise(decodeProfile(fixture("profile.sample.json")))

/** Folder of a look under `demo/`; the classic default keeps its older `full` URL. */
const lookFolder = (look: LookId): string => (look === "classic" ? "full" : look)

const escapeAttribute = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

const gallery = (reports: ReadonlyMap<string, string | Uint8Array>): string =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Report templates</title><style>body{font:16px/1.6 system-ui;background:#f5f7fa;color:#172338;max-width:1100px;margin:40px auto;padding:24px}article{padding:24px;background:white;border:1px solid #dfe3e7;margin:24px 0;border-radius:12px}img{width:100%;max-width:760px}a{color:#4055bd}</style><h1>Three ways to read a collaboration profile</h1><p>Fictional data. Each report works offline and includes overview and evidence views.</p>${PRODUCT_LOOK_IDS.map((look) => `<article><h2>${look[0]!.toUpperCase() + look.slice(1)}</h2><a href="../${look}/report.html">Open interactive report</a><p><img src="../${look}/card.png" alt="${look} fictional card"></p><details><summary>Read report here</summary><iframe title="${look} report" style="width:100%;height:1000px;border:1px solid #dfe3e7" srcdoc="${escapeAttribute(String(reports.get(`demo/${look}/report.html`)))}"></iframe></details></article>`).join("")}</html>`

/** Every generated file of the site, by path relative to the site root. */
export const siteFiles = async (): Promise<ReadonlyMap<string, string | Uint8Array>> => {
  const sample = await sampleProfile()
  // Reports also show the fictional portrait; it is English only, untranslated.
  const profile = {
    ...sample,
    portrait: fixture("portrait.sample.json") as Exclude<Profile["portrait"], undefined>,
  }
  const fonts = embeddedFonts()
  const files = new Map<string, string | Uint8Array>()
  for (const look of LOOK_IDS) {
    const options = { look, cardHide: [] }
    const folder = `demo/${lookFolder(look)}`
    files.set(`${folder}/report.html`, renderHtml(profile, options))
    // English card: embedded fonts only, no network or font cache access.
    files.set(
      `${folder}/card.png`,
      await Effect.runPromise(renderCard(profile, fonts, options, "en")),
    )
  }
  files.set(
    "demo/without-personal/report.html",
    renderHtml(profile, { look: "classic", cardHide: [], exclude: REPORT_PARTS }),
  )
  files.set("demo/templates/index.html", gallery(files))
  files.set("sample-report.html", files.get("demo/full/report.html")!)
  files.set("sample-card.png", files.get("demo/full/card.png")!)
  files.set("sample-profile.json", `${JSON.stringify(encodeProfile(sample), null, 2)}\n`)
  return files
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? "dist-site"
  rmSync(out, { recursive: true, force: true })
  cpSync("docs", out, { recursive: true, filter: (src) => !src.endsWith(".DS_Store") })
  for (const [name, data] of await siteFiles()) {
    const file = join(out, name)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, data)
  }
  console.log(`site written to ${out}/`)
}
