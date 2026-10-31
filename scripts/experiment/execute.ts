import { completeAmount as sum } from "../../src/domain/Execution.ts"
/**
 * Run the experiment matrix safely and keep provenance (plan 22 §3). Cases run one after
 * another; every CLI attempt, including retries and translations, counts against one cap.
 * The manifest is rewritten after every case, so completed results survive a later failure.
 */
import { Effect, FileSystem, Layer, Path } from "effect"
import { memoryCacheLayer } from "../../src/analysis/cache.ts"
import { analyze } from "../../src/analysis/index.ts"
import { silentProgressLayer } from "../../src/analysis/progress.ts"
import { encodeProfile } from "../../src/domain/Profile.ts"
import type { RunnerStatus } from "../../src/llm/detect.ts"
import {
  CallBudgetExceeded,
  LlmRunner,
  type LlmRunnerShape,
  type RunnerId,
} from "../../src/llm/LlmRunner.ts"
import { withRetry } from "../../src/llm/retry.ts"
import { writePrivateFile } from "../../src/platform/files.ts"
import { scoreProfile } from "../eval-quality.ts"
import type { AnalysisFactors, ExperimentConfig } from "./config.ts"
import {
  analyzeOptions,
  caseDir,
  expandCases,
  selection,
  type Case,
  type PreparedPersona,
} from "./prepare.ts"

export const MANIFEST_VERSION = 1

export type CaseStatus =
  | "ok"
  | "failed"
  | "unavailable"
  | "interrupted"
  | "budget-skipped"
  | "budget-exhausted"

export interface Usage {
  /** `null` when any successful attempt did not report it: unknown, never a guess. */
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly costUsd: number | null
}

export interface Quality {
  readonly passed: boolean
  readonly failures: ReadonlyArray<string>
  readonly evidenceRetention: number
  readonly emptyDimensions: number
  readonly overgeneralisations: number
}

export interface CaseResult {
  readonly id: string
  readonly order: number
  readonly persona: string
  readonly variant: string
  readonly repeat: number
  readonly dir: string
  readonly status: CaseStatus
  /** Error category only (a tag or a reason); never CLI output or prompt text. */
  readonly error: string | null
  readonly effectiveOptions: AnalysisFactors & { readonly timezone: string }
  readonly changedFactors: ReadonlyArray<string>
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly durationMs: number | null
  readonly input: {
    readonly inputSha256: string
    readonly preparedSha256: string
    readonly chunkIds: ReadonlyArray<string>
    readonly selectedPromptIds: ReadonlyArray<string>
    readonly chunksTotal: number
    readonly sampled: boolean
  }
  readonly calls: {
    readonly attempts: number
    readonly failedAttempts: number
    readonly errorCategories: Readonly<Record<string, number>>
  }
  readonly usage: Usage
  readonly model: {
    /** `null`: the CLI default. */
    readonly requested: string | null
    /** Names the CLI itself reported. */
    readonly reported: ReadonlyArray<string>
    /** Names only echoed back from the request (Codex never reports one): not verified. */
    readonly echoed: ReadonlyArray<string>
  }
  readonly quality: Quality | null
}

export type Outcome =
  | "passed"
  | "unavailable"
  | "failed"
  | "interrupted"
  | "incomplete"
  | "render-failed"
  | "quality-failed"

/** Exit codes, documented in docs/experiments.md. 2 is invalid configuration (before running). */
export const EXIT_CODES: Readonly<Record<Outcome, number>> = {
  passed: 0,
  unavailable: 3,
  failed: 4,
  interrupted: 4,
  incomplete: 5,
  "quality-failed": 6,
  "render-failed": 7,
}
export const EXIT_INVALID_CONFIG = 2

/**
 * The most serious problem decides; a passing run needs every case ok with its quality gate,
 * and (once rendered) every report and card drawn.
 */
export const outcomeOf = (
  cases: ReadonlyArray<Pick<CaseResult, "status" | "quality">>,
  renders: ReadonlyArray<{
    readonly error: string | null
    readonly cards?: ReadonlyArray<{ readonly error: string | null }>
  }> = [],
) => {
  const has = (...s: Array<CaseStatus>) => cases.some((c) => s.includes(c.status))
  const outcome: Outcome = has("unavailable")
    ? "unavailable"
    : has("failed")
      ? "failed"
      : has("interrupted")
        ? "interrupted"
        : has("budget-skipped", "budget-exhausted")
          ? "incomplete"
          : renders.some((r) => r.error !== null || (r.cards ?? []).some((c) => c.error !== null))
            ? "render-failed"
            : cases.some((c) => c.quality?.passed === false)
              ? "quality-failed"
              : "passed"
  return { outcome, exitCode: EXIT_CODES[outcome] }
}

