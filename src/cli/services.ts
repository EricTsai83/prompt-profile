import type { CjkFonts } from "../report/index.ts"
import { loadCjkFonts } from "../report/fonts.ts"
import { Console, Context, Effect, FileSystem, Layer, Path } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import type { RunnerOptions } from "../llm/common.ts"
import { detectAll, makeRunner, type RunnerStatus } from "../llm/detect.ts"
import type { LlmRunnerShape, RunnerId } from "../llm/LlmRunner.ts"
import { Environment } from "../platform/Environment.ts"

// ---------------------------------------------------------------------------------------
// LLM runners

export interface LlmProviderShape {
  readonly detect: Effect.Effect<ReadonlyArray<RunnerStatus>>
  readonly make: (id: RunnerId, options: RunnerOptions) => Effect.Effect<LlmRunnerShape>
}

export class LlmProvider extends Context.Service<LlmProvider, LlmProviderShape>()(
  "prompt-profile/LlmProvider",
) {}

export const LlmProviderLive = Layer.effect(
  LlmProvider,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const provide = <A, E>(
      eff: Effect.Effect<
        A,
        E,
        ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
      >,
    ) =>
      eff.pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
      )
    return {
      detect: provide(detectAll).pipe(Effect.cached, Effect.runSync),
      make: (id, options) => provide(makeRunner(id, options)),
    }
  }),
)

// ---------------------------------------------------------------------------------------
// Opening the report

export interface OpenerShape {
  /** Open a file in the default browser; resolves to false on any failure. */
  readonly open: (file: string) => Effect.Effect<boolean>
}

export class Opener extends Context.Service<Opener, OpenerShape>()("prompt-profile/Opener") {}

export const OpenerLive = Layer.effect(
  Opener,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const env = yield* Environment
    const [cmd, args]: [string, ReadonlyArray<string>] =
      env.platform === "darwin"
        ? ["open", []]
        : env.platform === "win32"
          ? ["cmd", ["/c", "start", '""']]
          : ["xdg-open", []]
    return {
      open: (file) =>
        spawner
          .exitCode(
            ChildProcess.make(cmd, [...args, file], {
              stdin: "ignore",
              stdout: "ignore",
              stderr: "ignore",
            }),
          )
          .pipe(
            Effect.map((code) => Number(code) === 0),
            Effect.timeoutOption("10 seconds"),
            Effect.map((o) => o._tag === "Some" && o.value),
            Effect.orElseSucceed(() => false),
          ),
    }
  }),
)

// ---------------------------------------------------------------------------------------
// Output

export interface OutputShape {
  /** A permanent line. */
  readonly line: (text: string) => Effect.Effect<void>
  /** A status line: rewritten in place on a TTY, printed as a normal line otherwise. */
  readonly status: (text: string) => Effect.Effect<void>
  /** Only shown with --verbose. */
  readonly debug: (text: string) => Effect.Effect<void>
  readonly error: (text: string) => Effect.Effect<void>
}

export class Output extends Context.Service<Output, OutputShape>()("prompt-profile/Output") {}

export const makeOutput = (options: {
  readonly isTTY: boolean
  readonly verbose: boolean
}): OutputShape => {
  let pendingStatus = false
  const clearStatus = Effect.sync(() => {
    if (pendingStatus) {
      process.stdout.write("\r\x1b[2K")
      pendingStatus = false
    }
  })
  return {
    line: (text) =>
      options.isTTY ? clearStatus.pipe(Effect.andThen(Console.log(text))) : Console.log(text),
    status: (text) =>
      options.isTTY
        ? Effect.sync(() => {
            process.stdout.write(`\r\x1b[2K${text}`)
            pendingStatus = true
          })
        : Console.log(text),
    debug: (text) => (options.verbose ? Console.error(text) : Effect.void),
    error: (text) =>
      options.isTTY ? clearStatus.pipe(Effect.andThen(Console.error(text))) : Console.error(text),
  }
}

/** Where the card's CJK font comes from: a verified, cached download (tests use a stand-in). */
export interface FontSourceShape {
  readonly cjk: (cacheDir: string) => CjkFonts
}

export class FontSource extends Context.Service<FontSource, FontSourceShape>()(
  "prompt-profile/FontSource",
) {}

export const FontSourceLive = Layer.succeed(FontSource, { cjk: (dir) => loadCjkFonts(dir) })
