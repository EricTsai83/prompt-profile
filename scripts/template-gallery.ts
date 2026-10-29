/** Reproduce public fictional template examples without history access or analysis. */
import { Effect } from "effect"
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { decodeProfile } from "../src/domain/Profile.ts"
import { renderHtml } from "../src/report/html.ts"
import { renderCard } from "../src/report/card.ts"
import { embeddedFonts } from "../src/report/fonts.ts"
import { LOOK_IDS, PRODUCT_LOOK_IDS } from "../src/report/looks.ts"

const p = await Effect.runPromise(
  decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
)
const portrait = JSON.parse(readFileSync("test/fixtures/portrait.sample.json", "utf8"))
const profile = { ...p, portrait }
const root = "docs/demo/templates"
const escapeAttribute = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
mkdirSync(root, { recursive: true })
for (const look of PRODUCT_LOOK_IDS) {
  const folder = `${root}/${look}`
  mkdirSync(folder, { recursive: true })
  writeFileSync(`${folder}/report.html`, renderHtml(profile, { look, cardHide: [] }))
  // English card: embedded fonts only, no network or font cache access.
  writeFileSync(
    `${folder}/card.png`,
    await Effect.runPromise(renderCard(profile, embeddedFonts(), { look, cardHide: [] }, "en")),
  )
}
writeFileSync(
  `${root}/index.html`,
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Report templates</title><style>body{font:16px/1.6 system-ui;background:#f5f7fa;color:#172338;max-width:1100px;margin:40px auto;padding:24px}article{padding:24px;background:white;border:1px solid #dfe3e7;margin:24px 0;border-radius:12px}img{width:100%;max-width:760px}a{color:#4055bd}</style><h1>Three ways to read a collaboration profile</h1><p>Fictional data. Each report works offline and includes overview and evidence views.</p>${PRODUCT_LOOK_IDS.map((look) => `<article><h2>${look[0]!.toUpperCase() + look.slice(1)}</h2><a href="${look}/report.html">Open interactive report</a><p><img src="data:image/png;base64,${readFileSync(`${root}/${look}/card.png`).toString("base64")}" alt="${look} fictional card"></p><details><summary>Read report here</summary><iframe title="${look} report" style="width:100%;height:1000px;border:1px solid #dfe3e7" srcdoc="${escapeAttribute(readFileSync(`${root}/${look}/report.html`, "utf8"))}"></iframe></details></article>`).join("")}</html>`,
)

// Local edge-case captures use only fictional data and are never public examples.
mkdirSync("tmp/template-edges", { recursive: true })
// Every look, so theme refactors can be checked for equivalence (template-qa.mjs).
for (const look of LOOK_IDS) {
  writeFileSync(`tmp/template-edges/${look}.html`, renderHtml(profile, { look, cardHide: [] }))
  for (const [name, input, exclude] of [
    ["legacy", { ...profile, portrait: null, stats: { ...profile.stats, techniques: null } }, []],
    [
      "unclear",
      {
        ...profile,
        portrait: {
          ...portrait,
          axes: portrait.axes.map((a: { key: string }) => ({
            ...a,
            pole: "unclear",
            evidence: [],
            counterEvidence: [],
          })),
        },
      },
      [],
    ],
    [
      "long-private",
      {
        ...profile,
        archetype: {
          name: "A thoughtful collaborator with a very long fictional identity 跨語言協作探索者".repeat(
            3,
          ),
          description: profile.archetype.description,
        },
      },
      ["quotes", "projects", "dates", "coaching", "funfacts", "custom-names"],
    ],
  ] as const) {
    writeFileSync(
      `tmp/template-edges/${look}-${name}.html`,
      renderHtml(input, { look, cardHide: [], exclude }),
    )
  }
}
