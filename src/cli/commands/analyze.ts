import { Effect, Path } from "effect"
import { Prompt } from "effect/cli"
import { analyze, plan, type AnalysisPlan, type AnalyzeOptions } from "../../analysis/index.ts"
import { Progress, type ProgressShape } from "../../analysis/progress.ts"
import { chooseRunner } from "../../llm/detect.ts"
import { LlmRunner, type RunnerId } from "../../llm/LlmRunner.ts"
import { withCallBudget } from "../../llm/budget.ts"
import { withRetry } from "../../llm/retry.ts"
import { Environment } from "../../platform/Environment.ts"
import type { CheckMode } from "../../pipeline/audit.ts"
import type { LookId } from "../../report/looks.ts"
import { VERSION } from "../../version.ts"
import { InvalidArgument, NeedsConfirmation } from "../errors.ts"
import { checkLines, messages, type Messages } from "../messages.ts"
import { parseAllow, parseLanguages, parseRenderOptions } from "../options.ts"
import { LlmProvider, Opener, Output, type OutputShape } from "../services.ts"
import {
  previousSnapshot,
  readSources,
  resolveOut,
  runPipelineStep,
  writeFileOrFail,
  writeReportFiles,
} from "../steps.ts"

/** The main command: read → pipeline → (confirm) → analyse → report. */

export interface MainOptions {
  readonly maxCalls?: string | undefined
  readonly since: string
  readonly engine: RunnerId | undefined
  readonly model: string | undefined
  readonly out: string
  readonly full: boolean
  readonly cache: boolean
  readonly yes: boolean
  readonly dryRun: boolean
  /** Report languages, comma-separated; default from the system locale. */
  readonly lang?: string | undefined
  /** Render-only: the report/card look and the card parts to hide (default: classic, none). */
  readonly look?: LookId
  readonly cardHide?: string | undefined
  readonly exclude?: string | undefined
  readonly check?: CheckMode
  readonly allow?: string | undefined
}

/** `--dry-run`: the chunks that would be sent, plus plan.json. Never calls an LLM. */
const writeDryRun = (p: AnalysisPlan, outDir: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    for (const [i, c] of p.chunks.entries()) {
      yield* writeFileOrFail(
        path.join(outDir, "chunks", `${String(i + 1).padStart(3, "0")}-${c.label}.txt`),
        `${c.text}\n`,
      )
    }
    const summary = {
      chunksTotal: p.chunksTotal,
      chunksSelected: p.chunks.length,
      sampled: p.sampled,
      cacheHits: p.cacheHits,
      llmCalls: p.llmCalls,
      llmCallsEstimate: "Map + final reduce only; merges and retries are additional.",
      charsToSend: p.charsToSend,
      promptsAnalyzed: p.promptsAnalyzed,
      sessionsAnalyzed: p.sessionsAnalyzed,
      chunks: p.chunks.map((c) => ({
        id: c.id,
        label: c.label,
        prompts: c.prompts.length,
        chars: c.text.length,
      })),
    }
    yield* writeFileOrFail(path.join(outDir, "plan.json"), `${JSON.stringify(summary, null, 2)}\n`)
  })

/** Progress bar on the status line; timings only with --verbose. */
const makeProgress = (out: OutputShape, t: Messages, total: number): ProgressShape => {
  let done = 0
  let cached = 0
  return {
    onChunkStart: () => Effect.void,
    onChunkDone: (info) =>
      Effect.gen(function* () {
        done++
        if (info.fromCache) cached++
        if (info.durationMs !== null) yield* out.debug(t.chunkTiming(info.index, info.durationMs))
        yield* out.status(t.analysing(done, total, cached))
      }),
    onMergeStart: (groups) => out.line(t.merging(groups)),
    onReduceStart: out.line(t.reducing),
    onReduceDone: (ms) => out.debug(t.chunkTiming(total, ms)),
    onVerified: (kept, dropped) => out.line(t.verified(kept, kept + dropped)),
    onTranslated: (language, ok) =>
      out.line(ok ? t.translated(language) : t.translationFailed(language)),
  }
}

