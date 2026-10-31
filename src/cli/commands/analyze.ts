import { DEFAULT_VOICE, type Voice } from "../../domain/Voice.ts"
import type { Profile } from "../../domain/Profile.ts"
import type { AvatarChoice } from "../../report/avatar.ts"
import { variantName } from "../../report/looks.ts"
import { writeAnalysisReport, previousProfile } from "../library.ts"
import { compareHistory } from "../../domain/History.ts"
import { scanLibrary } from "../../platform/library.ts"
import { PIPELINE_VERSION } from "../../pipeline/version.ts"
import { libraryIo } from "../library.ts"
import { snapshotOf } from "../../domain/Progress.ts"
import { DateTime, Effect, Path } from "effect"
import { Prompt } from "effect/cli"
import { analyze, plan, type AnalysisPlan, type AnalyzeOptions } from "../../analysis/index.ts"
import { Progress, type ProgressShape } from "../../analysis/progress.ts"
import { chooseRunner } from "../../llm/detect.ts"
import { DISPLAY_NAMES, LlmRunner, type RunnerId } from "../../llm/LlmRunner.ts"
import { withCallBudget } from "../../llm/budget.ts"
import { withRetry } from "../../llm/retry.ts"
import { Environment } from "../../platform/Environment.ts"
import type { CheckMode } from "../../pipeline/audit.ts"
import type { LookId } from "../../report/looks.ts"
import type { SafePrompt } from "../../domain/SafePrompt.ts"
import type { Stats } from "../../domain/Stats.ts"
import { VERSION } from "../../version.ts"
import { summarizeUsage, type SourceUsageInput } from "../../pipeline/usage.ts"
import type { RunnerStatus } from "../../llm/detect.ts"
import { InvalidArgument, NeedsConfirmation } from "../errors.ts"
import { messages, summaryLines, type Messages } from "../messages.ts"
import { isLimitedEvidence, reportContents } from "../../report/index.ts"
import {
  parseAllow,
  parseLanguages,
  launcherOf,
  parseEffort,
  parseRenderOptions,
  renderRetryCommand,
  rerunCommand,
  type RunFlags,
} from "../options.ts"
import { LlmProvider, Opener, Output, type OutputShape } from "../services.ts"
import { readSources, resolveOut, runPipelineStep, writeFileOrFail } from "../steps.ts"

/** The main command: read → pipeline → (confirm) → analyse → report. */

export interface MainOptions extends Omit<RunFlags, "engine"> {
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
  readonly avatar?: AvatarChoice | undefined
  readonly look?: LookId
  readonly cardHide?: string | undefined
  readonly exclude?: string | undefined
  readonly name?: string | undefined
  readonly check?: CheckMode
  readonly allow?: string | undefined
}

