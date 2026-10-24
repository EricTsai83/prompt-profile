// Captures the presentation-experiment screenshots and writes screenshots/manifest.json.
// Research tooling, not part of the package. Needs playwright-core and Google Chrome:
//   npx -y -p playwright-core@1.61.1 node docs/ux/presentation/capture.mjs
// (if `playwright-core` does not resolve from npx, set PLAYWRIGHT_CORE to its folder).
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, "../../..")
const out = path.join(here, "screenshots")
const require = createRequire(path.join(process.cwd(), "noop.js"))
const playwrightPath = process.env.PLAYWRIGHT_CORE
  ? require.resolve(path.resolve(process.env.PLAYWRIGHT_CORE))
  : (() => {
      for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
        try {
          return createRequire(path.join(dir, "..", "noop.js")).resolve("playwright-core")
        } catch {}
      }
      return require.resolve("playwright-core")
    })()
const { chromium } = require(playwrightPath)

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex")
const SOURCES = [
  "docs/ux/presentation/experiment.html",
  "docs/ux/presentation/fixtures.js",
  "docs/ux/assets/BricolageGrotesque-latin.woff2",
  "src/report/fonts/Inter-Regular.woff",
  "src/report/fonts/Inter-Bold.woff",
]

// One axis at a time: S1 varies the story on Signal; S2 varies the look in dark mode;
// S6 runs the edge-case fixture through every look; F checks keyboard focus.
const CAPTURES = [
  ...["work-mirror", "growth-journal", "share-story"].flatMap((story) => [
    { id: "S1", file: `${story}-desktop.png`, story, width: 1440 },
    { id: "S1", file: `${story}-mobile.png`, story, width: 390 },
    { id: "S1", file: `${story}-card.png`, story, width: 1200, capture: "card" },
  ]),
  {
    id: "S2",
    file: "signal-dark-desktop.png",
    direction: "signal",
    width: 1440,
    appearance: "dark",
  },
  ...["signal", "afterhours", "studio"].map((direction) => ({
    id: "S2",
    file: `${direction}-dark-mobile.png`,
    direction,
    width: 390,
    appearance: "dark",
  })),
  { id: "S6", file: "edge-desktop.png", fixture: "edge", width: 1440 },
  { id: "S6", file: "edge-mobile-360.png", fixture: "edge", width: 360 },
  ...["signal", "afterhours", "studio"].map((direction) => ({
    id: "S6",
    file: `edge-${direction}-card.png`,
    fixture: "edge",
    direction,
    story: "share-story",
    width: 1200,
    capture: "card",
  })),
  { id: "F", file: "keyboard-focus.png", width: 1440, focus: true },
]

const urlFor = (c) => {
  const url = pathToFileURL(path.join(here, "experiment.html"))
  for (const key of ["story", "direction", "fixture", "capture"])
    if (c[key]) url.searchParams.set(key, c[key])
  return url.href
}

async function open(browser, c) {
  const context = await browser.newContext({
    viewport: { width: c.width, height: c.capture === "card" ? 630 : 900 },
    colorScheme: c.appearance ?? "light",
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const consoleMessages = []
  const remoteRequests = []
  page.on("console", (m) => consoleMessages.push({ level: m.type(), text: m.text() }))
  page.on("pageerror", (e) => consoleMessages.push({ level: "pageerror", text: e.message }))
  page.on("request", (r) => {
    if (!r.url().startsWith("file:")) remoteRequests.push(r.url())
  })
  await page.goto(urlFor(c))
  await page.waitForSelector("html[data-ready=true]")
  return { context, page, consoleMessages, remoteRequests }
}

const failed = (messages) =>
  messages.filter((m) => ["assert", "error", "pageerror"].includes(m.level))

await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: "chrome" })
const captures = []
let failures = 0

for (const c of CAPTURES) {
  const { context, page, consoleMessages, remoteRequests } = await open(browser, c)
  if (c.focus) {
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab")
      if (await page.evaluate(() => document.activeElement?.matches("#story-tabs .tab"))) break
    }
    await page.keyboard.press("ArrowRight")
  }
  const image = await page.screenshot(
    c.capture === "card"
      ? { clip: { x: 0, y: 0, width: 1200, height: 630 } }
      : { fullPage: !c.focus },
  )
  await writeFile(path.join(out, c.file), image, { mode: 0o644 })
  const checks = await page.evaluate(() => window.presentationChecks())
  const focus = c.focus
    ? await page.evaluate(() => ({
        focused: document.activeElement?.textContent,
        outline: getComputedStyle(document.activeElement).outlineStyle,
      }))
    : undefined
  const problems = [
    ...failed(consoleMessages),
    ...remoteRequests.map((u) => ({ level: "request", text: u })),
  ]
  failures += problems.length
  const size = await page.evaluate(() => [innerWidth, document.documentElement.scrollHeight])
  captures.push({
    file: c.file,
    id: c.id,
    kind: "research-prototype",
    story: checks.story,
    direction: checks.direction,
    fixture: checks.fixture,
    mode: checks.capture,
    appearance: checks.appearance,
    width: c.width,
    height: c.capture === "card" ? 630 : c.focus ? 900 : size[1],
    checks,
    ...(focus ? { focus } : {}),
    problems,
    imageSha256: sha256(image),
  })
  console.log(`${problems.length ? "FAIL" : "ok  "} ${c.file}`)
  await context.close()
}

// Switching stories and looks in one page: the source profile and evidence must not change.
const { context, page, consoleMessages, remoteRequests } = await open(browser, { width: 1440 })
const switches = await page.evaluate(() =>
  ["work-mirror", "growth-journal", "share-story"].flatMap((story) =>
    ["signal", "afterhours", "studio"].map((look) => window.presentationSelect(story, look)),
  ),
)
const switchProblems = [...failed(consoleMessages), ...remoteRequests]
failures += switchProblems.length
await context.close()
const chromeVersion = browser.version()
await browser.close()

const manifest = {
  capturedAtUtc: new Date().toISOString(),
  tool: `playwright-core ${require(path.join(path.dirname(playwrightPath), "package.json")).version} with Google Chrome ${chromeVersion}`,
  command: "npx -y -p playwright-core@1.61.1 node docs/ux/presentation/capture.mjs",
  data: "Synthetic fixtures only. Research prototype, not shipped. No LLM calls; model comparison not run.",
  sources: await Promise.all(
    SOURCES.map(async (file) => ({
      path: file,
      sha256: sha256(await readFile(path.join(repo, file))),
    })),
  ),
  captures,
  switchChecks: {
    combinations: switches.length,
    allPassed:
      switchProblems.length === 0 &&
      switches.every(
        (s) =>
          s.sourceProfileUnchanged &&
          s.evidenceMatches &&
          s.confidenceMatches &&
          s.statsMatch &&
          s.missingVisible,
      ),
    evidenceShown: [...new Set(switches.map((s) => s.evidenceShown))],
    problems: switchProblems,
  },
  limitations: [
    "Research prototype only; the production renderer and CLI are unchanged",
    "Remote requests are recorded from the page; this does not prove privacy of the analysis step",
    "Truncated card text is reported as a finding, not a failure",
    "No participant study; preferences are not established by these captures",
  ],
}
await writeFile(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`${captures.length} captures, ${failures} problems`)
process.exitCode = failures ? 1 : 0
