// Builds a side-by-side review page of the "How I work with AI" layouts (plan 17):
//   npx -y -p playwright-core@1.61.1 node docs/ux/review/build.mjs <profile.json> <out-dir>
// Renders every variant (pnpm review:variants), screenshots the section at desktop and mobile
// width with the installed Google Chrome, and writes <out-dir>/index.html. No LLM calls.
// Use a synthetic profile for anything committed; real profiles belong in tmp/ only.
import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

const [profile, outDir] = process.argv.slice(2)
if (!profile || !outDir) throw new Error("usage: build.mjs <profile.json> <out-dir>")
mkdirSync(outDir, { recursive: true, mode: 0o700 })
execFileSync("pnpm", ["-s", "review:variants", profile, outDir], { stdio: "inherit" })

const playwrightPath = (() => {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    try {
      return createRequire(path.join(dir, "..", "noop.js")).resolve("playwright-core")
    } catch {}
  }
  throw new Error("playwright-core not found: run through npx -p playwright-core")
})()
const { chromium } = createRequire(import.meta.url)(playwrightPath)

const variants = readdirSync(outDir)
  .filter((f) => f.endsWith("-report.html"))
  .toSorted()
  .map((f) => ({
    file: f,
    id: f.replace("-report.html", ""),
    share: f.replace("-report", "-share"),
  }))

const browser = await chromium.launch({ channel: "chrome" })
for (const v of variants) {
  for (const [suffix, width] of [
    ["desktop", 1280],
    ["mobile", 390],
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.goto(pathToFileURL(path.resolve(outDir, v.file)).href)
    await page.waitForTimeout(300)
    const section = page.locator(".techniques").first()
    if ((await section.count()) > 0)
      await section.screenshot({ path: path.join(outDir, `${v.id}-${suffix}.png`) })
    await page.close()
  }
}
await browser.close()

const names = {
  badges: [
    "A · Badges",
    "One card per technique with its number, a monthly trend line and when it started.",
  ],
  bars: [
    "B · Bars",
    "Two ranked lists: share of sessions (workflow) and share of prompts (prompt craft).",
  ],
  timeline: [
    "C · Adoption timeline",
    "Technique × month heat grid; a dot marks the first month used.",
  ],
  highlights: [
    "D · Highlights",
    "Three statements for the strongest and fastest-growing techniques, the rest as chips.",
  ],
}
const card = (v) => {
  const view = v.id.split("-").slice(1).join("-")
  const [title, text] = names[view] ?? [v.id, ""]
  return `<section><h2>${title}</h2><p>${text}</p>
  <p><a href="${v.file}">Full private report</a> · <a href="${v.share}">Share page</a></p>
  <div class="shots"><img src="${v.id}-desktop.png" alt="${title} at 1280px"><img class="m" src="${v.id}-mobile.png" alt="${title} at 390px"></div></section>`
}
writeFileSync(
  path.join(outDir, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review: How I work with AI</title><style>
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC",sans-serif;background:#f6f6f3;color:#1d1d1f}
main{max-width:1240px;margin:0 auto;padding:32px 20px}h1{font-size:28px;margin:0 0 6px}section{background:#fff;border:1px solid #e6e6e1;border-radius:18px;padding:20px;margin:18px 0}
h2{margin:0 0 4px;font-size:20px}p{margin:4px 0;color:#55555a}.shots{display:grid;grid-template-columns:1fr 280px;gap:14px;align-items:start;margin-top:12px}
img{width:100%;border:1px solid #e6e6e1;border-radius:12px}@media(max-width:800px){.shots{grid-template-columns:1fr}.shots .m{max-width:280px}}
</style></head><body><main><h1>Review: “How I work with AI”</h1>
<p>The same profile in each layout. Pick one (or combine), then delete the others.</p>
${variants.map(card).join("\n")}</main></body></html>\n`,
)
console.log(`Review page: ${path.join(outDir, "index.html")}`)
