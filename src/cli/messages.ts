import type { Finding } from "../pipeline/audit.ts"
import type { ReportContents } from "../report/visibility.ts"

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
  translated: (language: string) => `● Translated into ${language}`,
  translationFailed: (language: string) =>
    `⚠ Translation into ${language} failed; the report is written without it`,
  done: "✔ Done!",
  reportLine: (p: string, opened: boolean) =>
    `  Report ${p}${opened ? " (opened in your browser)" : ""}`,
  cardLine: (p: string) => `  Card   ${p}`,
  cardSkipped: (language: string, reason: string) =>
    `  Card   (${language}) not created: ${reason}`,
  dataLine: (p: string) => `  Data   ${p}`,
  checkClean: "  Check  no secrets or personal data found",
  skimHint: "  Before sharing, skim the quotes yourself: the check is rule-based.",
  excludeHint: (profile: string) =>
    `  To leave parts out: prompt-profile render ${profile} --exclude personal`,
  checkMasked: (count: number, groups: string) => `  Check  ${count} masked: ${groups}`,
  checkKept: (count: number, groups: string) => `  Check  ${count} kept (--check warn): ${groups}`,
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

/** `rule (location, location)` per rule, in the order found. Never the matched text. */
export const findingGroups = (findings: ReadonlyArray<Finding>): Array<string> => {
  const byRule = new Map<string, Array<string>>()
  for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f.location])
  return [...byRule.entries()].map(([rule, at]) => `${rule} (${at.join(", ")})`)
}

/** The "Check" lines after writing: what was masked and what was kept. */
export const checkLines = (findings: ReadonlyArray<Finding>): Array<string> => {
  if (findings.length === 0) return [messages.checkClean]
  const total = (fs: ReadonlyArray<Finding>) => fs.reduce((sum, f) => sum + f.count, 0)
  const masked = findings.filter((f) => f.masked)
  const kept = findings.filter((f) => !f.masked)
  return [
    ...(masked.length > 0
      ? [messages.checkMasked(total(masked), findingGroups(masked).join(", "))]
      : []),
    ...(kept.length > 0 ? [messages.checkKept(total(kept), findingGroups(kept).join(", "))] : []),
  ]
}

const count = (k: number, one: string, many: string) => `${n(k)} ${k === 1 ? one : many}`

/** "Contains …": what the written report shows. */
export const containsLine = (c: ReportContents): string => {
  const parts = [
    c.quotes > 0 ? count(c.quotes, "quote", "quotes") : null,
    c.projects > 0 ? count(c.projects, "project name", "project names") : null,
    c.exactDates ? "exact dates" : null,
    c.improvements > 0 ? count(c.improvements, "improvement", "improvements") : null,
    c.funFacts > 0 ? count(c.funFacts, "fun fact", "fun facts") : null,
    c.usage ? "plans, usage and API list-price equivalent" : null,
  ].filter((x) => x !== null)
  const personal = c.quotes > 0 || c.projects > 0 || c.exactDates || c.usage
  return `  Contains  ${personal ? parts.join(" · ") : ["no quotes, project names or exact dates", ...parts].join(" · ")}`
}

/** The lines after the file list: contents, the final check, and how to share safely. */
export const summaryLines = (
  c: ReportContents,
  findings: ReadonlyArray<Finding>,
  profile: string,
): Array<string> => [
  containsLine(c),
  ...checkLines(findings),
  ...(c.quotes > 0 ? [messages.skimHint] : []),
  ...(c.quotes > 0 || c.projects > 0 || c.exactDates || c.usage
    ? [messages.excludeHint(profile)]
    : []),
]
