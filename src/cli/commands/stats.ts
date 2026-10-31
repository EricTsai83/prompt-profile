import { Effect, Path } from "effect"
import { encodeStats, peakHour } from "../../domain/index.ts"
import { VERSION } from "../../version.ts"
import { messages } from "../messages.ts"
import { Output } from "../services.ts"
import { readSources, resolveOut, runPipelineStep, writeFileOrFail } from "../steps.ts"

/** `stats`: statistics only (no LLM); writes stats.json. */
export const runStats = (options: { readonly since: string; readonly out: string }) =>
  Effect.gen(function* () {
    const t = messages
    const out = yield* Output
    const path = yield* Path.Path
    yield* out.line(t.header(VERSION))
    yield* out.line("")
    const collected = yield* readSources
    const { stats } = yield* runPipelineStep(collected, options.since)
    const file = path.join(yield* resolveOut(options.out), "stats.json")
    yield* writeFileOrFail(file, `${JSON.stringify(encodeStats(stats), null, 2)}\n`)
    const peak = peakHour(stats)
    const percent = (x: number) => Math.round(x * 100)
    yield* out.line("")
    yield* out.line(
      t.statsSummary({
        prompts: stats.totalPrompts,
        sessions: stats.totalSessions,
        activeDays: stats.activeDays,
        peak: peak === null ? "-" : `${String(peak).padStart(2, "0")}:00`,
        latest: stats.latestTime ?? "-",
        streakDays: stats.longestStreakDays,
        zh: percent(stats.languageMix.zh),
        en: percent(stats.languageMix.en),
        mixed: percent(stats.languageMix.mixed),
      }),
    )
    yield* out.line(t.statsWritten(file))
  })
