import type { AnalyzeError } from "../analysis/errors.ts"
import type { InvalidProfile, Language, UnsupportedProfileVersion } from "../domain/Profile.ts"
import type { LlmError } from "../llm/LlmRunner.ts"
import type { FileError, InvalidArgument, NeedsConfirmation, NoData } from "./errors.ts"

export type AppError =
  | AnalyzeError
  | LlmError
  | NoData
  | NeedsConfirmation
  | InvalidArgument
  | FileError
  | UnsupportedProfileVersion
  | InvalidProfile

export const EXIT = {
  ok: 0,
  error: 1,
  usage: 2,
  noData: 3,
  noLlm: 4,
  rateLimited: 5,
  interrupted: 130,
} as const

export interface Rendered {
  readonly message: string
  readonly code: number
}

const CLI_NAME = { "claude-code": "Claude Code (claude)", codex: "Codex (codex)" } as const
const INSTALL =
  "Claude Code: https://claude.com/claude-code · Codex: https://github.com/openai/codex"

type Renderers = {
  readonly [K in AppError["_tag"]]: (
    error: Extract<AppError, { _tag: K }>,
    lang: Language,
  ) => Rendered
}

const zhOrEn = (lang: Language, zh: string, en: string) => (lang === "zh-TW" ? zh : en)

/**
 * Exhaustive: adding an error type without a message is a compile error.
 * Messages say what happened and what to do next; details only with --verbose.
 */
