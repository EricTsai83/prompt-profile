/** Prepare a private evidence packet for conversational review; never launches a model. */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, FileSystem, Path, Schema } from "effect"
import { parseArgs } from "node:util"
import { SafePrompt } from "../src/domain/SafePrompt.ts"
import { sha256 } from "../src/analysis/hash.ts"
import { writePrivateFile } from "../src/platform/files.ts"
import { loadProfiles, readManifest } from "./experiment/render.ts"
import { buildReviewPacket } from "./experiment/review.ts"

const program = Effect.gen(function* () {
  const { values } = yield* Effect.try(() =>
    parseArgs({ options: { from: { type: "string" } }, strict: true, allowPositionals: false }),
  )
  if (!values.from)
    return yield* Effect.fail(new Error("Usage: pnpm eval:review --from <experiment-directory>"))
  const root = values.from,
    fs = yield* FileSystem.FileSystem,
    path = yield* Path.Path
  const manifest = yield* readManifest(root)
  const profiles = yield* loadProfiles(root, manifest)
  let sources: ReadonlyMap<string, string> | null = null
  const snapshotPath = path.join(root, "input-snapshot.json")
  if (yield* fs.exists(snapshotPath)) {
    const raw = yield* fs.readFileString(snapshotPath)
    const snapshot = yield* Effect.try(
      () => JSON.parse(raw) as { prepared?: { prompts?: unknown; preparedSha256?: unknown } },
    )
    const prompts = yield* Schema.decodeUnknownEffect(Schema.Array(SafePrompt))(
      snapshot.prepared?.prompts,
    )
    const hash = sha256(JSON.stringify(prompts.map((p) => [p.id, p.text])))
    if (
      hash !== snapshot.prepared?.preparedSha256 ||
      manifest.cases.some((c) => c.input.preparedSha256 !== hash)
    )
      return yield* Effect.fail(new Error("Frozen input hash does not match the experiment"))
    sources = new Map(prompts.map((p) => [p.id, p.text]))
  }
  const packet = buildReviewPacket(manifest, profiles, sources)
  const file = path.join(root, "review-packet.json")
  yield* writePrivateFile(fs, path, file, JSON.stringify(packet, null, 2))
  console.log(`Review packet: ${file}`)
  console.log(
    `Mechanical problems: ${packet.mechanical.problems.length}; source verification: ${packet.mechanical.sourceVerification}`,
  )
  console.log(
    `Semantic review: ${packet.semanticStatus}; ${packet.items.length} items. No model calls made.`,
  )
  console.log(
    "Ask your coding agent to guide this experiment review using docs/experiments.md and review-packet.json. Existing review.md is preserved.",
  )
})
program.pipe(
  Effect.catch(() =>
    Effect.sync(() => {
      console.error(
        "Review preparation failed. Check the directory, saved versions and frozen input integrity.",
      )
      process.exitCode = 1
    }),
  ),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
)
