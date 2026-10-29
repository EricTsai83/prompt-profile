import type { Confidence, DimensionKey, Language } from "../domain/Profile.ts"
import type { PromptTechnique, ToolTechnique } from "../domain/Techniques.ts"

export interface Messages {
  /** Name of the language in its own script, for the switch. */
  readonly languageName: string
  /** BCP 47 tag for `lang` attributes and Intl formatting. */
  readonly locale: string
  readonly title: string
  readonly switchLabel: string
  readonly period: (from: string, to: string) => string
  readonly dataPeriod: string
  readonly generated: string
  readonly analyzed: string
  readonly leftOut: (parts: string) => string
  readonly months: (n: number) => string
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
  readonly daily: string
  readonly dailyNote: string
  readonly less: string
  readonly more: string
  readonly prompts: (n: number) => string
  readonly projects: string
  readonly projectsNote: string
  readonly projectsByWeek: string
  readonly other: string
  readonly weekOf: (date: string) => string
  readonly cellTip: (weekday: string, hour: string) => string
  readonly hourTip: (hour: string, n: number) => string
  readonly signature: string
  readonly nightShare: string
  readonly nightShareDef: string
  readonly medianPrompt: string
  readonly medianPromptDef: string
  readonly corrections: (every: number | null) => string
  readonly correctionsLabel: string
  readonly correctionsDef: string
  readonly perSession: string
  readonly perSessionDef: string
  readonly chronotype: (from: string, to: string) => string
  readonly chronotypeShare: (pct: number) => string
  readonly rhythm: string
  readonly volume: (prompts: number, days: number, streak: number) => string
  readonly chapters: string
  readonly chapterRange: (from: string, to: string) => string
  readonly moreTraits: string
  readonly supportUnknown: string
  readonly support: (sessions: number, weeks: number, quotes: number) => string
  readonly howMeasured: string
  readonly projectAnon: string
  readonly cardActive: string
  readonly coaching: string
  readonly coachingNote: string
  readonly before: string
  readonly after: string
  readonly suggested: string
  readonly signalsTitle: string
  readonly techniques: string
  readonly techniquesNote: string
  readonly workflow: string
  readonly promptCraft: string
  readonly ofSessions: (pct: number) => string
  readonly ofPrompts: (pct: number) => string
  readonly sessionsUsed: (n: number) => string
  readonly parallel: (max: number, days: number) => string
  readonly since: (month: string) => string
  readonly moreCount: (n: number) => string
  readonly unitSessions: string
  readonly unitPrompts: string
  readonly growing: string
  readonly coverageNote: (sessions: number) => string
  readonly noData: string
  readonly adoption: string
  readonly stages: Record<
    "plan" | "delegate" | "extend" | "verify" | "ship",
    readonly [name: string, question: string]
  >
  readonly skillsUsed: string
  readonly subagentTypes: string
  readonly mcpServers: string
  readonly modelsUsed: string
  readonly customSkills: (n: number) => string
  readonly customAgents: (n: number) => string
  readonly customServers: (n: number) => string
  readonly noDescription: string
  readonly usedRange: (sessions: number, from: string, to: string) => string
  readonly origin: Record<"builtin" | "plugin" | "personal" | "project" | "unknown", string>
  readonly sinceLast: (date: string) => string
  readonly lastSuggestions: string
  readonly correctionsShare: string
  readonly terseLabel: string
  readonly nightLabel: string
  readonly toolNames: Record<ToolTechnique, readonly [name: string, definition: string]>
  readonly promptNames: Record<PromptTechnique, readonly [name: string, definition: string]>
  readonly signal: {
    readonly corrections: (rate: number) => readonly [string, string]
    readonly terse: (share: number) => readonly [string, string]
    readonly longSessions: (share: number) => readonly [string, string]
    readonly reusedOpenings: (openings: number, sessions: number) => readonly [string, string]
  }
}

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en")} ${n === 1 ? one : many}`

