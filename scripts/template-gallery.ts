/**
 * Local edge-case captures of every look for the browser checks (template-qa.mjs, pdf-qa.mjs),
 * from fictional data only. The public examples are built by `pnpm site` (scripts/site.ts).
 */
import { Effect } from "effect"
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { decodeProfile } from "../src/domain/Profile.ts"
import { renderHtml } from "../src/report/html.ts"
import { LOOK_IDS } from "../src/report/looks.ts"

const p = await Effect.runPromise(
  decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
)
const portrait = JSON.parse(readFileSync("test/fixtures/portrait.sample.json", "utf8"))
const profile = { ...p, portrait }

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
          axes: portrait.axes.map((a: { key: string }) => ({ ...a, sides: [] })),
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