export interface RenderRecord {
  readonly case: string
  readonly look: string
  readonly lookVersion: number
  readonly renderManifestVersion: number
  readonly renderedAt: string
  /** Relative to the experiment folder. */
  readonly html: string | null
  readonly cards: ReadonlyArray<{ language: string; file: string | null; error: string | null }>
  readonly error: string | null
}

export interface Manifest {
  readonly manifestVersion: typeof MANIFEST_VERSION
  readonly experimentId: string
  readonly createdAt: string
  readonly finishedAt: string | null
  readonly outcome: Outcome | "running"
  readonly exitCode: number | null
  readonly config: ExperimentConfig
  readonly configSha256: string
  readonly budget: { readonly cap: number; readonly used: number }
  readonly provenance: Provenance
  readonly runners: ReadonlyArray<RunnerStatus>
  readonly personas: Readonly<
    Record<
      string,
      { inputSha256: string; preparedSha256: string; timezone: string; prompts: number }
    >
  >
  readonly cases: ReadonlyArray<CaseResult>
  readonly renders: ReadonlyArray<RenderRecord>
}

/** Collected by the entry point; fixed values in tests. */
export interface Provenance {
  readonly git: { readonly revision: string | null; readonly dirty: boolean | null }
  readonly packageVersion: string
  readonly node: string
  readonly versions: {
    readonly pipeline: string
    readonly analysis: string
    readonly profileSchema: number
    readonly renderManifest: number
    readonly looks: Readonly<Record<string, number>>
  }
}

export interface ExecuteDeps<R> {
  readonly makeRunner: (
    engine: RunnerId,
    model: string | null,
  ) => Effect.Effect<LlmRunnerShape, never, R>
  readonly detect: (engine: RunnerId) => Effect.Effect<RunnerStatus, never, R>
  /** Default `withRetry`: retries count against the cap like any other attempt. */
  readonly retry?: (runner: LlmRunnerShape) => LlmRunnerShape
  readonly now?: () => Date
}

export interface ExperimentInput {
  readonly id: string
  /** The experiment folder; must already exist (see createExperimentDir). */
  readonly root: string
  readonly config: ExperimentConfig
  readonly configSha256: string
  readonly prepared: ReadonlyMap<string, PreparedPersona>
  readonly budget: number
  readonly provenance: Provenance
}

export const writeJson = (file: string, data: unknown) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    yield* writePrivateFile(fs, path, file, `${JSON.stringify(data, null, 2)}\n`)
  })

/**
 * Make a new experiment folder `<out>/<id>`. The parent is created 0700 if missing (an
 * existing one keeps its permissions); the folder itself must not exist, so a previous run is
 * never overwritten.
 */
export const createExperimentDir = (out: string, id: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    yield* fs.makeDirectory(out, { recursive: true, mode: 0o700 })
    const root = path.join(out, id)
    yield* fs.makeDirectory(root, { recursive: false, mode: 0o700 })
    return root
  })

/** `20261029-133501-a1b2`: sortable, and unique enough with the existence check above. */
export const experimentId = (now: Date, random: string) =>
  `${now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-")}-${random}`

const usable = (s: RunnerStatus) => s.installed && s.loggedIn !== false

interface Attempt {
  readonly ok: boolean
  readonly error: string | null
  readonly model: string | null
  readonly modelSource: string | null | undefined
  readonly usage: Usage | null
}

/** An admitted attempt that has not finished; it stays so if its fiber is interrupted. */
const IN_FLIGHT: Attempt = {
  ok: false,
  error: "Interrupted",
  model: null,
  modelSource: null,
  usage: null,
}