const RENDERERS: Renderers = {
  NoData: (e, lang) => ({
    code: EXIT.noData,
    message:
      e.reason === "empty"
        ? zhOrEn(
            lang,
            `找不到任何 prompt 資料。會去這些地方找：\n${e.locations.map((l) => `  - ${l}`).join("\n")}\n如果你的資料在別的位置，可以設定 CLAUDE_CONFIG_DIR 或 CODEX_HOME。`,
            `No prompt history found. Looked in:\n${e.locations.map((l) => `  - ${l}`).join("\n")}\nIf your data lives elsewhere, set CLAUDE_CONFIG_DIR or CODEX_HOME.`,
          )
        : zhOrEn(
            lang,
            "這個時間範圍內沒有可分析的 prompt。試試 --since 1y 或 --since all。",
            "No prompts to analyse in this time range. Try --since 1y or --since all.",
          ),
  }),
  NotInstalled: (_e, lang) => ({
    code: EXIT.noLlm,
    message: zhOrEn(
      lang,
      `需要安裝並登入 Claude Code 或 Codex 其中一個，才能分析 prompt。\n${INSTALL}\n不需要 LLM 的話，可以先用 \`prompt-profile stats\` 看統計數字。`,
      `prompt-profile needs Claude Code or Codex installed and logged in.\n${INSTALL}\nTo see statistics without an LLM, run \`prompt-profile stats\`.`,
    ),
  }),
  NotLoggedIn: (e, lang) => ({
    code: EXIT.noLlm,
    message: zhOrEn(
      lang,
      `${CLI_NAME[e.runner]} 已安裝但還沒登入。請先執行 ${e.runner === "codex" ? "`codex login`" : "`claude`（在裡面輸入 /login）"}，再重跑一次。`,
      `${CLI_NAME[e.runner]} is installed but not logged in. Run ${e.runner === "codex" ? "`codex login`" : "`claude` and use /login"}, then try again.`,
    ),
  }),
  RateLimited: (_e, lang) => ({
    code: EXIT.rateLimited,
    message: zhOrEn(
      lang,
      "撞到訂閱方案的速率限制了。已分析的部分都在快取中，稍後重跑會從中斷處繼續。",
      "Hit your plan's rate limit. Finished chunks are cached; run again later to continue where it stopped.",
    ),
  }),
  Timeout: (e, lang) => ({
    code: EXIT.error,
    message: zhOrEn(
      lang,
      `${CLI_NAME[e.runner]} 超過 ${Math.round(e.afterMs / 60000)} 分鐘沒有回應。已完成的段落都在快取中，可以直接重跑。`,
      `${CLI_NAME[e.runner]} did not answer within ${Math.round(e.afterMs / 60000)} minutes. Finished chunks are cached; just run again.`,
    ),
  }),
  InvalidOutput: (e, lang) => ({
    code: EXIT.error,
    message: zhOrEn(
      lang,
      `${CLI_NAME[e.runner]} 回傳的格式不正確（重試後仍失敗）。可以重跑一次，或用 --engine 換另一個 CLI。`,
      `${CLI_NAME[e.runner]} returned malformed output (after retries). Run again, or switch with --engine.`,
    ),
  }),
  ProcessFailed: (e, lang) => ({
    code: EXIT.error,
    message: zhOrEn(
      lang,
      `${CLI_NAME[e.runner]} 執行失敗（exit code ${e.exitCode ?? "?"}）：${e.detail || "沒有錯誤訊息"}。加上 --verbose 可以看到更多資訊。`,
      `${CLI_NAME[e.runner]} failed (exit code ${e.exitCode ?? "?"}): ${e.detail || "no error message"}. Use --verbose for details.`,
    ),
  }),
  Interrupted: (_e, lang) => ({
    code: EXIT.interrupted,
    message: zhOrEn(
      lang,
      "已中斷，重跑會從快取繼續。",
      "Interrupted. Run again to resume from the cache.",
    ),
  }),
  AnalysisFailed: (e, lang) => ({
    code: EXIT.error,
    message:
      e.reason === "no-prompts"
        ? zhOrEn(lang, "沒有可分析的 prompt。", "There are no prompts to analyse.")
        : e.reason === "too-many-chunk-failures"
          ? zhOrEn(
              lang,
              `${e.chunksTotal} 段中有 ${e.chunksFailed} 段分析失敗，結果不可靠，所以沒有產出報告。成功的段落已快取，可以重跑。`,
              `${e.chunksFailed} of ${e.chunksTotal} chunks failed, so no reliable report could be made. Successful chunks are cached; run again.`,
            )
          : zhOrEn(
              lang,
              "最後整合側寫時失敗了。各段的分析結果都在快取中，重跑只需要重做這一步。",
              "The final profile step failed. Chunk results are cached, so a re-run only repeats this step.",
            ),
  }),
  NeedsConfirmation: (_e, lang) => ({
    code: EXIT.usage,
    message: zhOrEn(
      lang,
      "這個指令會使用你的 Claude Code / Codex 訂閱額度，需要確認。非互動環境請加上 --yes。",
      "This uses your Claude Code / Codex subscription and needs confirmation. In non-interactive environments, add --yes.",
    ),
  }),
  InvalidArgument: (e, lang) => ({
    code: EXIT.usage,
    message: zhOrEn(
      lang,
      `${e.flag} 的值「${e.value}」無法辨識。--since 可以用 1m、3m、6m、1y 或 all。`,
      `Unrecognised value "${e.value}" for ${e.flag}. --since accepts 1m, 3m, 6m, 1y or all.`,
    ),
  }),
  FileError: (e, lang) => ({
    code: EXIT.error,
    message: zhOrEn(
      lang,
      `無法讀寫 ${e.path}：${e.detail}`,
      `Cannot read or write ${e.path}: ${e.detail}`,
    ),
  }),
  UnsupportedProfileVersion: (e, lang) => ({
    code: EXIT.error,
    message: zhOrEn(
      lang,
      `這個 profile.json 的格式版本（${String(e.found)}）不是這個版本的 prompt-profile 能讀的（支援 ${e.supported}）。請更新 prompt-profile，或重新分析。`,
      `This profile.json has format version ${String(e.found)}, which this prompt-profile cannot read (supports ${e.supported}). Update prompt-profile or re-run the analysis.`,
    ),
  }),
  InvalidProfile: (e, lang) => ({
    code: EXIT.error,
    message: zhOrEn(
      lang,
      `profile.json 的內容不正確：${e.message}`,
      `profile.json is invalid: ${e.message}`,
    ),
  }),
}

export const renderError = (error: AppError, lang: Language): Rendered =>
  (RENDERERS[error._tag] as (e: AppError, l: Language) => Rendered)(error, lang)

const ISSUES = "https://github.com/EricTsai83/prompt-profile/issues"

/** A defect is a bug in prompt-profile, not something the user did. */
export const renderDefect = (lang: Language): Rendered => ({
  code: EXIT.error,
  message: zhOrEn(
    lang,
    `發生未預期的錯誤（這是 prompt-profile 的 bug）。加上 --verbose 重跑可以看到細節，歡迎回報：${ISSUES}`,
    `An unexpected error occurred (a bug in prompt-profile). Re-run with --verbose for details, and please report it: ${ISSUES}`,
  ),
})

/** The defect's stack for --verbose. */
export const defectDetail = (defect: unknown): string =>
  defect instanceof Error ? (defect.stack ?? `${defect.name}: ${defect.message}`) : String(defect)

/** Full error for --verbose (never includes prompt text: LlmErrors only carry CLI output tails). */
export const verboseDetail = (error: AppError): string => {
  const { _tag, ...rest } = error as AppError & Record<string, unknown>
  return `[${_tag}] ${JSON.stringify(rest, (k, v) => (k === "stack" ? undefined : v), 2)}`
}
