/** Offline interaction checks against fictional production reports from template-gallery.ts. */
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core")
const browser = await chromium.launch({ channel: "chrome" })
let cases = 0
try {
  for (const look of ["classic", "signal", "afterhours", "studio", "prism", "slate", "folio"]) {
    for (const language of ["en", "zh-TW"]) {
      for (const colorScheme of ["light", "dark"]) {
        for (const width of [375, 1280]) {
          const page = await browser.newPage({
            viewport: { width, height: 900 },
            hasTouch: true,
            colorScheme,
          })
          await page.goto(pathToFileURL(resolve(`tmp/template-edges/${look}.html`)).href)
          await page.locator(`label[for="lang-${language}"]`).first().click()
          const control = page.locator(".report-view-overview .def>summary").first()
          await control.focus()
          if (
            !(await control.innerText())
              .toLowerCase()
              .includes(language === "en" ? "about" : "說明")
          )
            throw new Error(`Definition label: ${look}/${language}: ${await control.innerText()}`)
          await page.keyboard.press("Enter")
          if (!(await control.evaluate((n) => n.parentElement.open)))
            throw new Error("Keyboard did not pin")
          await page.keyboard.press("Enter")
          if (await control.evaluate((n) => n.parentElement.open))
            throw new Error("Keyboard did not close")
          await control.tap()
          if (!(await control.evaluate((n) => n.parentElement.open)))
            throw new Error("Tap did not pin")
          if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
            throw new Error(`Horizontal overflow: ${look}/${language}/${colorScheme}/${width}`)
          await page.emulateMedia({ media: "print", reducedMotion: "reduce" })
          const printable = await page
            .locator(".def-body")
            .evaluateAll((nodes) => nodes.every((n) => n.getBoundingClientRect().height > 0))
          if (!printable) throw new Error("Print hides definitions")
          await page.close()
          cases++
        }
      }
    }
  }
  console.log(
    `${cases} interaction cases passed (all looks, both languages/schemes, mobile/desktop).`,
  )
} finally {
  await browser.close()
}
