import type { Language } from "../domain/Profile.ts"

const n = (x: number, lang: Language) => x.toLocaleString(lang)

/** Numbers for the `stats` summary, already formatted where needed. */
export interface StatsSummary {
  readonly prompts: number
  readonly sessions: number
  readonly activeDays: number
  /** "21:00", or "-" without data. */
  readonly peak: string
  readonly latest: string
  readonly streakDays: number
  /** Percentages 0–100. */
  readonly zh: number
  readonly en: number
  readonly mixed: number
}

const ZH_UNITS: Record<string, string> = { d: " 天", w: " 週", m: " 個月", y: " 年" }

const zh = {
  header: (v: string) => `◆ prompt-profile v${v}`,
  reading: "● 讀取資料",
  sourceLine: (name: string, prompts: number, sessions: number) =>
    `  ${name.padEnd(12)} ${n(prompts, "zh-TW").padStart(7)} 筆 prompt · ${n(sessions, "zh-TW")} 個 session`,
  cleaning: "● 清理與遮蔽",
  excludedLine: (count: number, rules: string) => `  排除雜訊 ${n(count, "zh-TW")} 筆（${rules}）`,
  redactedLine: (count: number, detail: string) =>
    count === 0
      ? "  沒有發現需要遮蔽的敏感資訊"
      : `  遮蔽敏感資訊 ${n(count, "zh-TW")} 處（${detail}）`,
  range: (since: string, prompts: number, chunks: number) =>
    `● 分析範圍：${since} · ${n(prompts, "zh-TW")} 筆 prompt → ${chunks} 段`,
  sampledNote: (selected: number, total: number) =>
    `  資料量較大，抽樣 ${selected} / ${total} 段（--full 可分析全部）`,
  engineLine: (name: string, calls: number, hits: number) =>
    `  使用 ${name}（已登入）分析，預計呼叫 ${calls} 次${hits > 0 ? `（${hits} 段來自快取）` : ""}，會使用你的訂閱額度`,
  confirm: "要繼續嗎？",
  cancelled: "已取消，沒有呼叫任何 LLM。",
  analysing: (done: number, total: number, cached: number) =>
    `● 分析中 ${bar(done, total)} ${done}/${total} 段${cached > 0 ? `（${cached} 段來自快取）` : ""}`,
  chunkTiming: (index: number, ms: number) =>
    `  第 ${index + 1} 段完成（${(ms / 1000).toFixed(1)} 秒）`,
  merging: (groups: number) => `● 觀察太多，先分 ${groups} 組合併…`,
  reducing: "● 整合側寫…",
  verified: (kept: number, total: number) => `● 驗證證據：保留 ${kept} / ${total} 筆`,
  done: "✔ 完成！",
  reportLine: (p: string, opened: boolean) => `  報告   ${p}${opened ? "（已在瀏覽器開啟）" : ""}`,
  cardLine: (p: string) => `  圖卡   ${p}`,
  cardSkipped: (reason: string) => `  圖卡   未產生：${reason}`,
  dataLine: (p: string) => `  資料   ${p}`,
  skippedChunks: (k: number) => `  有 ${k} 段分析失敗而略過，報告中已註明`,
  interrupted: "已中斷，重跑會從快取繼續。",
  dryRun: (dir: string, chunks: number, chars: number) =>
    `✔ dry run：${chunks} 段、約 ${n(chars, "zh-TW")} 字元會送出。內容已寫到 ${dir}（chunks/*.txt、plan.json），沒有呼叫任何 LLM。`,
  statsSummary: (s: StatsSummary) =>
    [
      `  prompt ${n(s.prompts, "zh-TW")} 筆 · session ${n(s.sessions, "zh-TW")} 個 · 活躍 ${s.activeDays} 天`,
      `  最活躍時段 ${s.peak} · 最晚 ${s.latest} · 最長連續 ${s.streakDays} 天`,
      `  中文 ${s.zh}% · 英文 ${s.en}% · 混合 ${s.mixed}%`,
    ].join("\n"),
  statsWritten: (p: string) => `✔ 統計已寫到 ${p}`,
  rendered: (p: string) => `✔ 已重新產生報告：${p}`,
  cacheCleared: (p: string) => `✔ 已刪除分析快取：${p}`,
  sinceLabel: (since: string) =>
    since === "all" ? "全部" : `最近 ${since.replace(/[dwmy]$/, (unit) => ZH_UNITS[unit]!)}`,
  ruleNames: {
    "too-short": "太短",
    acknowledgement: "確認語",
    "consecutive-duplicate": "重複",
    "repeated-template": "模板",
    "delegated-subtask": "AI 子任務",
  } as Record<string, string>,
}

