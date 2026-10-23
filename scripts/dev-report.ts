/**
 * `pnpm dev:report`: render the sample profiles into tmp/report-<lang>/ so the layout can be
 * tweaked in a browser. Downloads the CJK font into the normal cache on first use.
 */
import { NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { decodeProfile } from "../src/domain/Profile.ts"
import { writeReport } from "../src/report/index.ts"

const cacheDir = join(process.env["XDG_CACHE_HOME"] || join(homedir(), ".cache"), "prompt-profile")

const program = Effect.forEach(["zh-TW", "en"] as const, (lang) =>
  Effect.gen(function* () {
    const json = JSON.parse(readFileSync(`test/fixtures/profile.sample.${lang}.json`, "utf8"))
    const profile = yield* decodeProfile(json)
    const files = yield* writeReport(profile, { outDir: join("tmp", `report-${lang}`), cacheDir })
    console.log(lang, files)
  }),
)

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).catch((e: unknown) => {
  console.error(e)
  process.exitCode = 1
})
