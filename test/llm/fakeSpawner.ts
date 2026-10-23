import { Effect, Layer, PlatformError, Sink, Stream } from "effect"
import type { Scope } from "effect"
import { ChildProcessSpawner } from "effect/process"
import type { ChildProcess } from "effect/process"

export interface SpawnRecord {
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly cwd: string | undefined
  stdin: string
  killed: boolean
}

export type Respond = (
  record: SpawnRecord,
) =>
  | { readonly exitCode: number; readonly stdout?: string; readonly stderr?: string }
  | "hang"
  | "enoent"

const collectStdin = (cmd: ChildProcess.StandardCommand): Effect.Effect<string> => {
  const input = cmd.options.stdin
  const stream =
    typeof input === "object" && input !== null && "stream" in input ? input.stream : input
  if (stream === undefined || typeof stream === "string") return Effect.succeed("")
  return Stream.mkString(Stream.decodeText(stream)).pipe(Effect.orDie)
}

/** A ChildProcessSpawner that never starts a real process. */
export const makeFakeSpawner = (respond: Respond) => {
  const records: Array<SpawnRecord> = []
  const spawn = (
    command: ChildProcess.Command,
  ): Effect.Effect<
    ChildProcessSpawner.ChildProcessHandle,
    PlatformError.PlatformError,
    Scope.Scope
  > =>
    Effect.gen(function* () {
      if (command._tag !== "StandardCommand") return yield* Effect.die("piped commands unsupported")
      const record: SpawnRecord = {
        command: command.command,
        args: command.args,
        cwd: command.options.cwd,
        stdin: yield* collectStdin(command),
        killed: false,
      }
      records.push(record)
      const result = respond(record)
      if (result === "enoent") {
        return yield* Effect.fail(
          PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" }),
        )
      }
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          if (result === "hang") record.killed = true
        }),
      )
      const text = (s: string | undefined) => Stream.make(new TextEncoder().encode(s ?? ""))
      return ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(1),
        exitCode:
          result === "hang"
            ? Effect.never
            : Effect.succeed(ChildProcessSpawner.ExitCode(result.exitCode)),
        isRunning: Effect.succeed(result === "hang"),
        kill: () => Effect.sync(() => void (record.killed = true)),
        stdin: Sink.drain,
        stdout: result === "hang" ? Stream.never : text(result.stdout),
        stderr: result === "hang" ? Stream.never : text(result.stderr),
        all: Stream.empty,
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        unref: Effect.succeed(Effect.void),
      })
    })
  const layer = Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(spawn),
  )
  return { layer, records }
}