/** `--dry-run`: the chunks that would be sent, plus plan.json. Never calls an LLM. */
const writeDryRun = (
  p: AnalysisPlan,
  outDir: string,
  context?: Profile["context"],
  voice: Voice = DEFAULT_VOICE,
) =>
  Effect.gen(function* () {
    const path = yield* Path.Path
    for (const [i, c] of p.chunks.entries()) {
      yield* writeFileOrFail(
        path.join(outDir, "chunks", `${String(i + 1).padStart(3, "0")}-${c.label}.txt`),
        `${c.text}\n`,
      )
    }
    const summary = {
      voice,
      ...(context ? { context } : {}),
      chunksTotal: p.chunksTotal,
      chunksSelected: p.chunks.length,
      sampled: p.sampled,
      cacheHits: p.cacheHits,
      llmCalls: p.llmCalls,
      llmCallsEstimate:
        "Uncached chunks + final profile + evidence review + translations; intermediate merges and retries are additional.",
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

/**
 * The plan a CLI reports wins over the hint from local files; the file's extra detail is kept.
 * Detection never blocks a report: no answer leaves the file's view (or "unknown").
 */
const withDetectedPlans = (
  usage: ReadonlyArray<SourceUsageInput>,
  statuses: ReadonlyArray<RunnerStatus>,
): ReadonlyArray<SourceUsageInput> =>
  usage.map((u) => {
    const detected = statuses.find((s) => s.id === u.source)?.plan
    return detected === undefined || detected.kind === "unknown"
      ? u
      : { ...u, plan: { ...detected, detail: detected.detail ?? u.plan.detail } }
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
    onTranslateStart: (language) => out.line(t.translating(language)),
    onTranslated: (language, ok) =>
      out.line(ok ? t.translated(language) : t.translationFailed(language)),
  }
}

/** `--engine` as typed (`claude` / `codex`), for commands shown to the user. */
const engineFlag = (id: RunnerId | undefined) =>
  id === undefined ? undefined : id === "claude-code" ? "claude" : "codex"

/** The flags a re-run must repeat, as the user typed them. */
export const runFlags = (options: MainOptions): RunFlags => ({
  ...options,
  engine: engineFlag(options.engine),
})

const RUNNER_COMMANDS: Record<RunnerId, string> = {
  "claude-code": "claude -p",
  codex: "codex exec",
}

/** YYYY-MM-DD in the user's time zone. */
const localDate = (d: DateTime.Utc, timeZone: string) =>
  DateTime.formatIsoDate(DateTime.makeZonedUnsafe(d, { timeZone }))

/**
 * What a run will read, select, send and cost — before confirmation, and for --dry-run. Uses
 * the collected stats and the analysis plan; nothing here calls an LLM.
 */
const preflight = (input: {
  readonly since: string
  readonly prompts: ReadonlyArray<SafePrompt>
  readonly stats: Stats
  readonly plan: AnalysisPlan
  /** The engine a real run would use; null when no logged-in CLI was found. */
  readonly runner: RunnerId | null
  readonly maxCalls: number | null
  readonly dryRun: boolean
}) =>
  Effect.gen(function* () {
    const t = messages
    const out = yield* Output
    const env = yield* Environment
    const { plan: p, stats } = input
    const range = stats.dateRange
    yield* out.line(
      t.range(
        t.sinceLabel(input.since),
        range === null ? null : localDate(range.from, env.timezone),
        range === null ? null : localDate(range.to, env.timezone),
      ),
    )
    yield* out.line(
      t.inRange(
        Object.entries(stats.bySource)
          .filter(([, k]) => k > 0)
          .map(([id, k]) => [DISPLAY_NAMES[id as RunnerId] ?? id, k] as const),
      ),
    )
    yield* out.line(
      t.selection(
        input.prompts.length,
        new Set(input.prompts.map((x) => `${x.source}:${x.sessionId}`)).size,
        p.promptsAnalyzed,
        p.chunks.length,
      ),
    )
    yield* out.line(p.sampled ? t.sampledNote(p.chunks.length, p.chunksTotal) : t.notSampled)
    yield* out.line(t.localLine)
    yield* out.line(
      input.runner === null
        ? t.noRunnerLine
        : t.remoteLine(DISPLAY_NAMES[input.runner], RUNNER_COMMANDS[input.runner], input.dryRun),
    )
    yield* out.line(t.quotaLine(p.llmCalls, p.mapCalls, p.cacheHits, p.translationCalls))
    yield* out.line(t.callEstimateNote)
    yield* out.line(input.maxCalls === null ? t.noCallBudget : t.callBudget(input.maxCalls))
    if (!input.dryRun) yield* out.line(t.freeRoute)
    yield* out.line("")
  })

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
    const effort = yield* parseEffort(options.effort)
    const renderOptions = yield* parseRenderOptions(
      options.look ?? "classic",
      options.cardHide,
      options.exclude,
      options.name,
      options.avatar,
    )
    const allow = yield* parseAllow(options.allow)
    const path = yield* Path.Path
    const env = yield* Environment
    const languages = yield* parseLanguages(options.lang, env.locale)
    // The flags a re-run repeats, started the way this run was.
    const flags: RunFlags = { ...runFlags(options), launcher: launcherOf(env.env, VERSION) }
    const out = yield* Output
    const outDir = yield* resolveOut(options.out)
    yield* out.line(t.header(VERSION))
    yield* out.line("")

    const collected = yield* readSources
    const { prompts, stats, window, context } = yield* runPipelineStep(
      collected,
      options.since,
      options.project,
    )

    const analyzeOptions: AnalyzeOptions = {
      contextIdentity: context?.identity,
      voice: options.voice,
      timezone: env.timezone,
      full: options.full,
      noCache: !options.cache,
      model: options.model ?? null,
      effort,
      languages,
    }
    const provider = yield* LlmProvider

    if (options.dryRun) {
      // Estimate with the engine a real run would pick (detection sends no prompt): cache
      // keys depend on it. Without a usable CLI, fall back so a dry run still works.
      const runnerId = yield* chooseRunner(yield* provider.detect, options.engine ?? null).pipe(
        Effect.map((s): RunnerId | null => s.id),
        Effect.orElseSucceed(() => null),
      )
      const p = yield* plan({
        prompts,
        options: analyzeOptions,
        runner: runnerId ?? options.engine ?? "claude-code",
      })
      yield* preflight({
        since: options.since,
        prompts,
        stats,
        plan: p,
        runner: runnerId,
        maxCalls,
        dryRun: true,
      })
      yield* writeDryRun(p, outDir, context, options.voice)
      yield* out.line(t.dryRun(outDir, p.chunks.length, p.charsToSend))
      return
    }

    // Pick the engine (no prompt is sent to check login).
    const statuses = yield* provider.detect
    const status = yield* chooseRunner(statuses, options.engine ?? null)
    const base = yield* provider.make(status.id, { model: options.model, effort })
    const runner = withRetry(maxCalls === null ? base : withCallBudget(base, maxCalls))

    const p = yield* plan({ prompts, options: analyzeOptions, runner: runner.id })
    yield* preflight({
      since: options.since,
      prompts,
      stats,
      plan: p,
      runner: runner.id,
      maxCalls,
      dryRun: false,
    })

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
    const analyzed = yield* analyze({ prompts, stats, options: analyzeOptions }).pipe(
      Effect.provideService(LlmRunner, runner),
      Effect.provideService(Progress, makeProgress(out, t, p.chunks.length)),
      Effect.onInterrupt(() => out.error(`\n${t.interrupted(rerunCommand(flags))}`)),
    )

    const profile = { ...analyzed, ...(context ? { context } : {}) }

    // Usage, plan and API list-price equivalent: local logs only, never sent to the LLM.
    const usage = context
      ? null
      : summarizeUsage(withDetectedPlans(collected.usage, statuses), window)
    // The report in this folder before this run, if any: "since your last report".
    const previousReport = yield* previousProfile(outDir)
    const priorIndex = yield* libraryIo(outDir, () => scanLibrary(outDir))
    const priorManifest = priorIndex.runs.find((r) => r.id === priorIndex.latest)
    const compared = previousReport
      ? compareHistory(
          profile,
          previousReport,
          { schema: profile.schemaVersion, pipeline: PIPELINE_VERSION },
          {
            schema: priorManifest?.schemaVersion ?? 0,
            pipeline: priorManifest?.pipelineVersion ?? "unknown",
          },
        )
      : { comparison: null, reasons: [] }
    const previous =
      previousReport && compared.comparison?.toolComparable ? snapshotOf(previousReport) : null
    if (compared.reasons.length) yield* out.debug(t.historySkipped(compared.reasons.join(", ")))
    yield* out.line(t.writing)
    const files = yield* writeAnalysisReport(
      { ...profile, previous, historyComparison: compared.comparison, usage },
      outDir,
      renderOptions,
      {
        mode: options.check ?? "mask",
        allow,
      },
    )
    const opened = env.isTTY ? yield* (yield* Opener).open(files.html) : false
    yield* out.line("")
    yield* out.line(t.done)
    yield* out.line(t.reportLine(files.html, opened))
    for (const card of files.cards)
      yield* out.line(
        card.file ? t.cardLine(card.file) : t.cardSkipped(card.language, card.error ?? "?"),
      )
    if (files.cards.some((c) => c.file === null))
      yield* out.line(
        t.cardRetry(
          renderRetryCommand(
            files.profileJson,
            path.join(path.dirname(files.profileJson), "variants", variantName(renderOptions)),
            flags,
          ),
        ),
      )
    yield* out.line(t.dataLine(files.profileJson))
    yield* out.line(t.libraryLine(files.libraryHome))
    for (const line of summaryLines(
      reportContents(files.profile, renderOptions),
      files.findings,
      files.profileJson,
    ))
      yield* out.line(line)
    if (profile.coverage.chunksFailed > 0)
      yield* out.line(t.skippedChunks(profile.coverage.chunksFailed))
    if (isLimitedEvidence(profile)) yield* out.line(t.limitedEvidence)
    const missing = languages.filter((l) => !profile.languages.includes(l))
    if (missing.length > 0)
      yield* out.line(t.missingLanguages(missing.join(", "), rerunCommand(flags)))
  })
