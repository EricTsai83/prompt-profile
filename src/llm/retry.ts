import { Duration, Effect } from "effect"
import type { GenerateInput, GenerateResult, LlmError, LlmRunnerShape } from "./LlmRunner.ts"

export interface RetryOptions {
  /** Retries after the first attempt. */
  readonly maxRetries?: number
  readonly baseDelay?: Duration.Input
  /** `RateLimited` waits at least this long. */
  readonly rateLimitMinDelay?: Duration.Input
}

const RETRIABLE: ReadonlySet<LlmError["_tag"]> = new Set([
  "RateLimited",
  "Timeout",
  "InvalidOutput",
])

export const isRetriable = (e: LlmError): boolean => RETRIABLE.has(e._tag)

/** Delay before retry number `attempt` (0-based): exponential, with a floor for rate limits. */
export const retryDelay = (
  e: LlmError,
  attempt: number,
  options: RetryOptions = {},
): Duration.Duration => {
  const base = Duration.toMillis(options.baseDelay ?? "2 seconds") * 2 ** attempt
  const floor =
    e._tag === "RateLimited" ? Duration.toMillis(options.rateLimitMinDelay ?? "30 seconds") : 0
  return Duration.millis(Math.max(base, floor))
}

/** On `InvalidOutput`, tell the model what went wrong on the next attempt. */
const retryInput = <A>(input: GenerateInput<A>, e: LlmError): GenerateInput<A> =>
  e._tag === "InvalidOutput"
    ? {
        ...input,
        prompt: `${input.prompt}\n\n(Your previous answer was rejected: ${e.detail}. Return JSON that strictly matches the schema.)`,
      }
    : input

/** Wrap any runner with retry + exponential backoff for transient errors. */
export const withRetry = (runner: LlmRunnerShape, options: RetryOptions = {}): LlmRunnerShape => {
  const maxRetries = options.maxRetries ?? 2
  const generate = <A>(input: GenerateInput<A>) => {
    const attempt = (
      n: number,
      current: GenerateInput<A>,
    ): Effect.Effect<GenerateResult<A>, LlmError> =>
      runner
        .generate(current)
        .pipe(
          Effect.catch((e: LlmError) =>
            isRetriable(e) && n < maxRetries
              ? Effect.sleep(retryDelay(e, n, options)).pipe(
                  Effect.andThen(attempt(n + 1, retryInput(input, e))),
                )
              : Effect.fail(e),
          ),
        )
    return attempt(0, input)
  }
  return { ...runner, generate }
}
