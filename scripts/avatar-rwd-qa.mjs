/** Offline avatar layout regression: PLAYWRIGHT_MODULE=<module> node scripts/avatar-rwd-qa.mjs <report.html> [...]. */
import assert from "node:assert/strict"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright")
const reports = process.argv.slice(2)
assert.ok(reports.length, "Pass at least one rendered report HTML file")
const browser = await chromium.launch({ headless: true })
let checked = 0
try {
  const page = await browser.newPage()
  for (const report of reports) {
    for (const width of [320, 390, 600, 744, 760, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(pathToFileURL(resolve(report)).href)
      for (const lang of ["en", "zh-TW"]) {
        const label = page.locator(`label[for="lang-${lang}"]`).first()
        if (await label.count()) await label.click()
        const bounds = await page.evaluate(() => {
          const art = document.querySelector(".role-avatar").getBoundingClientRect()
          const facts = document.querySelector(".hero .report-facts").getBoundingClientRect()
          const copy = document
            .querySelector(innerWidth <= 760 ? ".hero h1" : ".hero .copy")
            .getBoundingClientRect()
          return {
            factsBelow: facts.top >= art.bottom && facts.top >= copy.bottom,
            width: art.width,
            height: art.height,
            gap: art.top - copy.bottom,
            besideTitle: art.top < copy.bottom && art.bottom > copy.top,
            overlap:
              art.left < copy.right &&
              art.right > copy.left &&
              art.top < copy.bottom &&
              art.bottom > copy.top,
            overflow: document.documentElement.scrollWidth > innerWidth,
          }
        })
        const context = `${report}, ${width}px, ${lang}`
        assert.ok(bounds.width > 0 && bounds.height > 0, `Hidden avatar: ${context}`)
        assert.equal(bounds.overflow, false, context)
        assert.equal(bounds.overlap, false, context)
        assert.ok(
          Math.abs(bounds.width / bounds.height - (width <= 760 ? 1 : 2 / 3)) < 0.01,
          context,
        )
        if (width > 760) assert.ok(bounds.factsBelow, `Facts interrupt the hero: ${context}`)
        if (width <= 760) {
          assert.ok(bounds.width <= 192, `Oversized avatar: ${context}`)
          assert.ok(bounds.besideTitle, `Detached avatar: ${context}: ${JSON.stringify(bounds)}`)
        }
        checked++
      }
    }
  }
} finally {
  await browser.close()
}
console.log(`Avatar layout checks passed: ${checked} language/viewport combinations`)
