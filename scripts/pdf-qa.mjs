/** Offline review artifacts from the actual fictional production HTML. No history or LLM access. */
import { createRequire } from "node:module"
import { chmodSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core")
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || "chrome" })
mkdirSync("output/pdf", { recursive: true, mode: 0o700 })
mkdirSync("tmp/pdfs", { recursive: true, mode: 0o700 })
const results = []
for (const look of ["classic", "prism", "slate", "folio"]) {
  for (const lang of ["en", "zh-TW"]) {
    const page = await browser.newPage()
    await page.goto(
      pathToFileURL(
        resolve(
          look === "classic"
            ? "tmp/template-edges/classic.html"
            : `docs/demo/templates/${look}/report.html`,
        ),
      ).href,
    )
    await page.locator(`label[for="lang-${lang}"]`).first().click()
    await page.emulateMedia({ media: "print", colorScheme: "light" })
    const state = await page.evaluate(
      (language) => ({
        views: [...document.querySelectorAll(".report-view")].every(
          (n) => getComputedStyle(n).display !== "none",
        ),
        wrongLanguage: [...document.querySelectorAll(`[data-l]:not([data-l="${language}"])`)].some(
          (n) => getComputedStyle(n).display !== "none",
        ),
        overflow: document.documentElement.scrollWidth > innerWidth,
      }),
      lang,
    )
    if (!state.views || state.wrongLanguage || state.overflow)
      throw new Error(JSON.stringify(state))
    await page.evaluate(() => document.fonts.ready)
    const file = `${look === "classic" ? "tmp/pdfs" : "output/pdf"}/${look}-${lang}.pdf`
    await page.pdf({
      path: file,
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="font:8px sans-serif;width:100%;text-align:center;color:#46515b">prompt-profile · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    })
    chmodSync(file, 0o600)
    results.push({ look, lang, ...state })
    await page.close()
  }
}
await browser.close()
writeFileSync("tmp/pdfs/browser-checks.json", JSON.stringify(results, null, 2))
console.log(results)
