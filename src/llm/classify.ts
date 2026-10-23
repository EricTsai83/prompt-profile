import { NotLoggedIn, ProcessFailed, RateLimited, type RunnerId } from "./LlmRunner.ts"

export interface FailureInfo {
  readonly runner: RunnerId
  readonly exitCode: number | null
  /** Error text extracted from the CLI's structured output (Claude `result`, Codex error events). */
  readonly message: string
  /** HTTP-ish status reported by the CLI, when available. */
  readonly status: number | null
  /** Already sanitized: never contains prompt content. */
  readonly stderrTail: string
}

export interface ClassifyRule {
  readonly name: string
  readonly tag: "NotLoggedIn" | "RateLimited"
  readonly test: (info: FailureInfo) => boolean
}

const text = (info: FailureInfo) => `${info.message}\n${info.stderrTail}`

/** Ordered: first match wins. Anything unmatched is `ProcessFailed`. */
export const CLASSIFY_RULES: ReadonlyArray<ClassifyRule> = [
  { name: "http-401", tag: "NotLoggedIn", test: (i) => i.status === 401 || i.status === 403 },
  {
    name: "auth-message",
    tag: "NotLoggedIn",
    test: (i) =>
      /not logged in|please run \/login|log ?in required|codex login|invalid api key|authentication[_ ]error|unauthori[sz]ed|oauth token (has )?expired/i.test(
        text(i),
      ),
  },
  { name: "http-429", tag: "RateLimited", test: (i) => i.status === 429 || i.status === 529 },
  {
    name: "rate-limit-message",
    tag: "RateLimited",
    test: (i) =>
      /rate[ _-]?limit|usage limit|too many requests|quota exceeded|limit reached|overloaded/i.test(
        text(i),
      ),
  },
]

export const classifyFailure = (info: FailureInfo): NotLoggedIn | RateLimited | ProcessFailed => {
  const rule = CLASSIFY_RULES.find((r) => r.test(info))
  const detail = info.message.slice(0, 500)
  switch (rule?.tag) {
    case "NotLoggedIn":
      return new NotLoggedIn({ runner: info.runner, detail })
    case "RateLimited":
      return new RateLimited({ runner: info.runner, detail })
    default:
      return new ProcessFailed({
        runner: info.runner,
        exitCode: info.exitCode,
        detail,
        stderrTail: info.stderrTail,
      })
  }
}

/**
 * Keep the last `maxLines` lines of stderr, dropping any line that also appears in the
 * prompt we sent (some CLIs echo the prompt to stderr).
 */
export const sanitizeStderr = (stderr: string, sentInput: string, maxLines = 20): string => {
  const inputLines = new Set(
    sentInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0),
  )
  return stderr
    .split("\n")
    .filter((l) => l.trim().length > 0 && !inputLines.has(l.trim()))
    .filter((l) => ![...inputLines].some((il) => il.length >= 12 && l.includes(il)))
    .slice(-maxLines)
    .join("\n")
}