const en: Messages = {
  languageName: "English",
  locale: "en",
  title: "My AI collaboration profile",
  switchLabel: "Language",
  period: (from, to) => `${from} – ${to}`,
  dataPeriod: "Data period",
  generated: "Generated",
  analyzed: "Analyzed",
  leftOut: (parts) => `Left out: ${parts}`,
  months: (n) => plural(n, "month", "months"),
  coverage: (p, s) => `${plural(p, "prompt", "prompts")} · ${plural(s, "session", "sessions")}`,
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
  origins: "Client",
  originNames: {
    interactive: "Terminal",
    sdk: "Desktop app / SDK",
    exec: "Scripted",
    unknown: "Other",
  },
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
    "Privacy: prompts were read, cleaned and redacted on this computer. Selected redacted prompts were then sent through the logged-in Claude Code or Codex CLI to its model service, using that subscription's quota (no API key). prompt-profile never uploads this report.",
  project: "prompt-profile",
  none: "—",
  madeFrom: "Made from my prompts.",
  cardPrompts: "prompts",
  cardStreak: "longest streak",
  cardLatest: "latest session",
  cardPeak: "peak hour",
  graphicAlt: "Prompts by hour of day",
  daily: "Every day",
  dailyNote: "One square per day; darker = more prompts",
  less: "Less",
  more: "More",
  prompts: (n) => plural(n, "prompt", "prompts"),
  projects: "Projects",
  projectsNote: "Top projects by prompts (folder names)",
  projectsByWeek: "Projects by week",
  other: "Other folders",
  weekOf: (d) => `Week of ${d}`,
  cellTip: (w, h) => `${w} ${h}`,
  hourTip: (h, n) => `${h} · ${plural(n, "prompt", "prompts")}`,
  signature: "Measured signature",
  nightShare: "at night",
  nightShareDef: "Share of prompts sent between 22:00 and 04:59",
  medianPrompt: "typical prompt",
  medianPromptDef: "Median prompt length in characters, after cleaning",
  corrections: (e) => (e === null ? "none" : `1 in ${e}`),
  correctionsLabel: "prompts corrects the AI",
  correctionsDef: "Prompts that push back on the AI's answer (e.g. \"no, that's wrong\")",
  perSession: "prompts per session",
  perSessionDef: "Average number of prompts in one conversation",
  chronotype: (a, b) => `Most active ${a}–${b}`,
  chronotypeShare: (p) => `${p}% of prompts in these four hours`,
  rhythm: "Rhythm",
  volume: (p, d, st) =>
    `${p.toLocaleString("en")} prompts on ${plural(d, "day", "days")} · longest streak ${plural(st, "day", "days")}`,
  chapters: "Chapters",
  chapterRange: (a, b) => (a === b ? a : `${a} – ${b}`),
  moreTraits: "More traits",
  supportUnknown:
    "Session spread is unavailable for these selected quotes; confidence is a model estimate.",
  support: (se, w, q) =>
    `Selected evidence: ${plural(q, "quote", "quotes")} from ${plural(se, "session", "sessions")} in ${plural(w, "week", "weeks")}; not full-history frequencies. Context and exceptions are in the quoted prompts.`,
  howMeasured: "How this was measured",
  projectAnon: "Project",
  cardActive: "most active",
  coaching: "Improve your prompts",
  coachingNote: "From your own prompts; each suggestion cites what it is based on",
  before: "You wrote",
  after: "Try",
  suggested: "Suggested rewrite",
  signalsTitle: "Signals worth a look",
  techniques: "How I work with AI",
  techniquesNote:
    "Tool records show activity; prompt wording shows requests. Neither proves expertise or completed work. Hover for individual definitions.",
  workflow: "Workflow",
  promptCraft: "Prompt craft",
  ofSessions: (p) => `${p}% of sessions`,
  ofPrompts: (p) => `${p}% of prompts`,
  sessionsUsed: (n) => plural(n, "session", "sessions"),
  parallel: (m, d) => `Up to ${m} sessions at once · parallel on ${plural(d, "day", "days")}`,
  since: (m) => `since ${m}`,
  moreCount: (n) => `${n} more`,
  unitSessions: "share of sessions",
  unitPrompts: "share of prompts",
  growing: "growing fastest",
  noData: "no transcripts kept",
  adoption: "Adoption over time",
  stages: {
    plan: ["Plan", "Does the work start from a plan?"],
    delegate: ["Delegate", "How much is handed to agents, and how?"],
    extend: ["Extend", "Which skills and tools extend the agent?"],
    verify: ["Verify", "Is the AI given context and asked to check its work?"],
    ship: ["Ship", "Does the work end in a pull request?"],
  },
  skillsUsed: "Skills used",
  subagentTypes: "Subagent types",
  mcpServers: "MCP servers",
  modelsUsed: "Models",
  customSkills: (n) => `${n} custom ${n === 1 ? "skill" : "skills"}`,
  customAgents: (n) => `${n} custom ${n === 1 ? "agent type" : "agent types"}`,
  customServers: (n) => `${n} private ${n === 1 ? "server" : "servers"}`,
  noDescription: "No description found",
  usedRange: (n, a, b) => `${plural(n, "session", "sessions")} · ${a === b ? a : `${a} – ${b}`}`,
  origin: {
    builtin: "built-in",
    plugin: "plugin",
    personal: "my skill",
    project: "project skill",
    unknown: "skill",
  },
  coverageNote: (n) =>
    `Workflow shares cover the ${plural(n, "session", "sessions")} whose transcripts are still on disk (Claude Code deletes old ones)`,
  sinceLast: (d) => `Since your last report (${d})`,
  lastSuggestions: "Suggested last time",
  correctionsShare: "Prompts that correct the AI",
  terseLabel: "Very short prompts",
  nightLabel: "Prompts at night",
  toolNames: {
    subagents: [
      "Delegates to subagents",
      "Sessions where the agent started subagents (Agent / Task tools)",
    ],
    skills: ["Uses skills", "Sessions that invoked a Claude Code skill"],
    planMode: [
      "Plans in plan mode",
      "Prompts sent in plan mode, or plan mode entered by the agent",
    ],
    mcp: ["Connects MCP tools", "Sessions that called a tool from an MCP server"],
    web: ["Researches the web", "Sessions with web search or web fetch"],
    background: [
      "Runs background work",
      "Sessions with monitors, scheduled wake-ups or cron tasks",
    ],
    askUser: ["Lets the agent ask", "Sessions where the agent asked a structured question"],
    worktrees: ["Isolates work in worktrees", "Sessions that used a git worktree"],
    pullRequests: ["Ships pull requests", "Pull requests linked from sessions"],
  },
  promptNames: {
    planFirst: ["Plans first", "Asks for a plan, steps or an outline"],
    context: ["Gives error context", "Includes an error, a failure or pasted code"],
    filePaths: ["Names files", "Mentions a file or path"],
    constraints: ["States constraints", "Says what not to do or what must stay"],
    acceptance: ["Defines done", "States the expected result"],
    examples: ["Gives examples", "Shows an example of what is wanted"],
    verification: ["Asks for verification", "Asks for tests or a check"],
    structured: ["Structures requests", "Uses a numbered or bulleted list"],
    whyExplain: ["Asks why", "Asks for an explanation"],
    outputFormat: ["Specifies the format", "Asks for a table, JSON, Markdown or another format"],
  },
  signal: {
    corrections: (r) => [
      `1 in ${Math.round(1 / r)} prompts corrects the AI`,
      "Most corrections add something you already knew: put the expected result and the constraints in the first prompt.",
    ],
    terse: (x) => [
      `${Math.round(x * 100)}% of prompts are under ~4 words`,
      "Follow-ups like “fix it” make the AI guess. Name the file, the error and what “done” looks like.",
    ],
    longSessions: (x) => [
      `${Math.round(x * 100)}% of sessions run past 40 prompts`,
      "Long conversations carry stale context. Start a new session (or /clear) when the task changes.",
    ],
    reusedOpenings: (o, se) => [
      `${o} ${o === 1 ? "opening starts" : "openings start"} ${se} sessions`,
      "If you type these yourself, save them as a slash command, a skill or a CLAUDE.md / AGENTS.md note.",
    ],
  },
}

