/**
 * Prompt-quality evaluation (`pnpm eval --engine claude|codex [--lang zh-TW|en] [--persona name]`).
 * Runs the full analysis with a real LLM on hand-written personas in test/eval/personas/ and
 * writes eval-output/<engine>/<persona>/profile.json for side-by-side reading.
 * Not part of CI: it spends the user's subscription quota.
 */
import { NodeServices } from "@effect/platform-node"
import { DateTime, Effect, Layer, Schema } from "effect"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { memoryCacheLayer } from "../src/analysis/cache.ts"
import { analyze } from "../src/analysis/index.ts"
import { silentProgressLayer } from "../src/analysis/progress.ts"
import { Profile } from "../src/domain/Profile.ts"
import type { PromptRecord } from "../src/domain/PromptRecord.ts"
import { makeRunner } from "../src/llm/detect.ts"
import { LlmRunner } from "../src/llm/LlmRunner.ts"
import { withRetry } from "../src/llm/retry.ts"
import { processRecords } from "../src/pipeline/index.ts"

interface Persona {
  readonly timezone: string
  readonly sessions: ReadonlyArray<{
    start: string
    project: string
    prompts: ReadonlyArray<string>
  }>
}

const { values } = parseArgs({
  options: {
    engine: { type: "string", default: "claude" },
    lang: { type: "string", default: "zh-TW" },
    persona: { type: "string" },
  },
})
const engine = values.engine === "codex" ? "codex" : "claude-code"
const language = values.lang === "en" ? "en" : "zh-TW"
const root = new URL("../test/eval/personas/", import.meta.url).pathname
const personas = readdirSync(root).filter(
  (p) => values.persona === undefined || p === values.persona,
)

const toRecords = (name: string, persona: Persona): Array<PromptRecord> =>
  persona.sessions.flatMap((s, si) =>
    s.prompts.map((text, pi) => ({
      id: `claude-code:${name}-${si}:${pi}`,
      source: "claude-code" as const,
      sessionId: `${name}-${si}`,
      timestamp: DateTime.makeUnsafe(Date.parse(s.start) + pi * 4 * 60_000),
      project: s.project,
      gitBranch: null,
      text,
      hasImage: false,
      origin: "interactive" as const,
      client: "eval",
    })),
  )

const program = Effect.gen(function* () {
  const runner = withRetry(yield* makeRunner(engine, {}))
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
      options: { language, timezone: persona.timezone, full: true, noCache: true, model: null },
    }).pipe(
      Effect.provide(
        Layer.mergeAll(Layer.succeed(LlmRunner, runner), memoryCacheLayer(), silentProgressLayer),
      ),
      Effect.result,
    )
    const out = join("eval-output", engine, name)
    mkdirSync(out, { recursive: true })
    if (result._tag === "Failure") {
      rows.push({ persona: name, ok: false, error: result.failure._tag })
      continue
    }
    const profile = result.success
    writeFileSync(
      join(out, "profile.json"),
      JSON.stringify(Schema.encodeSync(Profile)(profile), null, 2),
    )
    const { evidenceKept, evidenceDropped } = profile.coverage
    rows.push({
      persona: name,
      ok: Schema.is(Profile)(profile),
      traits: profile.traits.length,
      evidenceRetention: `${Math.round((evidenceKept / Math.max(1, evidenceKept + evidenceDropped)) * 100)}%`,
      emptyDimensions: profile.dimensions.filter((d) => d.evidence.length === 0).length,
      archetype: profile.archetype.name,
      seconds: Math.round((Date.now() - started) / 1000),
    })
  }
  console.table(rows)
  writeFileSync(join("eval-output", engine, "summary.json"), JSON.stringify(rows, null, 2))
})

Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
