/**
 * Profile experiment comparison (plan 22), documented in docs/experiments.md:
 *
 *   pnpm eval:compare --config experiments/starter.json --dry-run
 *   pnpm eval:compare --config experiments/starter.json --budget 40 [--out eval-output/comparisons]
 *   pnpm eval:compare --from eval-output/comparisons/<experiment-id> [--looks classic,prism]
 *
 * The old form `--engines claude,codex --repeats 2` still works: it runs every persona with
 * each CLI's default model. Real runs spend subscription quota; `--dry-run` and `--from` never
 * call an LLM. Each run writes a new private folder and never overwrites an earlier one.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Exit, Path } from "effect"
import { defaultTeardown } from "effect/Runtime"
import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { sha256 } from "../src/analysis/hash.ts"
import { ANALYSIS_VERSION } from "../src/analysis/version.ts"
import { PROFILE_SCHEMA_VERSION } from "../src/domain/Profile.ts"
import { detectRunner, makeRunner } from "../src/llm/detect.ts"
import { resolveCacheDir } from "../src/platform/paths.ts"
import { PIPELINE_VERSION } from "../src/pipeline/version.ts"
import { loadCjkFonts } from "../src/report/fonts.ts"
import { LOOK_IDS, RENDER_MANIFEST_VERSION, type LookId } from "../src/report/looks.ts"
import { lookOf } from "../src/report/theme.ts"
import { legacyConfig, parseBudget, parseConfig, UsageError } from "./experiment/config.ts"
import {
  createExperimentDir,
  EXIT_INVALID_CONFIG,
  experimentId,
  runExperiment,
  type Manifest,
  type Provenance,
} from "./experiment/execute.ts"
import { dryRunLines, preparePersona } from "./experiment/prepare.ts"
import { publish } from "./experiment/publish.ts"
import { readManifest } from "./experiment/render.ts"

const PERSONA_ROOT = new URL("../test/eval/personas/", import.meta.url).pathname
const DEFAULT_OUT = join("eval-output", "comparisons")

const git = (args: ReadonlyArray<string>): string | null => {
  try {
    return execFileSync("git", [...args], { encoding: "utf8", timeout: 10_000 }).trim()
  } catch {
    return null
  }
}

const provenance = (): Provenance => {
  const status = git(["status", "--porcelain"])
  return {
    git: { revision: git(["rev-parse", "HEAD"]), dirty: status === null ? null : status !== "" },
    packageVersion: (
      JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
        version: string
      }
    ).version,
    node: process.version,
    versions: {
      pipeline: PIPELINE_VERSION,
      analysis: ANALYSIS_VERSION,
      profileSchema: PROFILE_SCHEMA_VERSION,
      renderManifest: RENDER_MANIFEST_VERSION,
      looks: Object.fromEntries(LOOK_IDS.map((l) => [l, lookOf(l).version])),
    },
  }
}

const parseLooks = (text: string): ReadonlyArray<LookId> => {
  const looks = text.split(",").map((l) => l.trim())
  for (const l of looks)
    if (!LOOK_IDS.includes(l as LookId))
      throw new UsageError(`Unknown look "${l}"; available: ${LOOK_IDS.join(", ")}`)
  return looks as ReadonlyArray<LookId>
}

const printRenderProblems = (m: Manifest) => {
  for (const r of m.renders) {
    if (r.error !== null) console.log(`Not rendered: ${r.case} (${r.look}): ${r.error}`)
    for (const c of r.cards)
      if (c.error !== null) console.log(`No ${c.language} card: ${r.case} (${r.look}): ${c.error}`)
  }
}

const program = Effect.gen(function* () {
  const path = yield* Path.Path
  const { values } = yield* Effect.try({
    try: () =>
      parseArgs({
        options: {
          config: { type: "string" },
          "dry-run": { type: "boolean", default: false },
          budget: { type: "string", default: "60" },
          out: { type: "string", default: DEFAULT_OUT },
          from: { type: "string" },
          looks: { type: "string" },
          engines: { type: "string" },
          repeats: { type: "string" },
        },
        strict: true,
        allowPositionals: false,
      }),
    catch: (e) => new UsageError((e as Error).message),
  })
  const cjkFonts = loadCjkFonts(resolveCacheDir(process.env, homedir(), path))

  // ---- rebuild from saved artifacts: zero LLM calls ----------------------------------
  if (values.from !== undefined) {
    if (values.config !== undefined || values.engines !== undefined || values["dry-run"])
      throw new UsageError("--from cannot be combined with --config, --engines or --dry-run")
    const root = values.from
    const looks = values.looks === undefined ? undefined : parseLooks(values.looks)
    const manifest = yield* readManifest(root)
    const { manifest: updated } = yield* publish(root, manifest, {
      cjkFonts,
      ...(looks ? { looks } : {}),
    })
    printRenderProblems(updated)
    console.log(`Rebuilt without any LLM call: ${path.join(root, "index.html")}`)
    return updated.renders.some((r) => r.error !== null || r.cards.some((c) => c.error !== null))
      ? 1
      : 0
  }

  // ---- configuration ------------------------------------------------------------------
  if (values.looks !== undefined) throw new UsageError("--looks is only used with --from")
  const personas = readdirSync(PERSONA_ROOT).toSorted()
  let raw: unknown
  if (values.config !== undefined) {
    if (values.engines !== undefined || values.repeats !== undefined)
      throw new UsageError("--config cannot be combined with --engines or --repeats")
    const text = readFileSync(values.config, "utf8")
    try {
      raw = JSON.parse(text)
    } catch {
      throw new UsageError(`${values.config} is not valid JSON`)
    }
  } else {
    const repeats = Number(values.repeats ?? "2")
    raw = legacyConfig((values.engines ?? "claude,codex").split(","), repeats, personas)
  }
  const budget = parseBudget(values.budget)
  const parsed = parseConfig(raw, personas)
  if (!parsed.ok) {
    console.error("Invalid experiment configuration:")
    for (const e of parsed.errors) console.error(`  - ${e}`)
    return EXIT_INVALID_CONFIG
  }
  const { config } = parsed
  const prepared = new Map(
    config.personas.map((name) => [
      name,
      preparePersona(
        name,
        {
          raw: readFileSync(join(PERSONA_ROOT, name, "prompts.json"), "utf8"),
          rubric: JSON.parse(readFileSync(join(PERSONA_ROOT, name, "rubric.json"), "utf8")),
        },
        config.timezone,
      ),
    ]),
  )
  if (values["dry-run"]) {
    for (const line of dryRunLines(config, prepared, budget)) console.log(line)
    return 0
  }

  // ---- run ----------------------------------------------------------------------------
  const id = experimentId(new Date(), randomBytes(2).toString("hex"))
  const root = yield* createExperimentDir(values.out, id)
  console.log(`Experiment ${id}: ${root}`)
  const manifest = yield* runExperiment(
    {
      id,
      root,
      config,
      configSha256: sha256(JSON.stringify(raw)),
      prepared,
      budget,
      provenance: provenance(),
    },
    {
      makeRunner: (engine, model) => makeRunner(engine, { model: model ?? undefined }),
      detect: detectRunner,
    },
  )
  const { manifest: published } = yield* publish(root, manifest, { cjkFonts })
  printRenderProblems(published)
  console.table(
    manifest.cases.map((c) => ({
      case: c.id,
      status: c.status + (c.error ? ` (${c.error})` : ""),
      seconds: c.durationMs === null ? null : Math.round(c.durationMs / 1000),
      attempts: c.calls.attempts,
      failedAttempts: c.calls.failedAttempts,
      rubric: c.quality === null ? null : c.quality.passed ? "passed" : "failed",
    })),
  )
  console.log(`CLI attempts used: ${manifest.budget.used} of ${manifest.budget.cap}`)
  console.log(`Outcome: ${published.outcome}. Open ${path.join(root, "index.html")}`)
  return published.exitCode ?? 1
})

program.pipe(
  Effect.catchDefect((e) =>
    e instanceof UsageError
      ? Effect.sync(() => {
          console.error(e.message)
          return EXIT_INVALID_CONFIG
        })
      : Effect.die(e),
  ),
  Effect.catch((e) =>
    Effect.sync(() => {
      if (e instanceof UsageError) {
        console.error(e.message)
        return EXIT_INVALID_CONFIG
      }
      console.error(e instanceof Error ? e.message : String(e))
      return 1
    }),
  ),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain({
    teardown: (exit, onExit) =>
      Exit.isSuccess(exit) ? onExit(exit.value as number) : defaultTeardown(exit, onExit),
  }),
)
