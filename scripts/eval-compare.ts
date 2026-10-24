/**
 * Controlled model comparison (plan 11, stage 3):
 * `pnpm eval:compare [--engines claude,codex] [--repeats 2] [--budget 60] [--out dir]`.
 * Runs the full analysis on every persona in test/eval/personas/, once per engine per repeat,
 * and writes docs/ux/model-comparison/runs/<engine>/<persona>/r<n>/ with profile.json and
 * run.json (provenance). Every CLI attempt, including retries, counts against one shared
 * budget; runs that do not fit are recorded as "not run". Spends subscription quota.
 */
import { NodeServices } from "@effect/platform-node"
import { DateTime, Effect, FileSystem, Layer, Path } from "effect"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { memoryCacheLayer } from "../src/analysis/cache.ts"
import { sha256 } from "../src/analysis/hash.ts"
import { analyze } from "../src/analysis/index.ts"
import { selectChunks } from "../src/analysis/plan.ts"
import { silentProgressLayer } from "../src/analysis/progress.ts"
import { ANALYSIS_VERSION } from "../src/analysis/version.ts"
import { encodeProfile } from "../src/domain/Profile.ts"
import { makeRunner } from "../src/llm/detect.ts"
import { CallBudgetExceeded, LlmRunner, type LlmRunnerShape } from "../src/llm/LlmRunner.ts"
import { withRetry } from "../src/llm/retry.ts"
import { writePrivateFile } from "../src/platform/files.ts"
import { processRecords } from "../src/pipeline/index.ts"
import { PIPELINE_VERSION } from "../src/pipeline/version.ts"
import { scoreProfile, type QualityRubric } from "./eval-quality.ts"
import { toRecords, type Persona } from "./eval-personas.ts"

const { values } = parseArgs({
  options: {
    engines: { type: "string", default: "claude,codex" },
    repeats: { type: "string", default: "2" },
    budget: { type: "string", default: "60" },
    out: { type: "string", default: join("docs", "ux", "model-comparison", "runs") },
  },
})
const ENGINES = { claude: "claude-code", codex: "codex" } as const
const engines = values.engines.split(",").map((e) => {
  if (e !== "claude" && e !== "codex") throw new Error(`Unknown engine: ${e}`)
  return { name: e as keyof typeof ENGINES, id: ENGINES[e] }
})
const repeats = Number(values.repeats)
const budget = Number(values.budget)
if (!Number.isSafeInteger(repeats) || repeats < 1) throw new Error("--repeats must be >= 1")
if (!Number.isSafeInteger(budget) || budget < 1) throw new Error("--budget must be >= 1")

const root = new URL("../test/eval/personas/", import.meta.url).pathname
const outRoot = values.out
const now = DateTime.makeUnsafe("2026-10-24T00:00:00Z")

const cliVersion = (bin: string) => {
  try {
    return execFileSync(bin, ["--version"], { encoding: "utf8", timeout: 20_000 }).trim()
  } catch {
    return "unknown"
  }
}

interface Attempt {
  readonly ok: boolean
  readonly error: string | null
  readonly model: string | null
  readonly durationMs: number
}

