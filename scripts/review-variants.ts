/**
 * `pnpm review:variants <profile.json> <out-dir>`: render one profile in every review
 * variant (plan 17: the "How I work with AI" layouts) as private report and share page, for
 * side-by-side review. Writes private files (0600) and an index; screenshots are taken
 * separately (docs/ux/review/capture.mjs). No LLM calls.
 */
import { NodeServices } from "@effect/platform-node"
import { Effect, FileSystem, Path } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile } from "../src/domain/Profile.ts"
import { writePrivateFile } from "../src/platform/files.ts"
import { renderHtml, renderShareHtml } from "../src/report/index.ts"
import { TECHNIQUE_VIEWS } from "../src/report/techniques.ts"

const [input, outDir] = process.argv.slice(2)
if (!input || !outDir) throw new Error("usage: review-variants <profile.json> <out-dir>")

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const profile = yield* decodeProfile(JSON.parse(readFileSync(input, "utf8")))
  const files: Array<string> = []
  for (const [i, view] of TECHNIQUE_VIEWS.entries()) {
    const letter = String.fromCharCode(65 + i)
    for (const [kind, render] of [
      ["report", renderHtml],
      ["share", renderShareHtml],
    ] as const) {
      const name = `${letter}-${view}-${kind}.html`
      yield* writePrivateFile(
        fs,
        path,
        path.join(outDir, name),
        render(profile, { look: "classic", cardHide: [], techniques: view }),
      )
      files.push(name)
    }
  }
  console.log(files.join("\n"))
})

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
