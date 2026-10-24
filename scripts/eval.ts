/**
 * Prompt-quality evaluation (`pnpm eval --engine claude|codex [--persona name]`).
 * Runs the full analysis with a real LLM on hand-written personas in test/eval/personas/ and
 * writes eval-output/<engine>/<persona>/profile.json for side-by-side reading.
 * Not part of CI: it spends the user's subscription quota.
 */
import { NodeServices } from "@effect/platform-node"
import { DateTime, Effect, FileSystem, Layer, Path } from "effect"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { memoryCacheLayer } from "../src/analysis/cache.ts"
import { analyze } from "../src/analysis/index.ts"
import { silentProgressLayer } from "../src/analysis/progress.ts"
import { encodeProfile } from "../src/domain/Profile.ts"
import { makeRunner } from "../src/llm/detect.ts"
import { LlmRunner } from "../src/llm/LlmRunner.ts"
import { withRetry } from "../src/llm/retry.ts"
import { writePrivateFile } from "../src/platform/files.ts"
import { toRecords, type Persona } from "./eval-personas.ts"
import { scoreProfile, type QualityRubric } from "./eval-quality.ts"
import { processRecords } from "../src/pipeline/index.ts"

const { values } = parseArgs({
  options: {
    engine: { type: "string", default: "claude" },
    persona: { type: "string" },
    model: { type: "string" },
  },
})
if (values.engine !== "claude" && values.engine !== "codex")
  throw new Error("--engine must be claude or codex")
const engine = values.engine === "codex" ? "codex" : "claude-code"
const root = new URL("../test/eval/personas/", import.meta.url).pathname
const personas = readdirSync(root).filter(
  (p) => values.persona === undefined || p === values.persona,
)

if (personas.length === 0) throw new Error("No matching persona")

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const write = (file: string, data: unknown) =>
    writePrivateFile(fs, path, file, `${JSON.stringify(data, null, 2)}\n`)
  const runner = withRetry(yield* makeRunner(engine, { model: values.model }))
  const rows: Array<Record<string, unknown>> = []
  for (const name of personas) {
    const persona = JSON.parse(readFileSync(join(root, name, "prompts.json"), "utf8")) as Persona
    const { prompts, stats } = processRecords(toRecords(name, persona), {
      since: null,
      now: DateTime.makeUnsafe("2026-10-24T00:00:00Z"),
      timezone: persona.timezone,
      username: null,
    })
    const started = Date.now()
    const result = yield* analyze({
      prompts,
      stats,
      options: {
        timezone: persona.timezone,
        full: true,
        noCache: true,
        model: values.model ?? null,
      },
    }).pipe(
      Effect.provide(
        Layer.mergeAll(Layer.succeed(LlmRunner, runner), memoryCacheLayer(), silentProgressLayer),
      ),
      Effect.result,
    )
    const out = join("eval-output", engine, name)
    if (result._tag === "Failure") {
      rows.push({ persona: name, ok: false, error: result.failure._tag })
      continue
    }
    const profile = result.success
    yield* write(join(out, "profile.json"), encodeProfile(profile))
    const rubric = JSON.parse(
      readFileSync(join(root, name, "rubric.json"), "utf8"),
    ) as QualityRubric
    const score = scoreProfile(profile, rubric)
    yield* write(join(out, "quality.json"), score)
    rows.push({
      persona: name,
      ok: score.passed,
      failures: score.failures,
      model: profile.engine.model,
      analysisVersion: profile.engine.analysisVersion,
      traits: profile.traits.length,
      evidenceRetention: `${Math.round(score.evidenceRetention * 100)}%`,
      emptyDimensions: score.emptyDimensions,
      universalClaims: score.overgeneralisations,
      archetype: profile.archetype.name,
      seconds: Math.round((Date.now() - started) / 1000),
    })
  }
  console.table(rows)
  yield* write(join("eval-output", engine, "summary.json"), rows)
  if (rows.some((row) => row.ok !== true))
    return yield* Effect.fail(new Error("Persona quality gate failed; see eval-output"))
})

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
