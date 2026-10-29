/**
 * Render the cases and write the comparison: used after a run and by `--from`, which rebuilds
 * from saved artifacts with zero LLM calls (no runner is reachable from here).
 */
import { Effect, FileSystem, Path } from "effect"
import { writePrivateFile } from "../../src/platform/files.ts"
import type { CjkFonts } from "../../src/report/index.ts"
import type { LookId } from "../../src/report/looks.ts"
import { outcomeOf, writeJson, type Manifest } from "./execute.ts"
import { loadProfiles, renderCases } from "./render.ts"
import { buildIndex, buildReview } from "./site.ts"

export const publish = (
  root: string,
  manifest: Manifest,
  options: {
    readonly cjkFonts: CjkFonts
    /** Render-only override (`--from --looks`); default: the experiment's own looks. */
    readonly looks?: ReadonlyArray<LookId>
    readonly now?: () => Date
  },
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const profiles = yield* loadProfiles(root, manifest)
    const looks = options.looks ?? manifest.config.looks
    const renders = yield* renderCases(
      root,
      manifest,
      profiles,
      looks,
      options.cjkFonts,
      options.now,
    )
    // The recorded config stays as run; renders say which looks were drawn, and when.
    // A report or card that could not be drawn makes the experiment's outcome non-passing.
    const { outcome, exitCode } = outcomeOf(manifest.cases, renders)
    const updated: Manifest = { ...manifest, renders, outcome, exitCode }
    yield* writeJson(path.join(root, "manifest.json"), updated)
    yield* writePrivateFile(fs, path, path.join(root, "index.html"), buildIndex(updated, profiles))
    // Never overwrite a review someone may have started filling in.
    const review = path.join(root, "review.md")
    if (!(yield* fs.exists(review))) yield* writePrivateFile(fs, path, review, buildReview(updated))
    return { manifest: updated, profiles }
  })