const zhTW: Messages = {
  languageName: "中文",
  locale: "zh-TW",
  title: "我的 AI 協作側寫",
  switchLabel: "語言",
  period: (from, to) => `${from} – ${to}`,
  dataPeriod: "資料區間",
  generated: "產生時間",
  analyzed: "分析內容",
  leftOut: (parts) => `未列入：${parts}`,
  months: (n) => `${n} 個月`,
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
  origins: "使用的工具",
  originNames: { interactive: "終端機", sdk: "桌面 App / SDK", exec: "腳本", unknown: "其他" },
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
    "隱私：prompt 在這台電腦上讀取、清理並遮蔽敏感資訊；選出的 prompt 遮蔽後，才透過已登入的 Claude Code 或 Codex CLI 送到它的模型服務分析，使用該訂閱方案的額度（不需要 API key）。prompt-profile 不會上傳這份報告。",
  project: "prompt-profile",
  none: "—",
  madeFrom: "用我的 prompt 做成。",
  cardPrompts: "則 prompt",
  cardStreak: "最長連續",
  cardLatest: "最晚的 session",
  cardPeak: "最活躍時段",
  graphicAlt: "各時段的 prompt 數",
  daily: "每一天",
  dailyNote: "每格代表一天，顏色越深代表 prompt 越多",
  less: "少",
  more: "多",
  prompts: (n) => `${n.toLocaleString("zh-TW")} 個 prompt`,
  projects: "專案",
  projectsNote: "依 prompt 數排序的專案（資料夾名稱）",
  projectsByWeek: "每週的專案分布",
  other: "其他資料夾",
  weekOf: (d) => `${d} 那一週`,
  cellTip: (w, h) => `週${w} ${h}`,
  hourTip: (h, n) => `${h} · ${n.toLocaleString("zh-TW")} 個 prompt`,
  signature: "量出來的特徵",
  nightShare: "在深夜",
  nightShareDef: "22:00 到 04:59 之間送出的 prompt 比例",
  medianPrompt: "典型 prompt 長度",
  medianPromptDef: "清理後 prompt 長度的中位數（字元）",
  corrections: (e) => (e === null ? "沒有" : `每 ${e} 則`),
  correctionsLabel: "prompt 就有一次糾正 AI",
  correctionsDef: "反駁 AI 回答的 prompt，例如「不對」「錯了」",
  perSession: "每個 session 的 prompt 數",
  perSessionDef: "一次對話平均有幾則 prompt",
  chronotype: (a, b) => `最活躍在 ${a}–${b}`,
  chronotypeShare: (p) => `${p}% 的 prompt 集中在這四小時`,
  rhythm: "節奏",
  volume: (p, d, st) => `${d} 天裡寫了 ${p.toLocaleString("zh-TW")} 個 prompt · 最長連續 ${st} 天`,
  chapters: "章節",
  chapterRange: (a, b) => (a === b ? a : `${a} – ${b}`),
  moreTraits: "其他特質",
  supportUnknown: "這些所選引文的對話分布未知；信心程度是模型的估計。",
  support: (se, w, q) =>
    `所選證據：${q} 段引文，來自 ${se} 個對話、${w} 週；不代表完整歷史中的頻率。情境與例外請參照引文。`,
  howMeasured: "這份報告怎麼量的",
  projectAnon: "專案",
  cardActive: "最活躍時段",
  coaching: "讓 prompt 更好",
  coachingNote: "來自你自己的 prompt；每個建議都標出根據",
  before: "你寫的",
  after: "可以試試",
  suggested: "建議的寫法",
  signalsTitle: "值得注意的訊號",
  techniques: "我怎麼用 AI",
  techniquesNote:
    "工具紀錄顯示活動，提示文字顯示要求；兩者都不能證明專業程度或工作已完成。滑過各項可查看定義。",
  workflow: "工作流程",
  promptCraft: "prompt 寫法",
  ofSessions: (p) => `${p}% 的 session`,
  ofPrompts: (p) => `${p}% 的 prompt`,
  sessionsUsed: (n) => `${n.toLocaleString("zh-TW")} 個 session`,
  parallel: (m, d) => `最多同時 ${m} 個 session · ${d} 天平行作業`,
  since: (m) => `從 ${m} 開始`,
  moreCount: (n) => `另外 ${n} 項`,
  unitSessions: "佔 session 的比例",
  unitPrompts: "佔 prompt 的比例",
  growing: "成長最快",
  noData: "沒有保留紀錄",
  adoption: "隨時間的採用情況",
  stages: {
    plan: ["規劃", "工作是不是從計畫開始？"],
    delegate: ["委派", "交給 agent 多少、怎麼交？"],
    extend: ["擴充", "用了哪些 skills 和工具擴充 agent？"],
    verify: ["驗證", "有沒有給 AI 足夠脈絡、要求它檢查？"],
    ship: ["交付", "工作是不是以 pull request 收尾？"],
  },
  skillsUsed: "用過的 skills",
  subagentTypes: "子代理類型",
  mcpServers: "MCP server",
  modelsUsed: "模型",
  customSkills: (n) => `${n} 個自訂 skill`,
  customAgents: (n) => `${n} 種自訂代理`,
  customServers: (n) => `${n} 個私有 server`,
  noDescription: "找不到說明",
  usedRange: (n, a, b) => `${n} 個 session · ${a === b ? a : `${a} – ${b}`}`,
  origin: {
    builtin: "內建",
    plugin: "plugin",
    personal: "我的 skill",
    project: "專案 skill",
    unknown: "skill",
  },
  coverageNote: (n) =>
    `工作流程的比例只涵蓋還保留完整紀錄的 ${n} 個 session（Claude Code 會刪除舊紀錄）`,
  sinceLast: (d) => `跟上次報告比（${d}）`,
  lastSuggestions: "上次的建議",
  correctionsShare: "糾正 AI 的 prompt",
  terseLabel: "太短的 prompt",
  nightLabel: "深夜的 prompt",
  toolNames: {
    subagents: ["委派子代理", "agent 啟動子代理（Agent / Task 工具）的 session"],
    skills: ["使用 skills", "呼叫了 Claude Code skill 的 session"],
    planMode: ["用 plan 模式規劃", "在 plan 模式下送出的 prompt，或 agent 進入 plan 模式"],
    mcp: ["串接 MCP 工具", "呼叫了 MCP server 工具的 session"],
    web: ["上網查資料", "有網路搜尋或抓取網頁的 session"],
    background: ["跑背景任務", "有監控、排程喚醒或 cron 任務的 session"],
    askUser: ["讓 agent 反問", "agent 提出結構化問題的 session"],
    worktrees: ["用 worktree 隔離工作", "使用 git worktree 的 session"],
    pullRequests: ["發 pull request", "session 中連結的 pull request"],
  },
  promptNames: {
    planFirst: ["先規劃", "要求計畫、步驟或大綱"],
    context: ["附上錯誤脈絡", "附上錯誤、失敗訊息或貼上程式碼"],
    filePaths: ["指出檔案", "提到檔案或路徑"],
    constraints: ["說明限制", "說明不要做什麼、什麼要保留"],
    acceptance: ["定義完成", "寫出預期結果"],
    examples: ["給範例", "提供想要的範例"],
    verification: ["要求驗證", "要求寫測試或檢查"],
    structured: ["條列需求", "使用編號或條列"],
    whyExplain: ["問為什麼", "要求解釋"],
    outputFormat: ["指定格式", "要求表格、JSON、Markdown 等格式"],
  },
  signal: {
    corrections: (r) => [
      `每 ${Math.round(1 / r)} 則 prompt 就有一次糾正 AI`,
      "多數糾正補上的是你早就知道的事：把預期結果和限制寫在第一個 prompt。",
    ],
    terse: (x) => [
      `${Math.round(x * 100)}% 的 prompt 不到四個字詞`,
      "像「改一下」這樣的追問會讓 AI 用猜的。寫出檔案、錯誤訊息，以及怎樣才算完成。",
    ],
    longSessions: (x) => [
      `${Math.round(x * 100)}% 的 session 超過 40 則 prompt`,
      "對話太長會累積過時的脈絡。換任務時開新的 session（或 /clear）。",
    ],
    reusedOpenings: (o, se) => [
      `${o} 種開頭重複用在 ${se} 個 session`,
      "如果這些是你自己打的，把它們存成 slash command、skill，或寫進 CLAUDE.md / AGENTS.md。",
    ],
  },
}