const en: typeof zh = {
  header: (v) => `◆ prompt-profile v${v}`,
  reading: "● Reading data",
  sourceLine: (name, prompts, sessions) =>
    `  ${name.padEnd(12)} ${n(prompts, "en").padStart(7)} prompts · ${n(sessions, "en")} sessions`,
  cleaning: "● Cleaning and redacting",
  excludedLine: (count, rules) => `  Skipped ${n(count, "en")} noisy prompts (${rules})`,
  redactedLine: (count, detail) =>
    count === 0
      ? "  No sensitive data found to redact"
      : `  Redacted ${n(count, "en")} sensitive items (${detail})`,
  range: (since, prompts, chunks) =>
    `● Range: ${since} · ${n(prompts, "en")} prompts → ${chunks} chunks`,
  sampledNote: (selected, total) =>
    `  Large history: sampling ${selected} / ${total} chunks (--full analyses everything)`,
  engineLine: (name, calls, hits) =>
    `  Using ${name} (logged in): about ${calls} call${calls === 1 ? "" : "s"}${hits > 0 ? ` (${hits} chunks cached)` : ""}, billed to your subscription`,
  confirm: "Continue?",
  cancelled: "Cancelled. No LLM was called.",
  analysing: (done, total, cached) =>
    `● Analysing ${bar(done, total)} ${done}/${total} chunks${cached > 0 ? ` (${cached} from cache)` : ""}`,
  chunkTiming: (index, ms) => `  chunk ${index + 1} done (${(ms / 1000).toFixed(1)}s)`,
  merging: (groups) => `● Many observations: merging in ${groups} groups first…`,
  reducing: "● Writing the profile…",
  verified: (kept, total) => `● Verifying evidence: kept ${kept} / ${total}`,
  done: "✔ Done!",
  reportLine: (p, opened) => `  Report ${p}${opened ? " (opened in your browser)" : ""}`,
  cardLine: (p) => `  Card   ${p}`,
  cardSkipped: (reason) => `  Card   not created: ${reason}`,
  dataLine: (p) => `  Data   ${p}`,
  skippedChunks: (k) => `  ${k} chunk(s) failed and were skipped (noted in the report)`,
  interrupted: "Interrupted. Run again to resume from the cache.",
  dryRun: (dir, chunks, chars) =>
    `✔ Dry run: ${chunks} chunks, ~${n(chars, "en")} characters would be sent. Written to ${dir} (chunks/*.txt, plan.json). No LLM was called.`,
  statsSummary: (s) =>
    [
      `  prompts ${s.prompts} · sessions ${s.sessions} · active days ${s.activeDays}`,
      `  peak hour ${s.peak} · latest ${s.latest} · longest streak ${s.streakDays}d`,
      `  zh ${s.zh}% · en ${s.en}% · mixed ${s.mixed}%`,
    ].join("\n"),
  statsWritten: (p) => `✔ Stats written to ${p}`,
  rendered: (p) => `✔ Report re-rendered: ${p}`,
  cacheCleared: (p) => `✔ Analysis cache deleted: ${p}`,
  sinceLabel: (since) => (since === "all" ? "all time" : `last ${since}`),
  ruleNames: {
    "too-short": "too short",
    acknowledgement: "acknowledgements",
    "consecutive-duplicate": "duplicates",
    "repeated-template": "templates",
    "delegated-subtask": "AI sub-tasks",
  },
}

function bar(done: number, total: number): string {
  const width = 12
  const filled = total === 0 ? width : Math.round((done / total) * width)
  return "█".repeat(filled) + "░".repeat(width - filled)
}

export type CliMessages = typeof zh
export const cliMessages: Record<Language, CliMessages> = { "zh-TW": zh, en }
