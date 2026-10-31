import { Clock, Effect, FileSystem, Path, Schema } from "effect"
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

const RUNNER = "codex" as const

/** Build the `codex exec` argument list. The prompt (system + data) is sent on stdin. */
export const codexArgs = (
  paths: { readonly schemaPath: string; readonly outputPath: string },
  options: RunnerOptions,
): ReadonlyArray<string> => [
  "exec",
  "--output-schema",
  paths.schemaPath,
  "-o",
  paths.outputPath,
  "--ephemeral",
  "--ignore-user-config",
  "-c",
  "features.hooks=false",
  "-c",
  "notify=[]",
  "--ignore-rules",
  "-s",
  "read-only",
  "--skip-git-repo-check",
  "--json",
  ...(options.model ? ["-m", options.model] : []),
  // a -c override applies even with --ignore-user-config
  ...(options.effort ? ["-c", `model_reasoning_effort="${options.effort}"`] : []),
  "-",
]

/** Codex has no system prompt flag: the system text goes first on stdin. */
export const codexStdin = (system: string, prompt: string): string =>
  withMarker(`${SYSTEM_PREAMBLE}\n\n${system}\n\n---\n\n${prompt}`)

const CodexEvent = Schema.Struct({
  type: Schema.String,
  message: Schema.optional(Schema.String),
  error: Schema.optional(Schema.Struct({ message: Schema.optional(Schema.String) })),
  usage: Schema.optional(
    Schema.Struct({
      input_tokens: Schema.optional(Schema.Unknown),
      output_tokens: Schema.optional(Schema.Unknown),
      cached_input_tokens: Schema.optional(Schema.Unknown),
      reasoning_output_tokens: Schema.optional(Schema.Unknown),
      service_tier: Schema.optional(Schema.Unknown),
    }),
  ),
})
type CodexEvent = typeof CodexEvent.Type

const decodeEvent = Schema.decodeUnknownOption(CodexEvent)

export const parseCodexEvents = (stdout: string): ReadonlyArray<CodexEvent> =>
  stdout.split("\n").flatMap((line) => {
    const ev = decodeEvent(tryParseJson(line.trim()))
    return ev._tag === "Some" ? [ev.value] : []
  })

/** Error events embed the API error as a JSON string; pull out message + status. */
export const codexErrorInfo = (
  events: ReadonlyArray<CodexEvent>,
): { message: string; status: number | null } => {
  const raw = events
    .filter((e) => e.type === "error" || e.type === "turn.failed")
    .map((e) => e.message ?? e.error?.message ?? "")
  let status: number | null = null
  const messages = raw.map((m) => {
    const inner = tryParseJson(m) as { status?: number; error?: { message?: string } } | undefined
    if (inner && typeof inner === "object") {
      if (typeof inner.status === "number") status = inner.status
      if (typeof inner.error?.message === "string") return inner.error.message
    }
    return m
  })
  return { message: [...new Set(messages)].join("\n"), status }
}

export const makeCodexRunner = (
  options: RunnerOptions = {},
): Effect.Effect<
  LlmRunnerShape,
  never,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const timeout = options.timeout ?? DEFAULT_TIMEOUT

    const generate = <A>(input: GenerateInput<A>) =>
      Effect.gen(function* () {
        const start = yield* Clock.currentTimeMillis
        const cwd = yield* scopedWorkdir
        const schemaPath = path.join(cwd, "schema.json")
        const outputPath = path.join(cwd, "output.json")
        yield* fs
          .writeFileString(schemaPath, JSON.stringify(input.schema.jsonSchema))
          .pipe(Effect.orDie)
        const stdin = codexStdin(input.system, input.prompt)
        const proc = yield* runProcess({
          onInvocation: input.onInvocation,
          runner: RUNNER,
          command: "codex",
          args: codexArgs({ schemaPath, outputPath }, options),
          cwd,
          stdin,
        })
        const events = parseCodexEvents(proc.stdout)
        const usageMeasurement = events.findLast((e) => e.usage !== undefined)?.usage
        const count = (n: unknown): n is number =>
          typeof n === "number" && Number.isSafeInteger(n) && n >= 0
        const cached = usageMeasurement?.cached_input_tokens
        const totalInput = usageMeasurement?.input_tokens
        input.onMeasurement?.({
          model: options.model ?? null,
          modelSource: options.model ? "requested" : null,
          tokens: usageMeasurement
            ? {
                ...(count(totalInput) && count(cached) && cached <= totalInput
                  ? { input: totalInput - cached, cacheRead: cached }
                  : {}),
                ...(count(usageMeasurement.output_tokens)
                  ? { output: usageMeasurement.output_tokens }
                  : {}),
                ...(count(usageMeasurement.reasoning_output_tokens) &&
                count(usageMeasurement.output_tokens) &&
                usageMeasurement.reasoning_output_tokens <= usageMeasurement.output_tokens
                  ? { reasoning: usageMeasurement.reasoning_output_tokens }
                  : {}),
                cacheWrite5m: 0,
                cacheWrite1h: 0,
                cacheWriteUnknown: 0,
              }
            : null,
          costUsd: null,
          tier:
            usageMeasurement?.service_tier === "standard"
              ? "standard"
              : usageMeasurement?.service_tier === "priority" ||
                  usageMeasurement?.service_tier === "fast"
                ? "fast"
                : usageMeasurement?.service_tier
                  ? "other"
                  : null,
        })
        const failed = events.some((e) => e.type === "turn.failed")
        if (proc.exitCode === 130 || proc.exitCode === 143) {
          return yield* new Interrupted({ runner: RUNNER })
        }
        if (proc.exitCode !== 0 || failed) {
          const info = codexErrorInfo(events)
          return yield* classifyFailure({
            runner: RUNNER,
            exitCode: proc.exitCode,
            message: info.message,
            status: info.status,
            stderrTail: sanitizeStderr(proc.stderr, stdin),
          })
        }
        const text = yield* fs
          .readFileString(outputPath)
          .pipe(
            Effect.mapError(
              () => new InvalidOutput({ runner: RUNNER, detail: "no output message written" }),
            ),
          )
        const value = yield* decodeValue(RUNNER, input.schema, yield* parseJson(RUNNER, text))
        const usage = events.findLast((e) => e.type === "turn.completed")?.usage
        const end = yield* Clock.currentTimeMillis
        // Codex never reports its model: a name here is only the requested one echoed back.
        const modelSource: ModelSource = options.model ? "requested" : null
        return {
          value,
          model: options.model ?? null,
          modelSource,
          usage: {
            inputTokens: count(usage?.input_tokens) ? usage.input_tokens : null,
            outputTokens: count(usage?.output_tokens) ? usage.output_tokens : null,
            costUsd: null,
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