/** Every text of the report and the card, per language. */
export const MESSAGES: Record<Language, Messages> = { en, "zh-TW": zhTW }

/** Copy for the original collaboration portrait, independent of generated prose. */
export const PORTRAIT_MESSAGES = {
  en: {
    title: "A portrait of collaboration",
    preferences: "Observed collaboration preferences",
    note: "Preferences observed in these conversations, not a psychological assessment or an ability score. Both ways of working on a line can be characteristic, each in its own kind of task or project.",
    supporting: "Supporting patterns, activity and practical suggestions",
    notObserved: "Not seen in two or more conversations yet",
    both: "Both, depending on the context",
    seenIn: (n: number) => `in ${n} ${n === 1 ? "conversation" : "conversations"}`,
    seenOnce: "seen in one conversation only, not counted as characteristic yet",
    axes: {
      framing: ["Starting point", "Define first", "Explore first"],
      pacing: ["Pace", "Step by step", "Whole task"],
      control: ["Decision ownership", "Direct", "Delegate"],
      closure: ["Convergence", "Check criteria", "Refine results"],
    },
  },
  "zh-TW": {
    title: "一個人如何與 AI 共事",
    preferences: "對話中展現的協作偏好",
    note: "這些偏好來自觀察到的對話，並非心理測驗或能力評分。同一條線的兩種做法都可能是這個人的特色，各自出現在不同的任務或專案中。",
    supporting: "更多行為證據、使用紀錄與實用建議",
    notObserved: "尚未在兩段以上的對話中看到",
    both: "兩種都有，視情境而定",
    seenIn: (n: number) => `出現在 ${n} 段對話`,
    seenOnce: "只在一段對話中看到，尚不算特色",
    axes: {
      framing: ["起手方式", "先定義", "先探索"],
      pacing: ["推進節奏", "分步推進", "整包交付"],
      control: ["決策分工", "主導", "授權"],
      closure: ["收斂方式", "規格驗收", "逐步打磨"],
    },
  },
} as const

