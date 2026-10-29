import { NodeServices } from "@effect/platform-node"
import { Effect, Exit as EffectExit, Layer, Option, Queue, Terminal, type Cause } from "effect"
import { TestClock, TestConsole } from "effect/testing"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCli } from "../../src/cli/main.ts"
import { FontSource, LlmProvider, Opener } from "../../src/cli/services.ts"
import { embeddedFonts, FontUnavailable } from "../../src/report/fonts.ts"
import type { RunnerStatus } from "../../src/llm/detect.ts"
import { makeFakeLlmRunner, type FakeLlmRunner, type FakeOptions } from "../../src/llm/fake.ts"
import { Environment, type EnvironmentShape } from "../../src/platform/Environment.ts"

export const fixture = (name: string) => new URL(`../fixtures/${name}`, import.meta.url).pathname

/** Fake LLM: quotes the first prompt of each chunk; builds a profile from observations. */
export const respond: FakeOptions["respond"] = ({ prompt, schemaName }) => {
  if (schemaName === "LlmTranslation") {
    // Prefix every string except dimension keys.
    const tr = (x: unknown): unknown =>
      x === null
        ? null
        : typeof x === "string"
          ? `譯 ${x}`
          : Array.isArray(x)
            ? x.map(tr)
            : Object.fromEntries(
                Object.entries(x as object).map(([k, v]) => [k, k === "key" ? v : tr(v)]),
              )
    return tr(JSON.parse(/\nprofile:\n(.*)$/s.exec(prompt)![1]!))
  }
  if (schemaName === "LlmChunkAnalysis") {
    const m = /<prompt id="([^"]+)"[^>]*>\n(.{1,20})/.exec(prompt)!
    return {
      observations: [
        {
          dimension: "communication",
          claim: "direct",
          evidence: [{ promptId: m[1], quote: m[2] }],
        },
      ],
      episodes: [],
    }
  }
  const obs = JSON.parse(/observations:\n(.*)\n\nstats:/s.exec(prompt)![1]!) as Array<{
    evidence: Array<{ promptId: string; quote: string }>
  }>
  const evidence = obs.flatMap((o) => o.evidence)
  return {
    portrait: null,
    headline: "A focused developer",
    archetype: { name: "The Fixer", description: "Fixes things." },
    dimensions: ["work_style", "communication", "tech_profile", "interests", "growth"].map(
      (key) => ({
        key,
        title: key,
        summary: "summary",
        evidence: evidence.slice(0, 1),
      }),
    ),
    traits: [
      { name: "Direct", description: "d", confidence: "high", evidence: evidence.slice(0, 2) },
    ],
    funFacts: ["fact"],
    patterns: [],
    improvements: [
      {
        title: "Name the file",
        pattern: "p",
        impact: "i",
        suggestion: "s",
        evidence: evidence.slice(0, 1),
        rewrite: { promptId: evidence[0]?.promptId ?? "", after: "In src/app.ts, rename x." },
      },
    ],
  }
}

export interface HarnessOptions {
  readonly env?: Partial<EnvironmentShape>
  readonly statuses?: ReadonlyArray<RunnerStatus>
  readonly fake?: FakeOptions
  /** The CJK card font cannot be loaded (e.g. its download failed). */
  readonly cjkFontsFail?: boolean
  /** Keys typed at a prompt (with `env.isTTY`); input ends after them. */
  readonly keys?: ReadonlyArray<string>
}

/** A terminal that "types" `keys`, then ends its input. */
const scriptedTerminal = (keys: ReadonlyArray<string>) =>
  Terminal.make({
    columns: Effect.succeed(80),
    rows: Effect.succeed(24),
    readInput: Effect.gen(function* () {
      const queue = yield* Queue.unbounded<Terminal.UserInput, Cause.Done>()
      yield* Queue.offerAll(
        queue,
        keys.map((k) => ({
          input: Option.some(k),
          key: { name: k, ctrl: false, meta: false, shift: false },
        })),
      )
      yield* Queue.end(queue)
      return queue
    }),
    readLine: Effect.succeed(""),
    display: () => Effect.void,
  })

export const ok = (id: "claude-code" | "codex"): RunnerStatus => ({
  id,
  installed: true,
  version: "1.0.0",
  loggedIn: true,
})

export const makeHarness = (options: HarnessOptions = {}) => {
  const root = mkdtempSync(join(tmpdir(), "pp-cli-"))
  const fakes: Array<FakeLlmRunner> = []
  const opened: Array<string> = []
  const environment: EnvironmentShape = {
    home: join(root, "home"),
    env: {
      CLAUDE_CONFIG_DIR: fixture("claude-code"),
      CODEX_HOME: fixture("codex"),
      XDG_CACHE_HOME: join(root, "cache"),
    },
    cwd: root,
    timezone: "Asia/Taipei",
    username: "dev",
    isTTY: false,
    platform: "linux",
    locale: "en_US.UTF-8",
    ...options.env,
  }
  const layer = Layer.mergeAll(
    Layer.succeed(Environment, environment),
    // No download in tests: Inter stands in for the CJK font (missing glyphs render empty).
    Layer.succeed(FontSource, {
      cjk: () =>
        options.cjkFontsFail
          ? Effect.fail(new FontUnavailable({ reason: "font download failed" }))
          : Effect.succeed(embeddedFonts().map((f) => ({ ...f, name: "Noto Sans TC" }))),
    }),
    Layer.succeed(LlmProvider, {
      detect: Effect.succeed(options.statuses ?? [ok("claude-code"), ok("codex")]),
      make: (id) =>
        Effect.sync(() => {
          const fake = makeFakeLlmRunner({ id, respond, ...options.fake })
          fakes.push(fake)
          return fake
        }),
    }),
    Layer.succeed(Opener, { open: (f) => Effect.sync(() => (opened.push(f), true)) }),
    TestConsole.layer,
  ).pipe(Layer.provideMerge(NodeServices.layer), (services) =>
    options.keys
      ? Layer.merge(services, Layer.succeed(Terminal.Terminal, scriptedTerminal(options.keys)))
      : services,
  )

  /** Run the CLI; returns exit code and captured output. */
  const run = (args: ReadonlyArray<string>) =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse("2026-10-24T00:00:00Z"))
      const exit = yield* Effect.exit(runCli(args))
      const code = EffectExit.isSuccess(exit)
        ? 0
        : (() => {
            const err = exit.cause.reasons.find((r) => r._tag === "Fail")
            return err && err._tag === "Fail" && (err.error as { _tag?: string })._tag === "Exit"
              ? (err.error as unknown as { code: number }).code
              : -1
          })()
      const stdout = (yield* TestConsole.logLines).join("\n")
      const stderr = (yield* TestConsole.errorLines).join("\n")
      return { code, stdout, stderr, exit }
    }).pipe(Effect.provide(layer))

  return { root, run, fakes, opened, environment }
}
