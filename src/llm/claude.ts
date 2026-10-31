import { Clock, Effect, FileSystem, Option, Schema } from "effect"
import { ChildProcessSpawner } from "effect/process"
import { classifyFailure, sanitizeStderr } from "./classify.ts"
import {
  DEFAULT_TIMEOUT,
  decodeValue,
  parseJson,
  scopedWorkdir,
  tryParseJson,
  withMarker,
  withTimeout,
  type RunnerOptions,
} from "./common.ts"
import {
  DISPLAY_NAMES,
  Interrupted,
  InvalidOutput,
  SYSTEM_PREAMBLE,
  type GenerateInput,
  type LlmRunnerShape,
  type ModelSource,
} from "./LlmRunner.ts"
import { runProcess } from "./process.ts"

const validAmount = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0
const validCount = (n: unknown): n is number => validAmount(n) && Number.isSafeInteger(n)

const cacheWrites = (
  total: number,
  durations:
    | { ephemeral_5m_input_tokens?: unknown; ephemeral_1h_input_tokens?: unknown }
    | undefined,
) => {
  const short = validCount(durations?.ephemeral_5m_input_tokens)
    ? durations.ephemeral_5m_input_tokens
    : 0
  const long = validCount(durations?.ephemeral_1h_input_tokens)
    ? durations.ephemeral_1h_input_tokens
    : 0
  return short + long <= total
    ? { cacheWrite5m: short, cacheWrite1h: long, cacheWriteUnknown: total - short - long }
    : { cacheWrite5m: 0, cacheWrite1h: 0, cacheWriteUnknown: total }
}

const RUNNER = "claude-code" as const

/** Build the `claude -p` argument list. The prompt itself is sent on stdin. */
export const claudeArgs = (
  input: { readonly system: string; readonly jsonSchema: unknown },
  options: RunnerOptions,
): ReadonlyArray<string> => [
  "-p",
  "--safe-mode",
  "--output-format",
  "json",
  "--json-schema",
  JSON.stringify(input.jsonSchema),
  "--no-session-persistence",
  "--tools",
  "",
  "--strict-mcp-config",
  "--settings",
  JSON.stringify({ disableAllHooks: true }),
  "--disable-slash-commands",
  "--system-prompt",
  `${SYSTEM_PREAMBLE}\n\n${input.system}`,
  ...(options.model ? ["--model", options.model] : []),
  ...(options.effort ? ["--effort", options.effort] : []),
]

/** Lenient view of `claude -p --output-format json` (only the fields we use). */
const ClaudeOutput = Schema.Struct({
  is_error: Schema.optional(Schema.Boolean),
  subtype: Schema.optional(Schema.String),
  result: Schema.optional(Schema.Unknown),
  structured_output: Schema.optional(Schema.Unknown),
  api_error_status: Schema.optional(Schema.NullOr(Schema.Number)),
  total_cost_usd: Schema.optional(Schema.Unknown),
  usage: Schema.optional(
    Schema.Struct({
      input_tokens: Schema.optional(Schema.Unknown),
      cache_creation_input_tokens: Schema.optional(Schema.Unknown),
      cache_read_input_tokens: Schema.optional(Schema.Unknown),
      output_tokens: Schema.optional(Schema.Unknown),
      service_tier: Schema.optional(Schema.Unknown),
      cache_creation: Schema.optional(
        Schema.Struct({
          ephemeral_5m_input_tokens: Schema.optional(Schema.Unknown),
          ephemeral_1h_input_tokens: Schema.optional(Schema.Unknown),
        }),
      ),
    }),
  ),
  modelUsage: Schema.optional(
    Schema.Record(
      Schema.String,
      Schema.Struct({
        outputTokens: Schema.optional(Schema.Number),
        canonicalModel: Schema.optional(Schema.String),
      }),
    ),
  ),
})
type ClaudeOutput = typeof ClaudeOutput.Type

/** The main model is the one that produced the most output tokens (Haiku is used for side tasks). */
export const mainModel = (out: ClaudeOutput): string | null => {
  const entries = Object.entries(out.modelUsage ?? {})
  if (entries.length === 0) return null
  const [name, usage] = entries.reduce((a, b) =>
    (b[1].outputTokens ?? 0) > (a[1].outputTokens ?? 0) ? b : a,
  )
  return usage.canonicalModel ?? name.replace(/\[[^\]]*\]$/, "")
}

