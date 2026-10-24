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
    "Privacy: prompts are read only on your machine; after redaction they are analysed with your own Claude Code / Codex account. This report is never uploaded.",
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
  support: (se, w, q) =>
    `${plural(q, "quote", "quotes")} from ${plural(se, "session", "sessions")} in ${plural(w, "week", "weeks")}`,
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
  techniquesNote: "Measured from tool metadata and prompt text; hover for definitions",
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
    "隱私：prompt 只在你的電腦上讀取；遮蔽敏感資訊後，才用你自己的 Claude Code / Codex 帳號分析。這份報告不會被上傳。",
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
  support: (se, w, q) => `${q} 段引文，來自 ${se} 個 session、${w} 週`,
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
  techniquesNote: "從工具中繼資料與 prompt 文字量出來；滑過看定義",
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
