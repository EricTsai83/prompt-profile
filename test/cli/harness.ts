import { NodeServices } from "@effect/platform-node"
import { Effect, Exit as EffectExit, Layer } from "effect"
import { TestClock, TestConsole } from "effect/testing"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCli } from "../../src/cli/main.ts"
import { FontSource, LlmProvider, Opener } from "../../src/cli/services.ts"
import { embeddedFonts } from "../../src/report/fonts.ts"
import type { RunnerStatus } from "../../src/llm/detect.ts"
import { makeFakeLlmRunner, type FakeLlmRunner, type FakeOptions } from "../../src/llm/fake.ts"
import { Environment, type EnvironmentShape } from "../../src/platform/Environment.ts"

export const fixture = (name: string) => new URL(`../fixtures/${name}`, import.meta.url).pathname

/** Fake LLM: quotes the first prompt of each chunk; builds a profile from observations. */
export const respond: FakeOptions["respond"] = ({ prompt, schemaName }) => {
  if (schemaName === "LlmTranslation") {
    // Prefix every string except dimension keys.
    const tr = (x: unknown): unknown =>
      typeof x === "string"
        ? `譯 ${x}`
        : Array.isArray(x)
          ? x.map(tr)
          : Object.fromEntries(
              Object.entries(x as object).map(([k, v]) => [k, k === "key" ? v : tr(v)]),
            )
    return tr(JSON.parse(/\nprofile:\n(.*)$/s.exec(prompt)![1]!))
  }
  if (schemaName === "LlmChunkObservations") {
    const m = /<prompt id="([^"]+)"[^>]*>\n(.{1,20})/.exec(prompt)!
    return {
      observations: [
        {
          dimension: "communication",
          claim: "direct",
          evidence: [{ promptId: m[1], quote: m[2] }],
        },
      ],
    }
  }
  const obs = JSON.parse(/observations:\n(.*)\n\nstats:/s.exec(prompt)![1]!) as Array<{
    evidence: Array<{ promptId: string; quote: string }>
  }>
  const evidence = obs.flatMap((o) => o.evidence)
  return {
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
  }
}

export interface HarnessOptions {
  readonly env?: Partial<EnvironmentShape>
  readonly statuses?: ReadonlyArray<RunnerStatus>
  readonly fake?: FakeOptions
}

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
      cjk: () => Effect.succeed(embeddedFonts().map((f) => ({ ...f, name: "Noto Sans TC" }))),
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
  ).pipe(Layer.provideMerge(NodeServices.layer))

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
