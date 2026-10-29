// Offline research QA only. Requires installed playwright-core and Chrome; no server.
import { createRequire } from "node:module"
import { mkdir, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import path from "node:path"
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE ||
    "/Users/eric/.npm/_npx/705bc6b22212b352/node_modules/playwright-core",
)
const root = path.resolve("docs/ux/report-redesign")
await mkdir(path.join(root, "captures"), { recursive: true })
const browser = await chromium.launch({ channel: "chrome" })
const results = []
for (const file of ["current", "poster", "route", "index"])
  for (const width of [1440, 390])
    for (const view of ["overview", "detail"])
      for (const lang of file === "current" ? ["en", "zh-TW"] : ["en"]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } })
        const errors = []
        page.on("pageerror", (e) => errors.push(e.message))
        page.on("request", (r) => {
          if (!/^(file:|data:)/.test(r.url())) errors.push(r.url())
        })
        await page.goto(pathToFileURL(path.join(root, file + ".html")).href)
        if (file === "current") {
          await page.locator(`label[for="lang-${lang}"]`).first().click()
          await page.locator(`label[for="report-${view}"]`).first().click()
          // Annotation is outside report layout and explicitly identified as research commentary.
          await page.evaluate(
            ({ view: selectedView, lang: selectedLang }) => {
              const n = document.createElement("aside")
              n.style =
                "padding:18px;background:#fff1b8;color:#252525;font:16px/1.5 Arial;border:3px solid #a65c00"
              n.textContent =
                "RESEARCH ANNOTATION · " +
                (selectedView === "overview"
                  ? "1. Compare identity prominence with activity metrics; 2. Inspect unresolved axes below."
                  : "3. Read beyond the first portrait chapter; compare repeated dimension summaries and evidence context.") +
                (selectedLang === "zh-TW"
                  ? " 4. Portrait translation is absent in this legacy fictional fixture; English fallback is not a localized portrait."
                  : "")
              document.querySelector(".page").prepend(n)
            },
            { view, lang },
          )
        } else {
          await page
            .getByRole("button", { name: view === "detail" ? "Detail" : "Overview", exact: true })
            .click()
          if (view === "detail" && (await page.locator("details:not([open])").count()))
            errors.push("Evidence starts collapsed")
          // Actual switches must preserve the selected view and reveal all evidence again.
          await page
            .getByRole("button", { name: view === "detail" ? "Overview" : "Detail", exact: true })
            .click()
          await page
            .getByRole("button", { name: view === "detail" ? "Detail" : "Overview", exact: true })
            .click()
          await page.keyboard.press("Tab")
        }
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
        if (overflow) errors.push("Horizontal page overflow")
        const name = `${file}-${lang}-${width}-${view}.png`
        await page.screenshot({ path: path.join(root, "captures", name), fullPage: true })
        results.push({ file: name, width, view, lang, errors })
        await page.close()
      }
await browser.close()
await writeFile(
  path.join(root, "captures/manifest.json"),
  JSON.stringify(
    {
      data: "Fictional only; current screenshots annotated in DOM before capture; prototypes English only",
      results,
    },
    null,
    2,
  ) + "\n",
)
console.log(
  JSON.stringify(
    { captures: results.length, failures: results.filter((x) => x.errors.length) },
    null,
    2,
  ),
)
process.exitCode = results.some((x) => x.errors.length) ? 1 : 0
