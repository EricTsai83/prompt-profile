/** Offline browser regression checks for the fictional production template gallery. */
import { createRequire } from "node:module"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE ||
    "/Users/eric/.npm/_npx/705bc6b22212b352/node_modules/playwright-core",
)
const browser = await chromium.launch({ channel: "chrome" })
const root = resolve("tmp/template-qa")
mkdirSync(root, { recursive: true })
const results = []
for (const look of ["classic", "prism", "slate", "folio"])
  for (const width of [360, 390, 1440])
    for (const colorScheme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme })
      const errors = []
      page.on("request", (r) => {
        if (!/^(file:|data:)/.test(r.url())) errors.push(r.url())
      })
      await page.goto(
        pathToFileURL(
          resolve(
            look === "classic"
              ? "tmp/template-edges/classic.html"
              : `docs/demo/templates/${look}/report.html`,
          ),
        ).href,
      )
      for (const view of ["overview", "detail"])
        for (const lang of ["en", "zh-TW"]) {
          await page.locator(`label[for="report-${view}"]`).first().click()
          await page.locator(`label[for="lang-${lang}"]`).first().click()
          const check = await page.evaluate(
            ({ view: selectedView, lang: selectedLang }) => ({
              overflow: document.documentElement.scrollWidth > innerWidth,
              view: document.querySelector(`#report-${selectedView}`).checked,
              lang: document.querySelector(`#lang-${selectedLang}`).checked,
              collapsed: document.querySelectorAll(".report-view-detail details:not([open])")
                .length,
            }),
            { view, lang },
          )
          if (check.overflow || !check.view || !check.lang || check.collapsed)
            errors.push(JSON.stringify(check))
          if (width !== 390)
            await page.screenshot({
              path: `${root}/${look}-${width}-${colorScheme}-${view}-${lang}.png`,
              fullPage: true,
            })
        }
      await page.keyboard.press("Tab")
      await page.emulateMedia({ media: "print" })
      const visible = await page
        .locator(".report-view")
        .evaluateAll((nodes) => nodes.every((n) => getComputedStyle(n).display !== "none"))
      if (!visible) errors.push("print hides a view")
      results.push({ look, width, colorScheme, errors })
      await page.close()
    }
for (const look of ["prism", "slate", "folio"])
  for (const variant of ["legacy", "unclear", "long-private"]) {
    const page = await browser.newPage({ viewport: { width: 360, height: 900 } })
    await page.goto(pathToFileURL(resolve(`tmp/template-edges/${look}-${variant}.html`)).href)
    const errors = []
    for (const view of ["overview", "detail"]) {
      await page.locator(`label[for="report-${view}"]`).first().click()
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        errors.push(`${view} overflow`)
      await page.screenshot({ path: `${root}/${look}-${variant}-${view}.png`, fullPage: true })
    }
    results.push({ look, variant, width: 360, errors })
    await page.close()
  }
await browser.close()
writeFileSync(`${root}/checks.json`, JSON.stringify(results, null, 2))
console.log(
  JSON.stringify({ cases: results.length, failures: results.filter((r) => r.errors.length) }),
)
if (results.some((r) => r.errors.length)) process.exitCode = 1