/** Navigation and chart labels for the report's two reading views. */
export const VIEW_MESSAGES = {
  en: {
    navigation: "Report views",
    overview: "Who they are",
    detail: "Facts & evidence",
    overviewTitle: "Meet the collaborator",
    detailTitle: "What the records show",
    overviewNote:
      "An introduction built from selected observations with medium or high confidence. Quotes are the person’s own prompts. Every measurement, source and unknown is on the Facts & evidence page.",
    detailNote:
      "Every measurement with its source and denominator, all observations with their evidence, and what remains unknown. Evidence is expanded by default.",
    next: "See the facts and evidence →",
    back: "← Back to the introduction",
    moves: "Featured observations, in their own words",
    movesNote:
      "Up to three observations with medium or high confidence and a verified quote, each shown with one of the person’s own prompts. They are not ranked by strength. Confidence and the remaining evidence are on the Facts & evidence page.",
    noMoves:
      "No observation has medium or high confidence with a verified quote, so none is featured here. The Facts & evidence page lists every observation with its confidence.",
    preferenceEvidence: "Evidence for each preference",
    tools: "Which tools appear in conversations?",
    promptTechniques: "What do the prompts ask for?",
    toolsNote:
      "A session is one recorded conversation. Tool records describe agent activity, not the person’s ability. Categories overlap; percentages need not add to 100%.",
    promptsNote:
      "Rules detect wording in prompts after cleaning removes injected content. Categories overlap; a match is not a quality grade or proof the request was completed.",
    noTools: "0 sessions have tool metadata. Tool use is unknown, not zero.",
    missingTechniques:
      "Technique measurements are not stored in this profile. Tool use and prompt patterns are unknown.",
    noPrompts: "No cleaned prompts are available. There is no denominator for these percentages.",
    toolCoverage: (covered: number, total: number) =>
      `Source: local tool records. ${covered} of ${total} sessions have metadata. Each value shows the percentage and sessions using that tool / covered sessions. Uncovered sessions are unknown.`,
    promptCoverage: (n: number) =>
      `Source: wording rules applied to ${n} cleaned prompts (the denominator). Each value is the share matching that rule. Exact matching prompt counts are not stored; percentages are rounded.`,
    first: "Observed preference",
    noPortrait:
      "A collaboration portrait is not available in this profile. The Facts & evidence page contains the available observations.",
  },
  "zh-TW": {
    navigation: "報告頁面",
    overview: "認識這個人",
    detail: "事實與證據",
    overviewTitle: "認識這位協作者",
    detailTitle: "紀錄呈現了什麼",
    overviewNote:
      "以中或高信心的精選觀察介紹這個人。引述都是本人寫下的提示。所有量測、來源與未知項目都在「事實與證據」頁。",
    detailNote:
      "每項量測都附來源與分母，每項觀察都附證據，也列出仍然未知的部分。證據預設展開，不必逐一點開。",
    next: "查看事實與證據 →",
    back: "← 回到人物介紹",
    moves: "精選觀察與本人原話",
    movesNote:
      "最多三項信心為中或高、且附有已驗證引述的觀察，各附一則本人寫下的提示，並未依強弱排序。信心程度與其餘證據列在「事實與證據」頁。",
    noMoves:
      "目前沒有信心為中或高、且附有已驗證引述的觀察，因此這裡不列出。「事實與證據」頁列出每項觀察與其信心程度。",
    preferenceEvidence: "每項偏好的證據",
    tools: "對話中出現哪些工具？",
    promptTechniques: "提示中提出哪些要求？",
    toolsNote:
      "一個 session 是一段對話紀錄。工具紀錄呈現 AI 助手的活動，不代表使用者的能力。類別可重疊，百分比不必合計為 100%。",
    promptsNote:
      "先移除注入內容，再以規則偵測提示文字。類別可重疊；符合規則不代表品質較好，也不代表要求已完成。",
    noTools: "有工具紀錄的對話為 0 段。工具使用情況未知，並非沒有使用。",
    missingTechniques: "這份報告未儲存技巧量測資料，工具使用與提示模式皆未知。",
    noPrompts: "沒有清理後的提示，無法計算這些百分比。",
    toolCoverage: (covered: number, total: number) =>
      `來源：本機工具紀錄。共 ${total} 段對話，其中 ${covered} 段有工具紀錄。每項列出比例，以及使用該工具的對話數／有紀錄的對話數。其餘對話的使用情況未知。`,
    promptCoverage: (n: number) =>
      `來源：以文字規則檢查 ${n} 則清理後提示，以此為分母。每項數值是符合該規則的比例。報告未儲存各項符合的確切則數，百分比經過四捨五入。`,
    first: "觀察到的偏好",
    noPortrait: "這份 profile 尚未包含協作側寫；「事實與證據」頁仍可閱讀既有的觀察與證據。",
  },
} as const

