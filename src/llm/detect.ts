import { Effect, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { makeClaudeCodeRunner } from "./claude.ts"
import { makeCodexRunner } from "./codex.ts"
import type { RunnerOptions } from "./common.ts"
import { tryParseJson } from "./common.ts"
import {
  NotInstalled,
  NotLoggedIn,
  RUNNER_IDS,
  type LlmRunnerShape,
  type RunnerId,
} from "./LlmRunner.ts"
import type { FileSystem, Path } from "effect"

export interface RunnerStatus {
  readonly id: RunnerId
  readonly installed: boolean
  readonly version: string | null
  /** `null` when it could not be determined (we then let the first call decide). */
  readonly loggedIn: boolean | null
}

interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
}

const run = (
  command: string,
  args: ReadonlyArray<string>,
): Effect.Effect<CommandResult | null, never, ChildProcessSpawner.ChildProcessSpawner> =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const handle = yield* spawner.spawn(
      ChildProcess.make(command, [...args], { extendEnv: true, stdin: "ignore" }),
    )
    const [stdout, exitCode] = yield* Effect.all(
      [Stream.mkString(Stream.decodeText(handle.stdout)), handle.exitCode],
      { concurrency: "unbounded" },
    )
    return { exitCode: Number(exitCode), stdout }
  }).pipe(
    Effect.scoped,
    Effect.timeoutOption("15 seconds"),
    Effect.map((o) => (o._tag === "Some" ? o.value : null)),
    Effect.orElseSucceed(() => null),
  )

/** Parse `claude auth status --json`. Only `loggedIn` is read (the output also has the email). */
export const parseClaudeAuth = (stdout: string): boolean | null => {
  const json = tryParseJson(stdout) as { loggedIn?: unknown } | undefined
  return typeof json?.loggedIn === "boolean" ? json.loggedIn : null
}

/** `codex login status` prints e.g. "Logged in using ChatGPT" / "Not logged in". */
export const parseCodexLogin = (result: CommandResult): boolean | null => {
  if (/not logged in/i.test(result.stdout)) return false
  if (/logged in/i.test(result.stdout)) return true
  return result.exitCode === 0 ? null : false
}

const VERSION_RE = /\d+\.\d+\.\d+/

/** Detect installation (via `--version`) and login state, without sending any prompt. */
export const detectRunner = (
  id: RunnerId,
): Effect.Effect<RunnerStatus, never, ChildProcessSpawner.ChildProcessSpawner> =>
  Effect.gen(function* () {
    const command = id === "claude-code" ? "claude" : "codex"
    const version = yield* run(command, ["--version"])
    if (version === null || version.exitCode !== 0) {
      return { id, installed: false, version: null, loggedIn: null }
    }
    const v = VERSION_RE.exec(version.stdout)?.[0] ?? null
    if (id === "claude-code") {
      const auth = yield* run("claude", ["auth", "status", "--json"])
      return {
        id,
        installed: true,
        version: v,
        loggedIn: auth ? parseClaudeAuth(auth.stdout) : null,
      }
    }
    const login = yield* run("codex", ["login", "status"])
    return { id, installed: true, version: v, loggedIn: login ? parseCodexLogin(login) : null }
  })

export const detectAll: Effect.Effect<
  ReadonlyArray<RunnerStatus>,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> = Effect.forEach(RUNNER_IDS, detectRunner, { concurrency: "unbounded" })

/**
 * Pick a runner: the requested engine, otherwise the first usable one in `RUNNER_IDS`
 * order (Claude Code first).
 */
export const chooseRunner = (
  statuses: ReadonlyArray<RunnerStatus>,
  preferred: RunnerId | null,
): Effect.Effect<RunnerStatus, NotInstalled | NotLoggedIn> => {
  const candidates = preferred ? statuses.filter((s) => s.id === preferred) : statuses
  const usable = candidates.find((s) => s.installed && s.loggedIn !== false)
  if (usable) return Effect.succeed(usable)
  const installed = candidates.find((s) => s.installed)
  if (installed) {
    return Effect.fail(new NotLoggedIn({ runner: installed.id, detail: "not logged in" }))
  }
  return Effect.fail(new NotInstalled({ runner: preferred ?? "claude-code" }))
}

export const makeRunner = (
  id: RunnerId,
  options: RunnerOptions,
): Effect.Effect<
  LlmRunnerShape,
  never,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> => (id === "claude-code" ? makeClaudeCodeRunner(options) : makeCodexRunner(options))