export const runExperiment = <R>(input: ExperimentInput, deps: ExecuteDeps<R>) =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    const now = deps.now ?? (() => new Date())
    const retry = deps.retry ?? ((r: LlmRunnerShape) => withRetry(r))
    const { config, budget, root } = input
    const cases = expandCases(config)
    const shared = { used: 0, stopped: null as "budget" | "interrupted" | null }
    const results: Array<CaseResult> = []

    const engines = [...new Set(config.variants.map((v) => v.options.engine))]
    const runners = yield* Effect.forEach(engines, (e) => deps.detect(e))

    const manifest = (finished: boolean, interrupted = false): Manifest => {
      const { outcome, exitCode } = interrupted
        ? { outcome: "interrupted" as const, exitCode: EXIT_CODES.interrupted }
        : outcomeOf(results)
      return {
        manifestVersion: MANIFEST_VERSION,
        experimentId: input.id,
        createdAt,
        finishedAt: finished ? now().toISOString() : null,
        outcome: finished ? outcome : "running",
        exitCode: finished ? exitCode : null,
        config,
        configSha256: input.configSha256,
        budget: { cap: budget, used: shared.used },
        provenance: input.provenance,
        runners,
        personas: Object.fromEntries(
          [...input.prepared.values()].map((p) => [
            p.name,
            {
              inputSha256: p.inputSha256,
              preparedSha256: p.preparedSha256,
              timezone: p.timezone,
              prompts: p.prompts.length,
            },
          ]),
        ),
        cases: results,
        renders: [],
      }
    }
    const createdAt = now().toISOString()
    const saveManifest = (finished: boolean, interrupted = false) =>
      writeJson(path.join(root, "manifest.json"), manifest(finished, interrupted))

    /**
     * Counts every attempt against the shared cap and records it (no content). A denial is
     * remembered: the analysis may swallow it (a skipped translation) and still succeed.
     */
    const recording = (
      runner: LlmRunnerShape,
      log: Array<Attempt>,
      state: { denied: boolean },
    ): LlmRunnerShape => ({
      ...runner,
      generate: ((g) =>
        Effect.suspend(() => {
          if (shared.used >= budget) {
            state.denied = true
            return Effect.fail(new CallBudgetExceeded({ runner: runner.id, limit: budget }))
          }
          shared.used++
          // Logged when admitted, so a call cancelled in flight still counts for its case.
          const index = log.push(IN_FLIGHT) - 1
          return runner
            .generate({
              ...g,
              onMeasurement: (m) => {
                const t = m.tokens
                const inputCount =
                  t &&
                  [t.input, t.cacheRead, t.cacheWrite5m, t.cacheWrite1h, t.cacheWriteUnknown].every(
                    (v) => v !== undefined,
                  )
                    ? t.input! +
                      t.cacheRead! +
                      t.cacheWrite5m! +
                      t.cacheWrite1h! +
                      t.cacheWriteUnknown!
                    : null
                log[index] = {
                  ...log[index]!,
                  model: m.model,
                  modelSource: m.modelSource,
                  usage: {
                    inputTokens: inputCount,
                    outputTokens: t?.output ?? null,
                    costUsd: m.costUsd,
                  },
                }
                g.onMeasurement?.(m)
              },
            })
            .pipe(
              Effect.tap((r) =>
                Effect.sync(() => {
                  log[index] = {
                    ok: true,
                    error: null,
                    model: r.model,
                    modelSource: r.modelSource,
                    usage: r.usage,
                  }
                }),
              ),
              Effect.tapError((e) =>
                Effect.sync(() => {
                  log[index] = { ...log[index]!, error: e._tag }
                }),
              ),
            )
        })) as LlmRunnerShape["generate"],
    })

    /** The record of one case; `summary` reads its attempts at the moment it is called. */
    const caseRecord = (c: Case) => {
      const persona = input.prepared.get(c.persona)!
      const sel = selection(persona, c.variant)
      const dir = caseDir(c)
      const attempts: Array<Attempt> = []
      const base = {
        id: c.id,
        order: c.order,
        persona: c.persona,
        variant: c.variant.id,
        repeat: c.repeat,
        dir,
        effectiveOptions: { ...c.variant.options, timezone: persona.timezone },
        changedFactors: c.variant.changedFactors,
        input: {
          inputSha256: persona.inputSha256,
          preparedSha256: persona.preparedSha256,
          chunkIds: sel.chunkIds,
          selectedPromptIds: sel.selectedPromptIds,
          chunksTotal: sel.chunksTotal,
          sampled: sel.sampled,
        },
      }
      const summary = (
        fields: Pick<CaseResult, "status" | "error" | "quality"> & {
          startedAt?: string
          durationMs?: number
        },
      ): CaseResult => {
        const errorCategories: Record<string, number> = {}
        for (const a of attempts)
          if (a.error) errorCategories[a.error] = (errorCategories[a.error] ?? 0) + 1
        const ok = attempts.filter((a) => a.ok)
        const names = (source: string) => [
          ...new Set(
            attempts.flatMap((a) => (a.modelSource === source && a.model ? [a.model] : [])),
          ),
        ]
        return {
          ...base,
          ...fields,
          startedAt: fields.startedAt ?? null,
          finishedAt: fields.startedAt ? now().toISOString() : null,
          durationMs: fields.durationMs ?? null,
          calls: {
            attempts: attempts.length,
            failedAttempts: attempts.length - ok.length,
            errorCategories,
          },
          usage: {
            inputTokens:
              attempts.length === 0 ? null : sum(attempts.map((a) => a.usage?.inputTokens ?? null)),
            outputTokens:
              attempts.length === 0
                ? null
                : sum(attempts.map((a) => a.usage?.outputTokens ?? null)),
            costUsd:
              attempts.length === 0 ? null : sum(attempts.map((a) => a.usage?.costUsd ?? null)),
          },
          model: {
            requested: c.variant.options.model,
            reported: names("reported"),
            echoed: names("requested"),
          },
        }
      }
      return { persona, sel, dir, attempts, summary }
    }

    /** The case currently running, so an interruption can still record it. */
    let active: {
      record: ReturnType<typeof caseRecord>
      startedAt: string
      started: number
    } | null = null

    const runCase = (c: Case) =>
      Effect.gen(function* () {
        const record = caseRecord(c)
        const { persona, sel, dir, attempts, summary } = record
        const status = runners.find((r) => r.id === c.variant.options.engine)!
        if (!usable(status))
          return summary({
            status: "unavailable",
            error: status.installed ? "NotLoggedIn" : "NotInstalled",
            quality: null,
          })
        if (shared.stopped === "interrupted")
          return summary({ status: "interrupted", error: "not started", quality: null })
        // A case needs at least its minimum calls: do not start one that cannot finish.
        if (shared.stopped === "budget" || budget - shared.used < sel.minimumCalls)
          return summary({ status: "budget-skipped", error: null, quality: null })

        const startedAt = now().toISOString()
        const started = now().getTime()
        active = { record, startedAt, started }
        const state = { denied: false }
        const runner = retry(
          recording(
            yield* deps.makeRunner(c.variant.options.engine, c.variant.options.model),
            attempts,
            state,
          ),
        )
        const result = yield* analyze({
          prompts: persona.prompts,
          stats: persona.stats,
          options: analyzeOptions(persona, c.variant),
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Layer.succeed(LlmRunner, runner),
              memoryCacheLayer(),
              silentProgressLayer,
            ),
          ),
          Effect.result,
        )
        const durationMs = now().getTime() - started
        active = null
        // The cap was hit even if the analysis carried on (e.g. without a translation).
        if (state.denied) {
          shared.stopped = "budget"
          return summary({
            status: "budget-exhausted",
            error: "CallBudgetExceeded",
            quality: null,
            startedAt,
            durationMs,
          })
        }
        if (result._tag === "Failure") {
          const e = result.failure
          const cause = e._tag === "AnalysisFailed" ? (e.cause?._tag ?? null) : e._tag
          if (cause === "CallBudgetExceeded") shared.stopped = "budget"
          if (cause === "Interrupted") shared.stopped = "interrupted"
          const category = e._tag === "AnalysisFailed" ? `AnalysisFailed:${e.reason}` : e._tag
          return summary({
            status:
              cause === "CallBudgetExceeded"
                ? "budget-exhausted"
                : cause === "Interrupted"
                  ? "interrupted"
                  : cause === "NotInstalled" || cause === "NotLoggedIn"
                    ? "unavailable"
                    : "failed",
            error: category,
            quality: null,
            startedAt,
            durationMs,
          })
        }
        const profile = result.success
        const score = scoreProfile(
          profile,
          persona.rubric,
          persona.prompts.map((prompt) => ({
            id: prompt.id,
            session: `${prompt.source}:${prompt.sessionId}`,
            text: prompt.text,
          })),
        )
        // A requested language that could not be generated is missing content, not a pass.
        const missing = c.variant.options.languages.filter((l) => !profile.languages.includes(l))
        const failures = [
          ...score.failures,
          ...missing.map((l) => `Missing requested language: ${l}`),
        ]
        const quality = { ...score, failures, passed: failures.length === 0 }
        yield* writeJson(path.join(root, dir, "profile.json"), encodeProfile(profile))
        yield* writeJson(path.join(root, dir, "quality.json"), quality)
        return summary({ status: "ok", error: null, quality, startedAt, durationMs })
      })

    yield* saveManifest(false)
    yield* Effect.gen(function* () {
      for (const c of cases) {
        const r = yield* runCase(c)
        results.push(r)
        // Failure metadata is written even when there is no profile.
        yield* writeJson(path.join(root, r.dir, "run.json"), r)
        yield* saveManifest(false)
      }
    }).pipe(
      // Ctrl-C: record the running case and every unstarted one, then mark the experiment.
      Effect.onInterrupt(() =>
        Effect.gen(function* () {
          const pending = cases.filter((c) => !results.some((r) => r.id === c.id))
          for (const c of pending) {
            const running = active?.record.dir === caseDir(c) ? active : null
            const r = (running?.record ?? caseRecord(c)).summary({
              status: "interrupted",
              error: running ? "Interrupted" : "not started",
              quality: null,
              ...(running
                ? { startedAt: running.startedAt, durationMs: now().getTime() - running.started }
                : {}),
            })
            results.push(r)
            yield* writeJson(path.join(root, r.dir, "run.json"), r)
          }
          yield* saveManifest(true, true)
        }).pipe(Effect.ignore),
      ),
    )
    yield* saveManifest(true)
    return manifest(true)
  })
