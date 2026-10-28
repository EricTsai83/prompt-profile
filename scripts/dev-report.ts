/**
 * `pnpm dev:report`: render the sample profile into tmp/report/ so the layout can be
 * tweaked in a browser.
 */
import { NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { decodeProfile } from "../src/domain/Profile.ts"
import { writeReport } from "../src/report/index.ts"

const program = Effect.gen(function* () {
  const json = JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))
  const portrait = JSON.parse(readFileSync("test/fixtures/portrait.sample.json", "utf8"))
  // Keep this preview entirely fictional and English; the older fixture also tests translations.
  const profile = yield* decodeProfile({
    ...json,
    languages: ["en"],
    translations: {},
    portrait,
    archetype: {
      name: "Collaboration Portrait",
      description: "A fictional example of evidence-led collaboration.",
    },
    headline: "Clear destinations, room to explore the route",
  })
  console.log(yield* writeReport(profile, join("tmp", "report")))
})

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).catch((e: unknown) => {
  console.error(e)
  process.exitCode = 1
})
