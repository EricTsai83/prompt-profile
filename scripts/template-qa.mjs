/**
 * Offline browser regression checks for the fictional template captures of every look
 * (`scripts/template-gallery.ts` writes them to tmp/template-edges).
 *
 * Also records the computed styles of key elements per look, width and color scheme and compares
 * them with `test/report/computed-styles.json`, which catches cascade-order regressions that HTML
 * snapshots miss. `UPDATE_STYLES=1` rewrites the table after an intended visual change.
 * `QA_OUT` picks the capture folder, so two runs can be compared file by file.
 *
 * Runs axe-core (WCAG 2.2 A and AA rules) on both views of every look, width and color scheme,
 * and checks that motion plays by default and stops for `prefers-reduced-motion`. Screenshots are
 * taken with reduced motion so no capture lands mid-animation.
 */
import { createRequire } from "node:module"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE ||
    "/Users/eric/.npm/_npx/705bc6b22212b352/node_modules/playwright-core",
)
const AXE = require.resolve("axe-core/axe.min.js")
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
/** axe violations as short strings: rule id and the first offending selectors. */
const axeViolations = async (page) => {
  await page.addScriptTag({ path: AXE })
  const { violations } = await page.evaluate(
    (values) => globalThis.axe.run(document, { runOnly: { type: "tag", values } }),
    AXE_TAGS,
  )
  return violations.map(
    (v) =>
      `axe ${v.id}: ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join(", ")}${v.nodes.length > 3 ? ` (+${v.nodes.length - 3})` : ""}`,
  )
}
const LOOKS = ["classic", "signal", "afterhours", "studio", "prism", "slate", "folio"]
const STYLE_TABLE = resolve("test/report/computed-styles.json")
/** Elements whose look-specific styles matter most; the first match of each is measured. */
const KEY_ELEMENTS = [
  ".page",
  ".topbar",
  ".hero",
  ".hero h1",
  ".hero .tagline",
  ".hero .desc",
  ".hero .report-facts",
  ".identity-signatures",
  ".identity-signatures article",
  ".view-heading h2",
  ".sigs",
  ".sig",
  ".sig b",
  ".panel",
  "section > h2",
  ".overview-charts",
  ".portrait-intro",
  ".portrait-chapter",
  ".traits",
  ".report-view-detail",
]
const PROPERTIES = [
  "display",
  "width",
  "max-width",
  "padding",
  "margin",
  "border",
  "border-radius",
  "background-color",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "line-height",
  "gap",
  "grid-template-columns",
]
const browser = await chromium.launch({ channel: "chrome" })
const root = resolve(process.env.QA_OUT || "tmp/template-qa")
mkdirSync(root, { recursive: true })
const results = []
const styles = {}
for (const look of LOOKS)
  for (const width of [360, 390, 1440])
    for (const colorScheme of ["light", "dark"]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        colorScheme,
        reducedMotion: "reduce",
        // The report's CSP blocks inline scripts; axe is injected only in this test browser.
        // Outside requests are still caught by the request listener below.
        bypassCSP: true,
      })
      const errors = []
      page.on("request", (r) => {
        if (!/^(file:|data:)/.test(r.url())) errors.push(r.url())
      })
      await page.goto(pathToFileURL(resolve(`tmp/template-edges/${look}.html`)).href)
      for (const view of ["overview", "detail"])
        for (const lang of ["en", "zh-TW"]) {
          await page.locator(`label[for="report-${view}"]`).first().click()
          await page.locator(`label[for="lang-${lang}"]`).first().click()
          const check = await page.evaluate(
            ({ view: selectedView, lang: selectedLang }) => ({
              hero: document.querySelector(".hero").getClientRects().length > 0,
              centered: (() => {
                const nav = document.querySelector(".view-nav").getBoundingClientRect()
                const pageRect = document.querySelector(".page").getBoundingClientRect()
                return Math.abs(nav.x + nav.width / 2 - pageRect.x - pageRect.width / 2) < 1
              })(),
              storyAligned: (() => {
                if (selectedView !== "overview") return true
                const story = document.querySelector(".portrait h2")
                const heading = document.querySelector(".identity-moves h2")
                return (
                  !story ||
                  !heading ||
                  Math.abs(story.getBoundingClientRect().x - heading.getBoundingClientRect().x) < 1
                )
              })(),
              overflow: document.documentElement.scrollWidth > innerWidth,
              view: document.querySelector(`#report-${selectedView}`).checked,
              lang: document.querySelector(`#lang-${selectedLang}`).checked,
              collapsed: document.querySelectorAll(".report-view-detail details:not([open])")
                .length,
            }),
            { view, lang },
          )
          if (
            check.overflow ||
            !check.view ||
            !check.lang ||
            check.collapsed ||
            !check.centered ||
            !check.storyAligned ||
            check.hero !== (view === "overview")
          )
            errors.push(JSON.stringify(check))
          if (width !== 390 && lang === "en")
            errors.push(...(await axeViolations(page)).map((e) => `${view}: ${e}`))
          if (width !== 390)
            await page.screenshot({
              path: `${root}/${look}-${width}-${colorScheme}-${view}-${lang}.png`,
              fullPage: true,
            })
          if (width !== 390 && lang === "en")
            styles[`${look} ${width} ${colorScheme} ${view}`] = await page.evaluate(
              ({ selectors, properties }) =>
                Object.fromEntries(
                  selectors.map((s) => {
                    const el = [...document.querySelectorAll(s)].find(
                      (e) => e.getClientRects().length > 0,
                    )
                    if (!el) return [s, null]
                    const c = getComputedStyle(el)
                    return [
                      s,
                      Object.fromEntries(properties.map((p) => [p, c.getPropertyValue(p)])),
                    ]
                  }),
                ),
              { selectors: KEY_ELEMENTS, properties: PROPERTIES },
            )
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
for (const look of LOOKS)
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion })
    await page.goto(pathToFileURL(resolve(`tmp/template-edges/${look}.html`)).href)
    await page.locator(`label[for="report-detail"]`).first().click()
    const motion = await page.evaluate(() => ({
      view: getComputedStyle(document.querySelector(".report-view-detail")).animationName,
      sig: getComputedStyle(document.querySelector(".sig, .panel")).transitionProperty,
    }))
    const expected =
      reducedMotion === "reduce" ? { view: "none", sig: "none" } : { view: "view-in" }
    const errors = Object.entries(expected)
      .filter(([key, value]) => motion[key] !== value)
      .map(([key]) => `${key}: ${motion[key]}`)
    results.push({ look, reducedMotion, errors })
    await page.close()
  }
