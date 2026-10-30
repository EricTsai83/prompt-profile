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

/** The authored bilingual demo; the stress-test sample remains a separate fixture. */
const sampleProfile = (): Promise<Profile> =>
  Effect.runPromise(decodeProfile(fixture("profile.demo.json")))

/** Folder of a look under `demo/`; the classic default keeps its older `full` URL. */
const lookFolder = (look: LookId): string => (look === "classic" ? "full" : look)

const escapeAttribute = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

const gallery = (reports: ReadonlyMap<string, string | Uint8Array>): string =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Report templates</title><style>body{font:16px/1.6 system-ui;background:#f5f7fa;color:#172338;max-width:1100px;margin:40px auto;padding:24px}article{padding:24px;background:white;border:1px solid #dfe3e7;margin:24px 0;border-radius:12px}img{width:100%;max-width:760px}a{color:#4055bd}</style><h1>Three ways to read a collaboration profile</h1><p>Fictional data. Each report works offline and includes overview and evidence views.</p>${PRODUCT_LOOK_IDS.map((look) => `<article><h2>${look[0]!.toUpperCase() + look.slice(1)}</h2><a href="../${look}/report.html">Open interactive report</a><p><img src="../${look}/card.png" alt="${look} fictional card"></p><details><summary>Read report here</summary><iframe title="${look} report" style="width:100%;height:1000px;border:1px solid #dfe3e7" srcdoc="${escapeAttribute(String(reports.get(`demo/${look}/report.html`)))}"></iframe></details></article>`).join("")}</html>`

/** The site root: what the examples are and where each one is (Pages serves `index.html`). */
const home = (): string => {
  const looks = LOOK_IDS.map(
    (look) =>
      `<li><a href="demo/${lookFolder(look)}/report.html">${look[0]!.toUpperCase() + look.slice(1)}</a>${look === "classic" ? " (default)" : ""} · <a href="demo/${lookFolder(look)}/card.png">card</a></li>`,
  ).join("")
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>prompt-profile examples</title><style>body{font:16px/1.6 system-ui;background:#f5f7fa;color:#172338;max-width:860px;margin:40px auto;padding:0 24px}h1{font-size:28px;margin-bottom:4px}h2{font-size:18px;margin-top:32px}img{width:100%;max-width:600px;border-radius:12px;border:1px solid #dfe3e7}a{color:#4055bd}code{background:#e8ecf2;padding:2px 6px;border-radius:4px}ul{padding-left:20px}</style>
<h1>prompt-profile</h1>
<p>A CLI that reads your local Claude Code and Codex prompt history, analyses it with the <code>claude</code> or <code>codex</code> CLI you are already logged in to, and writes an evidence-backed report of how you collaborate with AI. Everything below is rendered from hand-written, fictional sample data by the current code.</p>
<p><code>npx prompt-profile@latest</code> · <a href="https://github.com/EricTsai83/prompt-profile">Source on GitHub</a></p>
<p><a href="sample-report.html"><img src="sample-card.png" alt="Fictional sample share card"></a></p>
<h2>Sample report</h2>
<ul><li><a href="sample-report.html">Full report</a>: what you see on your own machine, with prompt quotes</li><li><a href="demo/without-personal/report.html">Shareable report</a>: the same profile with quotes, project names, exact dates and other personal parts left out</li><li><a href="sample-profile.json">Sample profile.json</a>: the data the report is rendered from</li></ul>
<h2>Looks</h2>
<ul>${looks}</ul>
<p><a href="demo/templates/index.html">Compare the main looks side by side</a></p>
<h2>Design notes</h2>
<ul><li><a href="ux/">Report design records and studies</a></li></ul>
</html>`
}

/** Every generated file of the site, by path relative to the site root. */
export const siteFiles = async (): Promise<ReadonlyMap<string, string | Uint8Array>> => {
  const sample = await sampleProfile()
  const profile = sample
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
  files.set("index.html", home())
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
