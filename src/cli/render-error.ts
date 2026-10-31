import type { CacheClearFailed } from "../analysis/cache.ts"
import type { AnalyzeError } from "../analysis/errors.ts"
import type { InvalidProfile, UnsupportedProfileVersion } from "../domain/Profile.ts"
import type { LlmError } from "../llm/LlmRunner.ts"
import type {
  FileError,
  InvalidArgument,
  NeedsConfirmation,
  NoData,
  OutputCheckBlocked,
} from "./errors.ts"
import { findingGroups, messages as t } from "./messages.ts"

export type AppError =
  | CacheClearFailed
  | AnalyzeError
  | LlmError
  | NoData
  | NeedsConfirmation
  | InvalidArgument
  | FileError
  | OutputCheckBlocked
  | UnsupportedProfileVersion
  | InvalidProfile

/** How to fix an InvalidArgument, per flag. */
const ARGUMENT_HINTS: Readonly<Record<string, string>> = {
  "--since": "--since accepts 1m, 3m, 6m, 1y or all.",
  "--effort": "--effort accepts low, medium, high, xhigh or max.",
  "--max-calls": "Use a positive safe integer.",
  "--max-cost-usd":
    "Use a positive finite USD amount with Claude Code. Codex cannot reliably report cost and service tier. This is a local stop threshold, with possible overshoot from in-flight calls, not a billing cap.",
  "--card-hide": "Use a comma list of traits, stats, graphic.",
  "--allow":
    "Use a comma list of email, home-path, username, internal-url, tw-national-id, credit-card, phone. Secrets cannot be allowed.",
  "--exclude":
    "Use a comma list of quotes, projects, dates, coaching, funfacts, custom-names, usage, or personal (all of them).",
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
  readonly [K in AppError["_tag"]]: (
    error: Extract<AppError, { _tag: K }>,
    rerun: string,
  ) => Rendered
}

/** Without a command context (tests, other commands): the generic advice. */
const SAME_COMMAND = "(run the same command again, without --no-cache)"

/** What is saved, what a re-run reuses, and the exact command (plan 24). */
const recovery = (rerun: string) => `${t.saved}\n${t.reuse}\n${t.rerun(rerun)}`

/** Free ways to look at the data when no LLM can be used. */
const FREE_ROUTES =
  "To inspect for free without an LLM: `prompt-profile --dry-run` (what would be sent) or `prompt-profile stats`."

/**
 * Exhaustive: adding an error type without a message is a compile error.
 * Messages say what happened and what to do next; details only with --verbose.
 */
const RENDERERS: Renderers = {
  AccountingUnavailable: (e, rerun) => ({
    code: EXIT.error,
    message: `${e.reason === "capacity" ? "Execution reached its 10,000-attempt record capacity." : "Execution checkpoint could not be saved; check output-folder permissions."} Stopped further model calls.\n${recovery(rerun)}`,
  }),
  CostBudgetExceeded: (e, rerun) => ({
    code: EXIT.error,
    message: `Stopped at the local cost threshold: USD ${e.measuredUsd.toFixed(6)} measured; ${e.reason === "unavailable" ? "cost coverage became unavailable" : `threshold USD ${e.limit}`}. In-flight calls can overshoot. This is not a provider billing cap.\n${recovery(rerun)}`,
  }),
  CallBudgetExceeded: (e, rerun) => ({
    code: EXIT.error,
    message: `Stopped at the call budget of ${e.limit} CLI calls (retries count toward it). ${t.saved}\n${t.reuse} Cached results do not use the budget again; raise --max-calls if it stops again.\n${t.rerun(rerun)}`,
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
    message: `prompt-profile needs Claude Code or Codex installed and logged in.\n${INSTALL}\n${FREE_ROUTES}`,
  }),
  NotLoggedIn: (e) => ({
    code: EXIT.noLlm,
    message: `${CLI_NAME[e.runner]} is installed but not logged in. Run ${e.runner === "codex" ? "`codex login`" : "`claude` and use /login"}, then try again.\n${FREE_ROUTES}`,
  }),
  RateLimited: (_e, rerun) => ({
    code: EXIT.rateLimited,
    message: `Hit your plan's rate limit. Wait until it resets, then re-run.\n${recovery(rerun)}`,
  }),
  Timeout: (e, rerun) => ({
    code: EXIT.error,
    message: `${CLI_NAME[e.runner]} did not answer within ${Math.round(e.afterMs / 60000)} minutes.\n${recovery(rerun)}`,
  }),
  InvalidOutput: (e, rerun) => ({
    code: EXIT.error,
    message: `${CLI_NAME[e.runner]} returned malformed output (after retries); --engine switches the CLI.\n${recovery(rerun)}`,
  }),
  // The CLI's own message can quote what it was sent: only with --verbose.
  ProcessFailed: (e, rerun) => ({
    code: EXIT.error,
    message: `${CLI_NAME[e.runner]} failed (exit code ${e.exitCode ?? "?"}). Its own message is shown with --verbose.\n${recovery(rerun)}`,
  }),
  Interrupted: (_e, rerun) => ({
    code: EXIT.interrupted,
    message: t.interrupted(rerun),
  }),
  AnalysisFailed: (e, rerun) => ({
    code: EXIT.error,
    message:
      e.reason === "no-prompts"
        ? "There are no prompts to analyse."
        : e.reason === "too-many-chunk-failures"
          ? `${e.chunksFailed} of ${e.chunksTotal} chunks failed, so no reliable report could be made.\n${recovery(rerun)}`
          : e.reason === "input-too-large"
            ? "The observations are still too large after merging. No final profile call was sent and no report was written. Try a shorter --since range; completed chunks stay cached."
            : e.reason === "merge-failed"
              ? `An intermediate merge of the observations failed. No report was written. Chunk results and finished merges are cached; a re-run repeats the unfinished merges, then the final profile and translation calls (including evidence review).\n${t.rerun(rerun)}`
              : `The final profile step failed. No report was written. Chunk results (and any merges) are cached, so a re-run repeats only the final profile and translation calls (including evidence review).\n${t.rerun(rerun)}`,
  }),
  NeedsConfirmation: () => ({
    code: EXIT.usage,
    message:
      "This sends the selected, redacted prompts through your logged-in Claude Code / Codex CLI and uses your subscription quota, so it needs confirmation. In non-interactive environments, add --yes; or preview for free with --dry-run.",
  }),
  InvalidArgument: (e) => ({
    code: EXIT.usage,
    message: `Unrecognised value "${e.value}" for ${e.flag}. ${ARGUMENT_HINTS[e.flag] ?? ARGUMENT_HINTS["--since"]}`,
  }),
  OutputCheckBlocked: (e) => ({
    code: EXIT.error,
    message: `The final check found secrets or personal data (--check strict), so nothing was written:\n${findingGroups(
      e.findings,
    )
      .map((g) => `  ${g}`)
      .join(
        "\n",
      )}\nLeave the part out with --exclude, allow a personal rule with --allow, or drop --check strict.`,
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

/** `rerun`: the command that repeats the run with the cache read (main command only). */
export const renderError = (error: AppError, rerun: string = SAME_COMMAND): Rendered =>
  (RENDERERS[error._tag] as (e: AppError, rerun: string) => Rendered)(error, rerun)

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