for (const look of LOOKS)
  for (const variant of ["legacy", "unclear", "long-private"]) {
    const page = await browser.newPage({
      viewport: { width: 360, height: 900 },
      reducedMotion: "reduce",
    })
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
writeFileSync(`${root}/computed-styles.json`, `${JSON.stringify(styles, null, 2)}\n`)
if (process.env.UPDATE_STYLES || !existsSync(STYLE_TABLE)) {
  writeFileSync(STYLE_TABLE, `${JSON.stringify(styles, null, 2)}\n`)
} else {
  const recorded = JSON.parse(readFileSync(STYLE_TABLE, "utf8"))
  for (const key of new Set([...Object.keys(recorded), ...Object.keys(styles)]))
    for (const selector of KEY_ELEMENTS) {
      const before = JSON.stringify(recorded[key]?.[selector] ?? null)
      const after = JSON.stringify(styles[key]?.[selector] ?? null)
      if (before !== after)
        results.push({ styles: `${key} ${selector}`, errors: [`was ${before}`, `now ${after}`] })
    }
}
writeFileSync(`${root}/checks.json`, JSON.stringify(results, null, 2))
console.log(
  JSON.stringify({ cases: results.length, failures: results.filter((r) => r.errors.length) }),
)
if (results.some((r) => r.errors.length)) process.exitCode = 1
