const n = (x: number) => x.toLocaleString("en")

/** Numbers for the `stats` summary, already formatted where needed. */
export interface StatsSummary {
  readonly prompts: number
  readonly sessions: number
  readonly activeDays: number
  /** "21:00", or "-" without data. */
  readonly peak: string
  readonly latest: string
  readonly streakDays: number
  /** Percentages 0–100 of prompts written in Chinese / English / both. */
  readonly zh: number
  readonly en: number
  readonly mixed: number
}

const bar = (done: number, total: number): string => {
  const width = 12
  const filled = total === 0 ? width : Math.round((done / total) * width)
  return "█".repeat(filled) + "░".repeat(width - filled)
}

/** Every line the CLI prints (errors are in render-error.ts). */
export const messages = {
  header: (v: string) => `◆ prompt-profile v${v}`,
  reading: "● Reading data",
  sourceLine: (name: string, prompts: number, sessions: number) =>
    `  ${name.padEnd(12)} ${n(prompts).padStart(7)} prompts · ${n(sessions)} sessions`,
  cleaning: "● Cleaning and redacting",
  excludedLine: (count: number, rules: string) => `  Skipped ${n(count)} noisy prompts (${rules})`,
  redactedLine: (count: number, detail: string) =>
    count === 0
      ? "  No supported redaction pattern matched"
      : `  Redacted ${n(count)} sensitive items (${detail})`,
  range: (since: string, prompts: number, chunks: number) =>
    `● Range: ${since} · ${n(prompts)} prompts → ${chunks} chunks`,
  sampledNote: (selected: number, total: number) =>
    `  Large history: sampling ${selected} / ${total} chunks (--full analyses everything)`,
  engineLine: (name: string, calls: number, hits: number) =>
    `  Using ${name} (logged in): base estimate ${calls} call${calls === 1 ? "" : "s"}${hits > 0 ? ` (${hits} chunks cached)` : ""}, billed to your subscription`,
  callEstimateNote:
    "  Base estimate excludes intermediate merges and retries (up to 2 retries per call).",
  callBudget: (limit: number) => `  Call budget: at most ${limit} CLI calls, including retries`,
  confirm: "Continue?",
  cancelled: "Cancelled. No LLM was called.",
  analysing: (done: number, total: number, cached: number) =>
    `● Analysing ${bar(done, total)} ${done}/${total} chunks${cached > 0 ? ` (${cached} from cache)` : ""}`,
  chunkTiming: (index: number, ms: number) =>
    `  chunk ${index + 1} done (${(ms / 1000).toFixed(1)}s)`,
  merging: (groups: number) => `● Many observations: merging in ${groups} groups first…`,
  reducing: "● Writing the profile…",
  verified: (kept: number, total: number) => `● Verifying evidence: kept ${kept} / ${total}`,
  done: "✔ Done!",
  reportLine: (p: string, opened: boolean) =>
    `  Report ${p}${opened ? " (opened in your browser)" : ""}`,
  cardLine: (p: string) => `  Card   ${p}`,
  cardSkipped: (reason: string) => `  Card   not created: ${reason}`,
  dataLine: (p: string) => `  Data   ${p}`,
  skippedChunks: (k: number) => `  ${k} chunk(s) failed and were skipped (noted in the report)`,
  interrupted: "Interrupted. Run again to resume from the cache.",
  dryRun: (dir: string, chunks: number, chars: number) =>
    `✔ Dry run: ${chunks} chunks, ~${n(chars)} characters would be sent. Written to ${dir} (chunks/*.txt, plan.json). No LLM was called.`,
  statsSummary: (s: StatsSummary) =>
    [
      `  prompts ${s.prompts} · sessions ${s.sessions} · active days ${s.activeDays}`,
      `  peak hour ${s.peak} · latest ${s.latest} · longest streak ${s.streakDays}d`,
      `  zh ${s.zh}% · en ${s.en}% · mixed ${s.mixed}%`,
    ].join("\n"),
  statsWritten: (p: string) => `✔ Stats written to ${p}`,
  rendered: (p: string) => `✔ Report re-rendered: ${p}`,
  renderedNoAnalysis: "  No new analysis, no LLM calls.",
  cacheCleared: (p: string) => `✔ Analysis cache deleted: ${p}`,
  sinceLabel: (since: string) => (since === "all" ? "all time" : `last ${since}`),
  /** Exclusion rule → label in the "Skipped …" line. */
  ruleNames: {
    "too-short": "too short",
    acknowledgement: "acknowledgements",
    "consecutive-duplicate": "duplicates",
    "repeated-template": "templates",
    "delegated-subtask": "AI sub-tasks",
  } as Readonly<Record<string, string>>,
}

export type Messages = typeof messages
