import type { Confidence, DimensionKey, Language } from "../domain/Profile.ts"

export interface Messages {
  readonly title: string
  readonly period: (from: string, to: string) => string
  readonly coverage: (prompts: number, sessions: number) => string
  readonly sampled: (analyzed: number, total: number) => string
  readonly numbers: string
  readonly totalPrompts: string
  readonly peakHour: string
  readonly languageMix: string
  readonly longestStreak: string
  readonly latestTime: string
  readonly activeDays: string
  readonly days: (n: number) => string
  readonly correctionRate: string
  readonly heatmap: string
  readonly weekdays: ReadonlyArray<string>
  readonly traits: string
  readonly confidence: Record<Confidence, string>
  readonly showEvidence: (n: number) => string
  readonly dimensions: string
  readonly dimensionNames: Record<DimensionKey, string>
  readonly insufficientEvidence: string
  readonly funFacts: string
  readonly engine: (runner: string, model: string | null) => string
  readonly generatedAt: (at: string) => string
  readonly evidenceVerified: (kept: number, dropped: number) => string
  readonly chunksSkipped: (n: number) => string
  readonly privacy: string
  readonly project: string
  readonly none: string
}

const zh: Messages = {
  title: "我的 AI 協作側寫",
  period: (from, to) => `分析期間：${from} – ${to}`,
  coverage: (p, s) =>
    `${p.toLocaleString("zh-TW")} 筆 prompt · ${s.toLocaleString("zh-TW")} 個 session`,
  sampled: (a, t) => `資料量較大，抽樣分析了 ${a} / ${t} 段`,
  numbers: "數字",
  totalPrompts: "prompt 總數",
  peakHour: "最活躍時段",
  languageMix: "中文 / 英文 / 混合",
  longestStreak: "最長連續天數",
  latestTime: "最晚的工作時間",
  activeDays: "活躍天數",
  days: (n) => `${n} 天`,
  correctionRate: "糾正 AI 的比例",
  heatmap: "什麼時候在寫 prompt",
  weekdays: ["一", "二", "三", "四", "五", "六", "日"],
  traits: "特質",
  confidence: { high: "高信心", medium: "中信心", low: "低信心" },
  showEvidence: (n) => `看 ${n} 筆證據`,
  dimensions: "五個面向",
  dimensionNames: {
    work_style: "工作風格",
    communication: "溝通風格",
    tech_profile: "技術輪廓",
    interests: "興趣與關注",
    growth: "成長變化",
  },
  insufficientEvidence: "證據不足：這段摘要沒有通過驗證的原文引用，僅供參考。",
  funFacts: "有趣的事實",
  engine: (r, m) => `分析引擎：${r}${m ? `（${m}）` : ""}`,
  generatedAt: (at) => `產生時間：${at}`,
  evidenceVerified: (k, d) =>
    `已驗證 ${k} 筆證據${d > 0 ? `（移除 ${d} 筆無法對應原文的引用）` : ""}`,
  chunksSkipped: (n) => `有 ${n} 段分析失敗而略過`,
  privacy:
    "隱私：prompt 只在你的電腦上讀取；遮蔽敏感資訊後，才送到你自己的 Claude Code / Codex 帳號分析。這份報告不會被上傳。",
  project: "prompt-profile",
  none: "—",
}

const en: Messages = {
  title: "My AI collaboration profile",
  period: (from, to) => `Period: ${from} – ${to}`,
  coverage: (p, s) => `${p.toLocaleString("en")} prompts · ${s.toLocaleString("en")} sessions`,
  sampled: (a, t) => `Large history: ${a} of ${t} chunks were sampled`,
  numbers: "Numbers",
  totalPrompts: "Prompts",
  peakHour: "Peak hour",
  languageMix: "Chinese / English / mixed",
  longestStreak: "Longest streak",
  latestTime: "Latest session",
  activeDays: "Active days",
  days: (n) => `${n} day${n === 1 ? "" : "s"}`,
  correctionRate: "Corrections",
  heatmap: "When you prompt",
  weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  traits: "Traits",
  confidence: { high: "High confidence", medium: "Medium confidence", low: "Low confidence" },
  showEvidence: (n) => `Show ${n} piece${n === 1 ? "" : "s"} of evidence`,
  dimensions: "Five dimensions",
  dimensionNames: {
    work_style: "Work style",
    communication: "Communication",
    tech_profile: "Tech profile",
    interests: "Interests",
    growth: "Growth",
  },
  insufficientEvidence: "Insufficient evidence: no quote in this summary passed verification.",
  funFacts: "Fun facts",
  engine: (r, m) => `Engine: ${r}${m ? ` (${m})` : ""}`,
  generatedAt: (at) => `Generated: ${at}`,
  evidenceVerified: (k, d) =>
    `${k} pieces of evidence verified${d > 0 ? ` (${d} unverifiable quotes removed)` : ""}`,
  chunksSkipped: (n) =>
    `${n} chunk${n === 1 ? "" : "s"} failed and ${n === 1 ? "was" : "were"} skipped`,
  privacy:
    "Privacy: prompts are read only on your machine; after redaction they are analysed with your own Claude Code / Codex account. This report is never uploaded.",
  project: "prompt-profile",
  none: "—",
}

export const messages: Record<Language, Messages> = { "zh-TW": zh, en }