const sumTokens = (u: ClaudeOutput["usage"]): number | null =>
  !validCount(u?.input_tokens)
    ? null
    : u.input_tokens +
      (validCount(u?.cache_creation_input_tokens) ? u.cache_creation_input_tokens : 0) +
      (validCount(u?.cache_read_input_tokens) ? u.cache_read_input_tokens : 0)

export const makeClaudeCodeRunner = (
  options: RunnerOptions = {},
): Effect.Effect<
  LlmRunnerShape,
  never,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const fs = yield* FileSystem.FileSystem
    const timeout = options.timeout ?? DEFAULT_TIMEOUT

    const generate = <A>(input: GenerateInput<A>) =>
      Effect.gen(function* () {
        const start = yield* Clock.currentTimeMillis
        const stdin = withMarker(input.prompt)
        const cwd = yield* scopedWorkdir
        const proc = yield* runProcess({
          onInvocation: input.onInvocation,
          runner: RUNNER,
          command: "claude",
          args: claudeArgs({ system: input.system, jsonSchema: input.schema.jsonSchema }, options),
          cwd,
          stdin,
        })
        const parsed = Option.getOrUndefined(
          Schema.decodeUnknownOption(ClaudeOutput)(tryParseJson(proc.stdout.trim())),
        )
        if (parsed)
          input.onMeasurement?.({
            model: mainModel(parsed) ?? options.model ?? null,
            modelSource:
              mainModel(parsed) !== null ? "reported" : options.model ? "requested" : null,
            tokens: parsed.usage
              ? {
                  ...(validCount(parsed.usage.input_tokens)
                    ? { input: parsed.usage.input_tokens }
                    : {}),
                  ...(validCount(parsed.usage.output_tokens)
                    ? { output: parsed.usage.output_tokens }
                    : {}),
                  ...(validCount(parsed.usage.cache_read_input_tokens)
                    ? { cacheRead: parsed.usage.cache_read_input_tokens }
                    : {}),
                  ...(validCount(parsed.usage.cache_creation_input_tokens)
                    ? {
                        ...cacheWrites(
                          parsed.usage.cache_creation_input_tokens,
                          parsed.usage.cache_creation,
                        ),
                      }
                    : {}),
                }
              : null,
            costUsd: validAmount(parsed.total_cost_usd) ? parsed.total_cost_usd : null,
            tier:
              parsed.usage?.service_tier === "standard"
                ? "standard"
                : parsed.usage?.service_tier
                  ? "other"
                  : null,
          })
        if (proc.exitCode === 130 || proc.exitCode === 143) {
          return yield* new Interrupted({ runner: RUNNER })
        }
        if (proc.exitCode !== 0 || parsed === undefined || parsed.is_error === true) {
          const message =
            typeof parsed?.result === "string" ? parsed.result : (parsed?.subtype ?? "")
          if (proc.exitCode === 0 && parsed === undefined) {
            return yield* new InvalidOutput({ runner: RUNNER, detail: "unparseable CLI output" })
          }
          return yield* classifyFailure({
            runner: RUNNER,
            exitCode: proc.exitCode,
            message,
            status: parsed?.api_error_status ?? null,
            stderrTail: sanitizeStderr(proc.stderr, stdin),
          })
        }
        const raw =
          parsed.structured_output !== undefined
            ? parsed.structured_output
            : typeof parsed.result === "string"
              ? yield* parseJson(RUNNER, parsed.result)
              : undefined
        if (raw === undefined) {
          return yield* new InvalidOutput({ runner: RUNNER, detail: "no structured_output" })
        }
        const value = yield* decodeValue(RUNNER, input.schema, raw)
        const end = yield* Clock.currentTimeMillis
        const reported = mainModel(parsed)
        const model = reported ?? options.model ?? null
        const modelSource: ModelSource =
          reported !== null ? "reported" : model !== null ? "requested" : null
        return {
          value,
          model,
          modelSource,
          usage: {
            inputTokens: sumTokens(parsed.usage),
            outputTokens: validCount(parsed.usage?.output_tokens)
              ? parsed.usage.output_tokens
              : null,
            costUsd: validAmount(parsed.total_cost_usd) ? parsed.total_cost_usd : null,
          },
          durationMs: end - start,
        }
      }).pipe(
        Effect.scoped,
        withTimeout(RUNNER, timeout),
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        Effect.provideService(FileSystem.FileSystem, fs),
      )

    return { id: RUNNER, displayName: DISPLAY_NAMES[RUNNER], tracksInvocation: true, generate }
  })
