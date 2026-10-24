import type { CacheClearFailed } from "../analysis/cache.ts"
import type { AnalyzeError } from "../analysis/errors.ts"
import type { InvalidProfile, UnsupportedProfileVersion } from "../domain/Profile.ts"
import type { LlmError } from "../llm/LlmRunner.ts"
import type { FileError, InvalidArgument, NeedsConfirmation, NoData } from "./errors.ts"

export type AppError =
  | CacheClearFailed
  | AnalyzeError
  | LlmError
  | NoData
  | NeedsConfirmation
  | InvalidArgument
  | FileError
  | UnsupportedProfileVersion
  | InvalidProfile

/** How to fix an InvalidArgument, per flag. */
const ARGUMENT_HINTS: Readonly<Record<string, string>> = {
  "--since": "--since accepts 1m, 3m, 6m, 1y or all.",
  "--max-calls": "Use a positive safe integer.",
  "--card-hide": "Use a comma list of traits, stats, graphic.",
  "--lang": "Use a comma list of en, zh-TW (the first is the default).",
}

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
  readonly [K in AppError["_tag"]]: (error: Extract<AppError, { _tag: K }>) => Rendered
}

/**
 * Exhaustive: adding an error type without a message is a compile error.
 * Messages say what happened and what to do next; details only with --verbose.
 */
const RENDERERS: Renderers = {
  CallBudgetExceeded: (e) => ({
    code: EXIT.error,
    message: `Stopped at the call budget of ${e.limit}. Retries count toward this limit. Completed chunks are cached; increase --max-calls to continue.`,
  }),
  CacheClearFailed: (e) => ({
    code: EXIT.error,
    message: `Could not delete analysis cache at ${e.path}. Sensitive entries may remain. Check folder permissions and retry.`,
  }),
  NoData: (e) => ({
    code: EXIT.noData,
    message:
      e.reason === "empty"
        ? `No prompt history found. Looked in:\n${e.locations.map((l) => `  - ${l}`).join("\n")}\nIf your data lives elsewhere, set CLAUDE_CONFIG_DIR or CODEX_HOME.`
        : "No prompts to analyse in this time range. Try --since 1y or --since all.",
  }),
  NotInstalled: () => ({
    code: EXIT.noLlm,
    message: `prompt-profile needs Claude Code or Codex installed and logged in.\n${INSTALL}\nTo see statistics without an LLM, run \`prompt-profile stats\`.`,
  }),
  NotLoggedIn: (e) => ({
    code: EXIT.noLlm,
    message: `${CLI_NAME[e.runner]} is installed but not logged in. Run ${e.runner === "codex" ? "`codex login`" : "`claude` and use /login"}, then try again.`,
  }),
  RateLimited: () => ({
    code: EXIT.rateLimited,
    message:
      "Hit your plan's rate limit. Finished chunks are cached; run again later to continue where it stopped.",
  }),
  Timeout: (e) => ({
    code: EXIT.error,
    message: `${CLI_NAME[e.runner]} did not answer within ${Math.round(e.afterMs / 60000)} minutes. Finished chunks are cached; just run again.`,
  }),
  InvalidOutput: (e) => ({
    code: EXIT.error,
    message: `${CLI_NAME[e.runner]} returned malformed output (after retries). Run again, or switch with --engine.`,
  }),
  ProcessFailed: (e) => ({
    code: EXIT.error,
    message: `${CLI_NAME[e.runner]} failed (exit code ${e.exitCode ?? "?"}): ${e.detail || "no error message"}. Use --verbose for details.`,
  }),
  Interrupted: () => ({
    code: EXIT.interrupted,
    message: "Interrupted. Run again to resume from the cache.",
  }),
  AnalysisFailed: (e) => ({
    code: EXIT.error,
    message:
      e.reason === "no-prompts"
        ? "There are no prompts to analyse."
        : e.reason === "too-many-chunk-failures"
          ? `${e.chunksFailed} of ${e.chunksTotal} chunks failed, so no reliable report could be made. Successful chunks are cached; run again.`
          : e.reason === "input-too-large"
            ? "The observations are still too large after merging. No final profile call was sent. Try a shorter --since range; completed chunks are cached."
            : "The final profile step failed. Chunk results are cached, so a re-run only repeats this step.",
  }),
  NeedsConfirmation: () => ({
    code: EXIT.usage,
    message:
      "This uses your Claude Code / Codex subscription and needs confirmation. In non-interactive environments, add --yes.",
  }),
  InvalidArgument: (e) => ({
    code: EXIT.usage,
    message: `Unrecognised value "${e.value}" for ${e.flag}. ${ARGUMENT_HINTS[e.flag] ?? ARGUMENT_HINTS["--since"]}`,
  }),
  FileError: (e) => ({
    code: EXIT.error,
    message: `Cannot read or write ${e.path}: ${e.detail}`,
  }),
  UnsupportedProfileVersion: (e) => ({
    code: EXIT.error,
    message: `This profile.json has format version ${String(e.found)}, which this prompt-profile cannot read (supports ${e.supported}). Update prompt-profile or re-run the analysis.`,
  }),
  InvalidProfile: (e) => ({
    code: EXIT.error,
    message: `profile.json is invalid: ${e.message}`,
  }),
}

export const renderError = (error: AppError): Rendered =>
  (RENDERERS[error._tag] as (e: AppError) => Rendered)(error)

const ISSUES = "https://github.com/EricTsai83/prompt-profile/issues"

/** A defect is a bug in prompt-profile, not something the user did. */
export const renderDefect = (): Rendered => ({
  code: EXIT.error,
  message: `An unexpected error occurred (a bug in prompt-profile). Re-run with --verbose for details, and please report it: ${ISSUES}`,
})

/** The defect's stack for --verbose. */
export const defectDetail = (defect: unknown): string =>
  defect instanceof Error ? (defect.stack ?? `${defect.name}: ${defect.message}`) : String(defect)

/** Own fields plus `cause`, which Error keeps non-enumerable (JSON.stringify would drop it). */
const withCause = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) return value
  const cause = (value as { cause?: unknown }).cause
  return cause === undefined ? value : { ...value, cause: withCause(cause) }
}

/** Full error for --verbose (never includes prompt text: LlmErrors only carry CLI output tails). */
export const verboseDetail = (error: AppError): string => {
  const { _tag, ...rest } = withCause(error) as AppError & Record<string, unknown>
  return `[${_tag}] ${JSON.stringify(rest, (k, v) => (k === "stack" ? undefined : v), 2)}`
}
