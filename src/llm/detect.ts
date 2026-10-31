import { Effect, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { makeClaudeCodeRunner } from "./claude.ts"
import { isNotFound } from "./process.ts"
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
import { planCode, type PlanInfo } from "../domain/index.ts"

export interface RunnerStatus {
  readonly id: RunnerId
  readonly installed: boolean
  readonly version: string | null
  /** `null` when it could not be determined (we then let the first call decide). */
  readonly loggedIn: boolean | null
  /** Claude Code only: the plan `claude auth status` reports (plan 23). */
  readonly plan?: PlanInfo
}

interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

/** A first start or a self-update can take a while; the CLI is not "missing" then. */
const DETECT_TIMEOUT = "15 seconds"

type RunResult =
  | ({ readonly _tag: "Done" } & CommandResult)
  | { readonly _tag: "NotFound" }
  | { readonly _tag: "TimedOut" }
  | { readonly _tag: "Failed" }

const run = (
  command: string,
  args: ReadonlyArray<string>,
): Effect.Effect<RunResult, never, ChildProcessSpawner.ChildProcessSpawner> =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const handle = yield* spawner.spawn(
      ChildProcess.make(command, [...args], { extendEnv: true, stdin: "ignore" }),
    )
    // stderr is read too: a full pipe would block the child, and some CLIs report there
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        Stream.mkString(Stream.decodeText(handle.stdout)),
        Stream.mkString(Stream.decodeText(handle.stderr)),
        handle.exitCode,
      ],
      { concurrency: "unbounded" },
    )
    return { _tag: "Done", exitCode: Number(exitCode), stdout, stderr } as const
  }).pipe(
    Effect.scoped,
    Effect.timeoutOption(DETECT_TIMEOUT),
    Effect.map((o): RunResult => (o._tag === "Some" ? o.value : { _tag: "TimedOut" })),
    Effect.catch((error) =>
      Effect.succeed<RunResult>(isNotFound(error) ? { _tag: "NotFound" } : { _tag: "Failed" }),
    ),
  )

/** Parse `claude auth status --json`. Only `loggedIn` is read (the output also has the email). */
export const parseClaudeAuth = (stdout: string): boolean | null => {
  const json = tryParseJson(stdout) as { loggedIn?: unknown } | undefined
  return typeof json?.loggedIn === "boolean" ? json.loggedIn : null
}

/** `codex login status` prints e.g. "Logged in using ChatGPT" / "Not logged in" — on stderr. */
export const parseCodexLogin = (result: CommandResult): boolean | null => {
  const text = `${result.stdout}\n${result.stderr}`
  if (/not logged in/i.test(text)) return false
  if (/logged in/i.test(text)) return true
  return result.exitCode === 0 ? null : false
}

/**
 * The plan in `claude auth status --json`: `subscriptionType` (e.g. "team"), or an API-key
 * login. Nothing else is read: the output also has the email and organization.
 */
export const parseClaudePlan = (stdout: string): PlanInfo | null => {
  const json = tryParseJson(stdout) as
    | { subscriptionType?: unknown; authMethod?: unknown }
    | undefined
  if (typeof json !== "object" || json === null) return null
  const name = planCode(json.subscriptionType)
  if (name !== null) return { kind: "subscription", name, detail: null }
  if (typeof json.authMethod === "string" && /api.?key/i.test(json.authMethod))
    return { kind: "api-key", name: null, detail: null }
  return { kind: "unknown", name: null, detail: null }
}

const VERSION_RE = /\d+\.\d+\.\d+/

/** Detect installation (via `--version`) and login state, without sending any prompt. */
export const detectRunner = (
  id: RunnerId,
): Effect.Effect<RunnerStatus, never, ChildProcessSpawner.ChildProcessSpawner> =>
  Effect.gen(function* () {
    const command = id === "claude-code" ? "claude" : "codex"
    const version = yield* run(command, ["--version"])
    // Too slow to answer: installed, state unknown — the first real call decides.
    if (version._tag === "TimedOut") return { id, installed: true, version: null, loggedIn: null }
    if (version._tag !== "Done" || version.exitCode !== 0) {
      return { id, installed: false, version: null, loggedIn: null }
    }
    const v = VERSION_RE.exec(version.stdout)?.[0] ?? null
    if (id === "claude-code") {
      const auth = yield* run("claude", ["auth", "status", "--json"])
      const plan = auth._tag === "Done" ? parseClaudePlan(auth.stdout) : null
      return {
        id,
        installed: true,
        version: v,
        loggedIn: auth._tag === "Done" ? parseClaudeAuth(auth.stdout) : null,
        ...(plan === null ? {} : { plan }),
      }
    }
    const login = yield* run("codex", ["login", "status"])
    return {
      id,
      installed: true,
      version: v,
      loggedIn: login._tag === "Done" ? parseCodexLogin(login) : null,
    }
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
