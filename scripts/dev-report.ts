/**
 * `pnpm dev:report`: render the sample profile into tmp/report/ so the layout can be
 * tweaked in a browser.
 */
import { NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { decodeProfile } from "../src/domain/Profile.ts"
import { loadCjkFonts } from "../src/report/fonts.ts"
import { writeReport } from "../src/report/index.ts"

const program = Effect.gen(function* () {
  const json = JSON.parse(readFileSync("test/fixtures/profile.demo.json", "utf8"))
  const profile = yield* decodeProfile(json)
  console.log(
    yield* writeReport(
      profile,
      join("tmp", "report"),
      undefined,
      null,
      loadCjkFonts(join("tmp", "font-cache")),
    ),
  )
})

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).catch((e: unknown) => {
  console.error(e)
  process.exitCode = 1
})
