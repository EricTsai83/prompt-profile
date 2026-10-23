import { Effect, PlatformError, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import type { Scope } from "effect"
import { NotInstalled, ProcessFailed, type RunnerId } from "./LlmRunner.ts"

export interface ProcessSpec {
  readonly runner: RunnerId
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly cwd: string
  readonly stdin: string
}

export interface ProcessOutput {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export const isNotFound = (error: unknown): boolean =>
  (PlatformError.isPlatformError(error) && error.reason._tag === "NotFound") ||
  /ENOENT/.test(String(error))

/**
 * Run a CLI with the prompt on stdin. The child is bound to the surrounding `Scope`:
 * interrupting (timeout / Ctrl-C) kills its whole process group.
 */
export const runProcess = (
  spec: ProcessSpec,
): Effect.Effect<
  ProcessOutput,
  NotInstalled | ProcessFailed,
  ChildProcessSpawner.ChildProcessSpawner | Scope.Scope
> =>
  Effect.gen(function* () {
    const command = ChildProcess.make(spec.command, [...spec.args], {
      cwd: spec.cwd,
      extendEnv: true,
      stdin: Stream.make(new TextEncoder().encode(spec.stdin)),
      forceKillAfter: "3 seconds",
    })
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const handle = yield* spawner.spawn(command).pipe(
      Effect.mapError((error) =>
        isNotFound(error)
          ? new NotInstalled({ runner: spec.runner })
          : new ProcessFailed({
              runner: spec.runner,
              exitCode: null,
              detail: `failed to spawn ${spec.command}`,
              stderrTail: "",
            }),
      ),
    )
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        Stream.mkString(Stream.decodeText(handle.stdout)),
        Stream.mkString(Stream.decodeText(handle.stderr)),
        handle.exitCode,
      ],
      { concurrency: "unbounded" },
    ).pipe(
      Effect.mapError(
        (error) =>
          new ProcessFailed({
            runner: spec.runner,
            exitCode: null,
            detail: isNotFound(error) ? `${spec.command} not found` : "process I/O failed",
            stderrTail: "",
          }),
      ),
    )
    return { exitCode: Number(exitCode), stdout, stderr }
  })