/** Counts every attempt against a budget shared by all runs, and records each one. */
const recording = (runner: LlmRunnerShape, shared: { used: number }, log: Array<Attempt>) => ({
  ...runner,
  generate: ((input) =>
    Effect.suspend(() => {
      if (shared.used >= budget)
        return Effect.fail(new CallBudgetExceeded({ runner: runner.id, limit: budget }))
      shared.used++
      const started = Date.now()
      return runner.generate(input).pipe(
        Effect.tap((r) =>
          Effect.sync(() =>
            log.push({ ok: true, error: null, model: r.model, durationMs: r.durationMs }),
          ),
        ),
        Effect.tapError((e) =>
          Effect.sync(() =>
            log.push({ ok: false, error: e._tag, model: null, durationMs: Date.now() - started }),
          ),
        ),
      )
    })) as LlmRunnerShape["generate"],
})

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const write = (file: string, data: unknown) =>
    writePrivateFile(fs, path, file, `${JSON.stringify(data, null, 2)}\n`)
  const shared = { used: 0 }
  const versions = { claude: cliVersion("claude"), codex: cliVersion("codex") }
  const personas = readdirSync(root).toSorted()
  const rows: Array<Record<string, unknown>> = []

  // Persona, then repeat, then engine: both engines run close together on the same input.
  for (const name of personas) {
    const raw = readFileSync(join(root, name, "prompts.json"), "utf8")
    const persona = JSON.parse(raw) as Persona
    const rubric = JSON.parse(
      readFileSync(join(root, name, "rubric.json"), "utf8"),
    ) as QualityRubric
    const { prompts, stats } = processRecords(toRecords(name, persona), {
      since: null,
      now,
      timezone: persona.timezone,
      username: null,
    })
    const options = { timezone: persona.timezone, full: true, noCache: true, model: null }
    const { chunks } = selectChunks(prompts, options)
    const selectedPromptIds = chunks.flatMap((c) => c.prompts.map((p) => p.id))
    const input = {
      personaSha256: sha256(raw),
      chunkIds: chunks.map((c) => c.id),
      selectedPromptIds,
      sampling: "full: every weekly chunk, no sampling; cache disabled",
    }
    for (let repeat = 1; repeat <= repeats; repeat++) {
      for (const engine of engines) {
        const dir = join(outRoot, engine.name, name, `r${repeat}`)
        const base = {
          persona: name,
          engine: engine.id,
          repeat,
          requestedModel: null,
          cliVersion: versions[engine.name],
          analysisVersion: ANALYSIS_VERSION,
          pipelineVersion: PIPELINE_VERSION,
          input,
        }
        // A run needs at least one call per chunk plus the reduce; do not start one that cannot finish.
        if (budget - shared.used < chunks.length + 1) {
          yield* write(join(dir, "run.json"), { ...base, status: "not run", reason: "budget" })
          rows.push({ persona: name, engine: engine.name, repeat, status: "not run (budget)" })
          continue
        }
        const attempts: Array<Attempt> = []
        const runner = withRetry(
          recording(yield* makeRunner(engine.id, { model: undefined }), shared, attempts),
        )
        const started = Date.now()
        const result = yield* analyze({ prompts, stats, options }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Layer.succeed(LlmRunner, runner),
              memoryCacheLayer(),
              silentProgressLayer,
            ),
          ),
          Effect.result,
        )
        const seconds = Math.round((Date.now() - started) / 1000)
        const calls = {
          attempts: attempts.length,
          failedAttempts: attempts.filter((a) => !a.ok).length,
          errors: attempts.flatMap((a) => (a.error ? [a.error] : [])),
          reportedModels: [...new Set(attempts.flatMap((a) => (a.ok ? [a.model] : [])))],
        }
        if (result._tag === "Failure") {
          yield* write(join(dir, "run.json"), {
            ...base,
            status: "failed",
            error: result.failure._tag,
            calls,
            seconds,
          })
          rows.push({ persona: name, engine: engine.name, repeat, status: "failed", seconds })
          continue
        }
        const profile = result.success
        const score = scoreProfile(profile, rubric)
        yield* write(join(dir, "profile.json"), encodeProfile(profile))
        yield* write(join(dir, "run.json"), {
          ...base,
          status: "ok",
          // Codex does not report its model; null means unknown, not a guessed name.
          reportedModel: profile.engine.model,
          calls,
          coverage: profile.coverage,
          quality: score,
          seconds,
        })
        rows.push({
          persona: name,
          engine: engine.name,
          repeat,
          status: score.passed ? "ok" : "rubric failed",
          calls: calls.attempts,
          retries: calls.failedAttempts,
          traits: profile.traits.length,
          emptyDimensions: score.emptyDimensions,
          universalClaims: score.overgeneralisations,
          improvements: profile.improvements.length,
          archetype: profile.archetype.name,
          seconds,
        })
      }
    }
  }
  console.table(rows)
  console.log(`CLI attempts used: ${shared.used} of ${budget}`)
  yield* write(join(outRoot, "summary.json"), { budget, used: shared.used, versions, rows })
})

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