/**
 * A profile with limited evidence (plan 24, `evidence.ts`): fixed text replaces the generated
 * role, and the hero states what is left out and why.
 */
export const LIMITED_MESSAGES = {
  en: {
    title: "Early observations",
    headline: "Not enough verified evidence yet for a collaboration role.",
    body: (prompts: number, sessions: number) =>
      `Based on ${plural(prompts, "prompt", "prompts")} in ${plural(sessions, "session", "sessions")}. A role, featured observations and prompt coaching each need verified quotes from at least two sessions; none has that yet, so they are left out. The observations and measurements below are what the records support. A longer --since range or more history adds evidence.`,
  },
  "zh-TW": {
    title: "初步觀察",
    headline: "已驗證的證據還不足以描述協作角色。",
    body: (prompts: number, sessions: number) =>
      `根據 ${prompts.toLocaleString("zh-TW")} 則提示、${sessions.toLocaleString("zh-TW")} 段對話。協作角色、精選觀察與提示建議都需要至少兩段對話中經過驗證的引述，目前都還不足，因此不列出。以下的觀察與量測是紀錄能支持的內容；改用更長的 --since 範圍或累積更多紀錄，就能增加證據。`,
  },
} as const

/**
 * The "Usage during this period" section (plan 23). Every amount is an API list-price
 * equivalent, never what the person paid; usage is described, never ranked or praised.
 */
