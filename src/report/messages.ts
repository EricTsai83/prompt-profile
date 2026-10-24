import type { Confidence, DimensionKey, Language } from "../domain/Profile.ts"

export interface Messages {
  /** Name of the language in its own script, for the switch. */
  readonly languageName: string
  /** BCP 47 tag for `lang` attributes and Intl formatting. */
  readonly locale: string
  readonly title: string
  readonly switchLabel: string
  readonly period: (from: string, to: string) => string
  readonly coverage: (prompts: number, sessions: number) => string
  readonly sampled: (analyzed: number, total: number) => string
  readonly totalPrompts: string
  readonly activeDays: string
  readonly longestStreak: string
  readonly peakHour: string
  readonly days: (n: number) => string
  readonly byHour: string
  readonly byHourNote: (peak: string, latest: string) => string
  readonly byWeekday: string
  readonly weekdays: ReadonlyArray<string>
  readonly languageMix: string
  readonly languageNames: { readonly zh: string; readonly en: string; readonly mixed: string }
  readonly sources: string
  readonly origins: string
  readonly originNames: Record<"interactive" | "sdk" | "exec" | "unknown", string>
  readonly habits: string
  readonly correctionRate: string
  readonly imageRate: string
  readonly promptLength: string
  readonly median: string
  readonly p90: string
  readonly characters: (n: number) => string
  readonly heatmap: string
  readonly heatmapNote: string
  readonly traits: string
  readonly confidence: Record<Confidence, string>
  readonly showEvidence: (n: number) => string
  readonly dimensions: string
  readonly dimensionNames: Record<DimensionKey, string>
  readonly evidenceCount: (n: number) => string
  readonly noEvidence: string
  readonly insufficientEvidence: string
  readonly funFacts: string
  readonly about: string
  readonly engine: (runner: string, model: string | null) => string
  readonly generatedAt: (at: string) => string
  readonly evidenceVerified: (kept: number, dropped: number) => string
  readonly chunksSkipped: (n: number) => string
  readonly privacy: string
  readonly project: string
  readonly none: string
  readonly madeFrom: string
  readonly cardPrompts: string
  readonly cardStreak: string
  readonly cardLatest: string
  readonly cardPeak: string
  readonly graphicAlt: string
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const en: Messages = {
  languageName: "English",
  locale: "en",
  title: "My AI collaboration profile",
  switchLabel: "Language",
  period: (from, to) => `${from} – ${to}`,
  coverage: (p, s) => `${p.toLocaleString("en")} prompts · ${s.toLocaleString("en")} sessions`,
  sampled: (a, t) => `${a} of ${t} weeks sampled`,
  totalPrompts: "Prompts",
  activeDays: "Active days",
  longestStreak: "Longest streak",
  peakHour: "Peak hour",
  days: (n) => plural(n, "day", "days"),
  byHour: "Prompts by hour",
  byHourNote: (peak, latest) => `Busiest at ${peak} · latest ${latest}`,
  byWeekday: "Prompts by weekday",
  weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  languageMix: "Prompt language",
  languageNames: { zh: "Chinese", en: "English", mixed: "Mixed" },
  sources: "Where you prompt",
  origins: "How",
  originNames: { interactive: "Typed", sdk: "App / SDK", exec: "Scripted", unknown: "Other" },
  habits: "Habits",
  correctionRate: "Corrections",
  imageRate: "With images",
  promptLength: "Prompt length",
  median: "median",
  p90: "longest 10%",
  characters: (n) => `${n.toLocaleString("en")} chars`,
  heatmap: "Weekly rhythm",
  heatmapNote: "Weekday × hour, darker = more prompts",
  traits: "Traits",
  confidence: { high: "High confidence", medium: "Medium confidence", low: "Low confidence" },
  showEvidence: (n) => `${plural(n, "quote", "quotes")} as evidence`,
  dimensions: "Five dimensions",
  dimensionNames: {
    work_style: "Work style",
    communication: "Communication",
    tech_profile: "Tech profile",
    interests: "Interests",
    growth: "Growth",
  },
  evidenceCount: (n) => plural(n, "quote", "quotes"),
  noEvidence: "No verified evidence",
  insufficientEvidence: "Insufficient evidence: no quote in this summary passed verification.",
  funFacts: "Fun facts",
  about: "About this report",
  engine: (r, m) => `Engine: ${r}${m ? ` (${m})` : ""}`,
  generatedAt: (at) => `Generated: ${at}`,
  evidenceVerified: (k, d) =>
    `${k} pieces of evidence verified${d > 0 ? ` (${d} invalid or duplicate quotes removed)` : ""}`,
  chunksSkipped: (n) =>
    `${n} chunk${n === 1 ? "" : "s"} failed and ${n === 1 ? "was" : "were"} skipped`,
  privacy:
    "Privacy: prompts are read only on your machine; after redaction they are analysed with your own Claude Code / Codex account. This report is never uploaded.",
  project: "prompt-profile",
  none: "—",
  madeFrom: "Made from my prompts.",
  cardPrompts: "prompts",
  cardStreak: "longest streak",
  cardLatest: "latest session",
  cardPeak: "peak hour",
  graphicAlt: "Prompts by hour of day",
}

const zhTW: Messages = {
  languageName: "中文",
  locale: "zh-TW",
  title: "我的 AI 協作側寫",
  switchLabel: "語言",
  period: (from, to) => `${from} – ${to}`,
  coverage: (p, s) =>
    `${p.toLocaleString("zh-TW")} 則 prompt · ${s.toLocaleString("zh-TW")} 個 session`,
  sampled: (a, t) => `抽樣分析 ${a} / ${t} 週`,
  totalPrompts: "prompt 數",
  activeDays: "活躍天數",
  longestStreak: "最長連續",
  peakHour: "最活躍時段",
  days: (n) => `${n} 天`,
  byHour: "各時段的 prompt",
  byHourNote: (peak, latest) => `最忙 ${peak} · 最晚 ${latest}`,
  byWeekday: "星期分布",
  weekdays: ["一", "二", "三", "四", "五", "六", "日"],
  languageMix: "prompt 語言",
  languageNames: { zh: "中文", en: "英文", mixed: "混合" },
  sources: "在哪裡寫 prompt",
  origins: "方式",
  originNames: { interactive: "手動輸入", sdk: "App / SDK", exec: "腳本", unknown: "其他" },
  habits: "習慣",
  correctionRate: "糾正 AI",
  imageRate: "附圖片",
  promptLength: "prompt 長度",
  median: "中位數",
  p90: "最長的 10%",
  characters: (n) => `${n.toLocaleString("zh-TW")} 字`,
  heatmap: "一週節奏",
  heatmapNote: "星期 × 時段，顏色越深代表 prompt 越多",
  traits: "特質",
  confidence: { high: "高信心", medium: "中信心", low: "低信心" },
  showEvidence: (n) => `${n} 段引文佐證`,
  dimensions: "五個面向",
  dimensionNames: {
    work_style: "工作風格",
    communication: "溝通",
    tech_profile: "技術輪廓",
    interests: "興趣",
    growth: "成長",
  },
  evidenceCount: (n) => `${n} 段引文`,
  noEvidence: "沒有通過驗證的證據",
  insufficientEvidence: "證據不足：這段摘要沒有通過驗證的原文引用，僅供參考。",
  funFacts: "有趣的事實",
  about: "關於這份報告",
  engine: (r, m) => `分析引擎：${r}${m ? `（${m}）` : ""}`,
  generatedAt: (at) => `產生時間：${at}`,
  evidenceVerified: (k, d) =>
    `已驗證 ${k} 段證據${d > 0 ? `（移除 ${d} 段無效或重複的引文）` : ""}`,
  chunksSkipped: (n) => `${n} 段分析失敗，已略過`,
  privacy:
    "隱私：prompt 只在你的電腦上讀取；遮蔽敏感資訊後，才用你自己的 Claude Code / Codex 帳號分析。這份報告不會被上傳。",
  project: "prompt-profile",
  none: "—",
  madeFrom: "用我的 prompt 做成。",
  cardPrompts: "則 prompt",
  cardStreak: "最長連續",
  cardLatest: "最晚的 session",
  cardPeak: "最活躍時段",
  graphicAlt: "各時段的 prompt 數",
}

/** Every text of the report and the card, per language. */
export const MESSAGES: Record<Language, Messages> = { en, "zh-TW": zhTW }