export const runMain = (options: MainOptions) =>
  Effect.gen(function* () {
    const t = messages
    const maxCalls = options.maxCalls === undefined ? null : Number(options.maxCalls)
    if (
      maxCalls !== null &&
      (!/^\d+$/.test(options.maxCalls!) || !Number.isSafeInteger(maxCalls) || maxCalls < 1)
    ) {
      return yield* new InvalidArgument({ flag: "--max-calls", value: options.maxCalls! })
    }
    const renderOptions = yield* parseRenderOptions(
      options.look ?? "classic",
      options.cardHide,
      options.exclude,
    )
    const allow = yield* parseAllow(options.allow)
    const env = yield* Environment
    const languages = yield* parseLanguages(options.lang, env.locale)
    const out = yield* Output
    const outDir = yield* resolveOut(options.out)
    yield* out.line(t.header(VERSION))
    yield* out.line("")

    const collected = yield* readSources
    const { prompts, stats } = yield* runPipelineStep(collected, options.since)

    const analyzeOptions: AnalyzeOptions = {
      timezone: env.timezone,
      full: options.full,
      noCache: !options.cache,
      model: options.model ?? null,
      languages,
    }
    const provider = yield* LlmProvider

    if (options.dryRun) {
      // Estimate with the engine a real run would pick (detection sends no prompt): cache
      // keys depend on it. Without a usable CLI, fall back so a dry run still works.
      const runnerId = yield* chooseRunner(yield* provider.detect, options.engine ?? null).pipe(
        Effect.map((s) => s.id),
        Effect.orElseSucceed(() => options.engine ?? "claude-code"),
      )
      const p = yield* plan({ prompts, options: analyzeOptions, runner: runnerId })
      yield* writeDryRun(p, outDir)
      yield* out.line(t.dryRun(outDir, p.chunks.length, p.charsToSend))
      return
    }

    // Pick the engine (no prompt is sent to check login).
    const status = yield* chooseRunner(yield* provider.detect, options.engine ?? null)
    const base = yield* provider.make(status.id, { model: options.model })
    const runner = withRetry(maxCalls === null ? base : withCallBudget(base, maxCalls))

    const p = yield* plan({ prompts, options: analyzeOptions, runner: runner.id })
    yield* out.line(t.range(t.sinceLabel(options.since), p.promptsAnalyzed, p.chunks.length))
    if (p.sampled) yield* out.line(t.sampledNote(p.chunks.length, p.chunksTotal))
    yield* out.line(t.engineLine(runner.displayName, p.llmCalls, p.cacheHits))
    yield* out.line(t.callEstimateNote)
    if (maxCalls !== null) yield* out.line(t.callBudget(maxCalls))
    yield* out.line("")

    if (!options.yes) {
      if (!env.isTTY) return yield* new NeedsConfirmation()
      const ok = yield* Prompt.run(Prompt.Confirm({ message: t.confirm, initial: true })).pipe(
        Effect.orElseSucceed(() => false),
      )
      if (!ok) {
        yield* out.line(t.cancelled)
        return
      }
    }

    yield* out.status(t.analysing(0, p.chunks.length, 0))
    const profile = yield* analyze({ prompts, stats, options: analyzeOptions }).pipe(
      Effect.provideService(LlmRunner, runner),
      Effect.provideService(Progress, makeProgress(out, t, p.chunks.length)),
      Effect.onInterrupt(() => out.error(`\n${t.interrupted}`)),
    )

    // The report in this folder before this run, if any: "since your last report".
    const previous = yield* previousSnapshot(outDir)
    const files = yield* writeReportFiles({ ...profile, previous }, outDir, renderOptions, null, {
      mode: options.check ?? "mask",
      allow,
    })
    const opened = env.isTTY ? yield* (yield* Opener).open(files.html) : false
    yield* out.line("")
    yield* out.line(t.done)
    yield* out.line(t.reportLine(files.html, opened))
    for (const card of files.cards)
      yield* out.line(
        card.file ? t.cardLine(card.file) : t.cardSkipped(card.language, card.error ?? "?"),
      )
    yield* out.line(t.dataLine(files.profileJson))
    for (const line of checkLines(files.findings)) yield* out.line(line)
    if (profile.coverage.chunksFailed > 0)
      yield* out.line(t.skippedChunks(profile.coverage.chunksFailed))
  })