export const USAGE_MESSAGES = {
  en: {
    title: "Usage during this period",
    note: (period: string, version: string) =>
      `${period}. Source: local Claude Code and Codex logs, read on this computer. Amounts are API list-price equivalents in USD (price table ${version}): what this usage would cost on the public API, not what was paid. Subscriptions are not billed per token.`,
    notMeasured:
      "Not measured. This profile was made before usage was recorded; this is not zero. Analyse again to add it.",
    nothing: "No model responses were found in the local logs for this period.",
    noneForTool: "No model responses found in this period.",
    plan: "Plan",
    planUnknown: "Unknown (the tool did not report it)",
    planApiKey: "API key login",
    planHint: (detail: string) => `local hint: ${detail}`,
    totalTokens: "Tokens",
    responses: "Model responses",
    cost: "API list-price equivalent",
    costUnknown: "Unknown (no list price)",
    costPartial: (amount: string, n: string) => `${amount} + ${n} unpriced responses`,
    kinds: {
      input: "Input",
      output: "Output",
      cacheRead: "Cache reads",
      cacheWrite5m: "Cache writes (5 min)",
      cacheWrite1h: "Cache writes (1 h)",
      cacheWriteUnknown: "Cache writes (duration unknown)",
      reasoning: "of which reasoning",
    },
    kindsNote: "Tokens by kind. Reasoning is part of output and is not counted twice.",
    fast: (n: string) =>
      `${n} responses ran in fast mode (Codex priority) and are priced at fast-mode rates.`,
    unpriced: (models: string) =>
      `No list price for ${models}: their tokens are shown, their cost is left out, never estimated from another model.`,
    unreadable: (files: number, lines: number) =>
      `${[
        files > 0 ? `${files} log ${files === 1 ? "file" : "files"} could not be read` : null,
        lines > 0
          ? `${lines} unreadable usage ${lines === 1 ? "line was" : "lines were"} skipped`
          : null,
      ]
        .filter((x) => x !== null)
        .join(" and ")}: totals may be lower than the real usage.`,
    share: "Share between the tools",
    shareTokens: "Tokens",
    shareCost: "API list-price equivalent",
    byMonth: "By month",
    byModel: "By model",
    month: "Month",
    tool: "Tool",
    model: "Model",
    unknownModel: "Not recorded",
    monthNote: (zone: string) => `Months in ${zone}.`,
  },
  "zh-TW": {
    title: "這段期間的用量",
    note: (period: string, version: string) =>
      `${period}。來源：在這台電腦上讀取的本機 Claude Code 與 Codex 紀錄。金額為美元計的 API 牌價等值（價格表 ${version}）：表示這些用量若走公開 API 的費用，並非實際支付的金額；訂閱方案不按 token 計費。`,
    notMeasured: "未測量。這份 profile 產生時尚未記錄用量，這不代表用量為零。重新分析即可加入。",
    nothing: "本機紀錄中找不到這段期間的模型回應。",
    noneForTool: "這段期間找不到模型回應。",
    plan: "方案",
    planUnknown: "未知（工具未回報）",
    planApiKey: "API key 登入",
    planHint: (detail: string) => `本機提示：${detail}`,
    totalTokens: "Token 數",
    responses: "模型回應次數",
    cost: "API 牌價等值",
    costUnknown: "未知（沒有牌價）",
    costPartial: (amount: string, n: string) => `${amount}，另有 ${n} 次回應未計價`,
    kinds: {
      input: "輸入",
      output: "輸出",
      cacheRead: "快取讀取",
      cacheWrite5m: "快取寫入（5 分鐘）",
      cacheWrite1h: "快取寫入（1 小時）",
      cacheWriteUnknown: "快取寫入（時效未知）",
      reasoning: "其中推理",
    },
    kindsNote: "依種類列出 token。推理是輸出的一部分，不重複計算。",
    fast: (n: string) => `其中 ${n} 次回應使用快速模式（Codex priority），以快速模式牌價計算。`,
    unpriced: (models: string) =>
      `${models} 沒有牌價：仍列出其 token，但不計入費用，也不會借用其他模型的價格估算。`,
    unreadable: (files: number, lines: number) =>
      `${[
        files > 0 ? `有 ${files} 個紀錄檔無法讀取` : null,
        lines > 0 ? `${lines} 行無法解讀的用量紀錄被略過` : null,
      ]
        .filter((x) => x !== null)
        .join("、")}：總數可能低於實際用量。`,
    share: "兩個工具的占比",
    shareTokens: "Token 數",
    shareCost: "API 牌價等值",
    byMonth: "每月",
    byModel: "各模型",
    month: "月份",
    tool: "工具",
    model: "模型",
    unknownModel: "未記錄",
    monthNote: (zone: string) => `月份以 ${zone} 時區計算。`,
  },
} as const

/** Compact share-card copy; the detailed methodology remains in the HTML report. */
export const CARD_MESSAGES = {
  en: {
    activity: "Prompt activity",
    prompts: "Prompts",
    sessions: "Conversations",
    tokens: "Tokens",
    cost: "API estimate · USD",
    active: "Active days",
    streak: "Longest streak",
    missing: "Not measured",
    unknown: "Unknown",
    empty: "No responses",
    usage: "Usage",
    periodUnknown: "period unavailable",
    partial: "Partial pricing",
    incomplete: "Incomplete logs",
    attribution: "Made with prompt-profile",
  },
  "zh-TW": {
    activity: "Prompt 活動期間",
    prompts: "Prompt 數",
    sessions: "對話數",
    tokens: "Token 用量",
    cost: "API 估算 · 美元",
    active: "活躍天數",
    streak: "最長連續天數",
    missing: "未統計",
    unknown: "未知",
    empty: "無回覆紀錄",
    usage: "用量期間",
    periodUnknown: "期間不明",
    partial: "部分用量未計價",
    incomplete: "紀錄不完整",
    attribution: "由 prompt-profile 產生",
  },
} as const

