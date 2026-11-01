/** Offline interaction checks against fictional production reports from template-gallery.ts. */
import { resolve } from "node:path"
import { mkdirSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { launchReportBrowser } from "./report-browser.mjs"
const browser = await launchReportBrowser()
let cases = 0
let activePage
let activeCase
try {
  for (const look of ["classic", "signal", "afterhours", "studio", "prism", "slate", "folio"]) {
    for (const language of ["en", "zh-TW"]) {
      for (const colorScheme of ["light", "dark"]) {
        for (const width of [375, 1280]) {
          const page = await browser.newPage({
            viewport: { width, height: 900 },
            hasTouch: true,
            reducedMotion: "reduce",
            colorScheme,
          })
          activePage = page
          activeCase = { look, language, colorScheme, width }
          await page.goto(pathToFileURL(resolve(`tmp/template-edges/${look}.html`)).href)
          await page.locator(`label[for="lang-${language}"]`).first().click()
          const control = page.locator(".report-view-overview .def>summary").first()
          await control.focus()
          if ((await control.locator(".def-icon").innerText()) !== "?")
            throw new Error("Missing question-mark help icon")
          const label = language === "en" ? "About" : "說明"
          if (!(await control.ariaSnapshot()).includes(label))
            throw new Error(`Missing accessible help label: ${look}/${language}`)
          const target = await control.boundingBox()
          if (target.width < 32 || target.height < 32)
            throw new Error(
              `Help target is too small: ${look}/${language}/${width}: ${JSON.stringify(target)}`,
            )
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
          await page.locator('label[for="report-detail"]').first().click()
          const generation = page.locator(".generation-details")
          if ((await generation.count()) !== 1)
            throw new Error("The interaction fixture must cover generation disclosures")
          const generationControl = generation.locator("summary")
          if (await generation.evaluate((n) => n.open))
            throw new Error("Execution details must start collapsed")
          await generationControl.focus()
          await page.keyboard.press("Enter")
          if (!(await generation.evaluate((n) => n.open)))
            throw new Error("Execution details cannot be opened with the keyboard")
          const otherLanguage = language === "en" ? "zh-TW" : "en"
          await page.locator(`label[for="lang-${otherLanguage}"]`).first().click()
          await page.locator('label[for="report-overview"]').first().click()
          await page.locator('label[for="report-detail"]').first().click()
          if (!(await generation.evaluate((n) => n.open)))
            throw new Error("Switching language or view resets disclosure state")
          if (!(await page.locator(`#lang-${otherLanguage}`).isChecked()))
            throw new Error("Switching view resets the selected language")
          await page.locator(`label[for="lang-${language}"]`).first().click()
          await generationControl.tap()
          if (await generation.evaluate((n) => n.open))
            throw new Error("Execution details cannot be closed with touch")
          const about = page.locator(".preference-evidence>.def-head .def>summary")
          const checkPopover = async () => {
            const geometry = await about.evaluate((summary) => {
              const trigger = summary.getBoundingClientRect()
              const body = summary.parentElement.querySelector(".def-body").getBoundingClientRect()
              return {
                gap: body.top - trigger.bottom,
                height: body.height,
                left: body.left,
                right: body.right,
                viewport: innerWidth,
              }
            })
            if (
              geometry.height <= 0 ||
              geometry.gap < 0 ||
              geometry.gap > 12 ||
              geometry.left < 0 ||
              geometry.right > geometry.viewport
            )
              throw new Error(
                `Definition placement: ${look}/${language}/${colorScheme}/${width}: ${JSON.stringify(geometry)}`,
              )
          }
          await about.hover()
          await checkPopover()
          await page.mouse.move(0, 0)
          await about.focus()
          await checkPopover()
          await about.tap()
          if (!(await about.evaluate((n) => n.parentElement.open)))
            throw new Error("Detail tap did not pin")
          if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
            throw new Error("Pinned detail definition overflows")
          await page.emulateMedia({ media: "print", reducedMotion: "reduce" })
          const printable = await page
            .locator(".def-body")
            .evaluateAll((nodes) => nodes.every((n) => n.getBoundingClientRect().height > 0))
          if (!printable) throw new Error("Print hides definitions")
          if (!(await generation.locator(".generation-facts").isVisible()))
            throw new Error("Print hides collapsed execution details")
          await page.close()
          cases++
        }
      }
    }
  }
  console.log(
    `${cases} interaction cases passed (all looks, both languages/schemes, mobile/desktop).`,
  )
} catch (error) {
  mkdirSync("tmp/template-qa", { recursive: true })
  writeFileSync(
    "tmp/template-qa/interaction-failure.json",
    JSON.stringify({ ...activeCase, error: String(error) }, null, 2),
  )
  if (activePage && !activePage.isClosed())
    await activePage
      .screenshot({ path: "tmp/template-qa/interaction-failure.png", fullPage: true })
      .catch(() => {})
  throw error
} finally {
  await browser.close()
}