/** The facts page's interaction episodes (plan 20 B): user turns only, results only when stated. */
export const EPISODE_MESSAGES = {
  en: {
    title: "How conversations unfolded",
    note: (selected: number, kept: number, analysed: number, total: number) =>
      `Showing ${selected} of ${kept} verified ${kept === 1 ? "episode" : "episodes"}, chosen to spread over time, conversations and kinds of task. They come from the ${analysed} analysed conversations, not all ${total} in the history.`,
    userOnly:
      "Only the user’s prompts are recorded: the assistant’s replies are not shown, and a result appears only when the user wrote it.",
    rejected: (n: number) =>
      `${n} proposed ${n === 1 ? "episode was" : "episodes were"} rejected: a turn was invented, misquoted, out of order or from another conversation.`,
    withdrawn: (n: number) =>
      `${n} stated ${n === 1 ? "result was" : "results were"} withdrawn because no prompt in the episode showed ${n === 1 ? "it" : "them"}.`,
    none: "No conversation in the analysed prompts showed more than a single request.",
    patterns: "Recurring across conversations",
    spread: (sessions: number, weeks: number) =>
      `In ${sessions} conversations across ${weeks} analysed ${weeks === 1 ? "period" : "periods"}`,
    shownIn: "Episodes",
    against: "Went the other way",
    conversation: (n: number, prompts: number) =>
      `Conversation ${n} · ${prompts} ${prompts === 1 ? "prompt" : "prompts"}`,
    split: "continues in another analysed part",
    turn: (turn: number, of: number) => `Prompt ${turn} of ${of}`,
    gap: (n: number) => `${n} ${n === 1 ? "prompt" : "prompts"} not shown`,
    earlier: (n: number) => `${n} earlier ${n === 1 ? "prompt" : "prompts"} not shown`,
    later: (n: number) => `${n} later ${n === 1 ? "prompt" : "prompts"} not shown`,
    ending: {
      unknown: () => "Result not visible in the record.",
      user_reported: (turn: number) => `The user reported the result in prompt ${turn}.`,
      abandoned: (turn: number) => `The user dropped this direction in prompt ${turn}.`,
    },
    roles: {
      ask: "Request",
      context: "Adds context",
      correct: "Correction",
      redirect: "Change of direction",
      verify: "Asks to check",
      close: "Wraps up",
    },
    taskTypes: {
      build: "New feature",
      fix: "Fixing a problem",
      change: "Changing existing work",
      explore: "Exploring",
      review: "Review or explanation",
      write: "Writing",
      operate: "Running or operating",
      other: "Other task",
    },
  },
  "zh-TW": {
    title: "對話如何展開",
    note: (selected: number, kept: number, analysed: number, total: number) =>
      `從 ${kept} 個通過驗證的片段中選出 ${selected} 個，盡量分散在不同時間、對話與任務類型。它們來自分析過的 ${analysed} 段對話，而非紀錄中全部的 ${total} 段。`,
    userOnly: "紀錄只有使用者寫下的提示：看不到 AI 的回覆，只有使用者自己寫出結果時才會顯示結果。",
    rejected: (n: number) =>
      `有 ${n} 個提出的片段未採用：其中有捏造、引述不符、順序錯亂或混入其他對話的提示。`,
    withdrawn: (n: number) => `有 ${n} 個聲稱的結果已撤回，因為片段中沒有任何提示呈現該結果。`,
    none: "分析過的提示中，沒有任何一段對話超出單一請求。",
    patterns: "在多段對話中反覆出現",
    spread: (sessions: number, weeks: number) => `出現在 ${sessions} 段對話、${weeks} 個分析時段`,
    shownIn: "片段",
    against: "反例",
    conversation: (n: number, prompts: number) => `第 ${n} 段對話 · 共 ${prompts} 則提示`,
    split: "這段對話也出現在其他分析區段",
    turn: (turn: number, of: number) => `第 ${turn}／${of} 則提示`,
    gap: (n: number) => `略過 ${n} 則提示`,
    earlier: (n: number) => `略過前面 ${n} 則提示`,
    later: (n: number) => `略過後面 ${n} 則提示`,
    ending: {
      unknown: () => "紀錄中看不到結果。",
      user_reported: (turn: number) => `使用者在第 ${turn} 則提示中回報結果。`,
      abandoned: (turn: number) => `使用者在第 ${turn} 則提示中放棄這個方向。`,
    },
    roles: {
      ask: "提出需求",
      context: "補充脈絡",
      correct: "修正方向",
      redirect: "改變方向",
      verify: "要求驗證",
      close: "收尾",
    },
    taskTypes: {
      build: "新功能",
      fix: "修正問題",
      change: "調整既有內容",
      explore: "探索研究",
      review: "審閱或說明",
      write: "撰寫文字",
      operate: "執行或維運",
      other: "其他任務",
    },
  },
} as const
