import { describe, expect, it } from "@effect/vitest"
import { Effect, Fiber } from "effect"
import { TestClock } from "effect/testing"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { AnalysisFailed, type AnalyzeError } from "../../src/analysis/errors.ts"
import { renderError } from "../../src/cli/render-error.ts"
import { Interrupted, ProcessFailed, RateLimited } from "../../src/llm/LlmRunner.ts"
import { VERSION } from "../../src/version.ts"
import { makeHarness, ok, reportPath, type HarnessOptions } from "./harness.ts"

/*
 * First run and recovery (plan 24): what the user is told before, during and after a run,
 * with fictional histories and the fake runner. Nothing here reads real data.
 */

interface FakeSession {
  readonly id: string
  readonly project: string
  readonly prompts: ReadonlyArray<{ readonly at: string; readonly text: string }>
}

/** A fictional Claude Code history folder (`projects/<dir>/<session>.jsonl`). */
const claudeHistory = (sessions: ReadonlyArray<FakeSession>): string => {
  const root = mkdtempSync(join(tmpdir(), "pp-history-"))
  for (const s of sessions) {
    const dir = join(root, "projects", `-home-dev-${s.project}`)
    mkdirSync(dir, { recursive: true })
    const lines = s.prompts.map((p, i) =>
      JSON.stringify({
        type: "user",
        parentUuid: null,
        sessionId: s.id,
        cwd: `/home/dev/${s.project}`,
        version: "2.1.309",
        isSidechain: false,
        entrypoint: "cli",
        uuid: `${s.id}-${i}`,
        timestamp: p.at,
        message: { role: "user", content: p.text },
      }),
    )
    writeFileSync(join(dir, `${s.id}.jsonl`), `${lines.join("\n")}\n`)
  }
  return root
}

const oneSession = () =>
  claudeHistory([
    {
      id: "solo",
      project: "garden",
      prompts: [
        {
          at: "2026-10-01T09:00:00.000Z",
          text: "Add a watering schedule table to the garden planner page",
        },
        {
          at: "2026-10-01T09:05:00.000Z",
          text: "Show the next watering date next to each plant name",
        },
        {
          at: "2026-10-01T09:12:00.000Z",
          text: "Write a test for the schedule when two plants share a bed",
        },
      ],
    },
  ])

/** One short session per month for 32 months: more chunks than the default sample of 30. */
const longHistory = () =>
  claudeHistory(
    Array.from({ length: 32 }, (_, i) => {
      const month = new Date(Date.UTC(2024, 2 + i, 10, 9))
      return {
        id: `month-${i}`,
        project: "harbor",
        prompts: [
          {
            at: month.toISOString(),
            text: `Review the harbor booking form, step ${i + 1}: check berth number ${100 + i} is validated`,
          },
        ],
      }
    }),
  )

const onlyClaude = (dir: string): NonNullable<HarnessOptions["env"]> => ({
  env: { CLAUDE_CONFIG_DIR: dir, CODEX_HOME: "/nope/codex", XDG_CACHE_HOME: join(dir, "cache") },
})

/** Run the CLI while advancing virtual time (retry backoff) until it finishes. */
const runToEnd = (h: ReturnType<typeof makeHarness>, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(h.run(args))
    while (fiber.pollUnsafe() === undefined) {
      yield* TestClock.adjust("1 minute")
      yield* Effect.promise(() => new Promise((r) => setTimeout(r, 2)))
    }
    return yield* Fiber.join(fiber)
  })

const calls = (h: ReturnType<typeof makeHarness>) => h.fakes.reduce((n, f) => n + f.calls(), 0)

describe("before confirmation", () => {
  it.effect(
    "the preflight states coverage, what leaves the machine, quota and the free route",
    () =>
      Effect.gen(function* () {
        const h = makeHarness()
        const r = yield* h.run(["--since", "all"])
        // non-interactive without --yes: the summary is shown, then nothing is called
        expect(r.code).toBe(2)
        expect(calls(h)).toBe(0)
        // time window and per-source coverage of the range
        expect(r.stdout).toMatch(/Range: all time · \d{4}-\d\d-\d\d → 2026-09-0\d/)
        expect(r.stdout).toMatch(/In range: Claude Code 9 · Codex 7/)
        // cleaned versus selected prompt counts, and sampling
        expect(r.stdout).toMatch(
          /16 prompts in 8 sessions after cleaning → 16 selected in 2 chunks/,
        )
        expect(r.stdout).toContain("No sampling: every chunk is analysed")
        // local versus remote, quota and API keys
        expect(r.stdout).toContain("Read, cleaned and redacted on this computer")
        expect(r.stdout).toMatch(/Sent off this computer: .*through your logged-in Claude Code CLI/)
        expect(r.stdout).toMatch(/No API key: uses your subscription quota/)
        expect(r.stdout).toMatch(
          /base estimate 4 calls \(2 chunks \+ 1 final profile \+ 1 evidence review\)/,
        )
        expect(r.stdout).toMatch(/merges and retries .* can add calls/)
        expect(r.stdout).toContain("No hard limit: add --max-calls")
        // the free inspection route
        expect(r.stdout).toContain("--dry-run")
        expect(r.stdout).toContain("prompt-profile stats")
        expect(r.stderr).toContain("--dry-run")
      }),
  )

  it.effect("a hard budget and translations are part of the summary", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const r = yield* h.run(["--since", "all", "--max-calls", "9", "--lang", "zh-TW,en"])
      expect(r.stdout).toMatch(
        /base estimate 5 calls \(2 chunks \+ 1 final profile \+ 1 evidence review \+ 1 translation\)/,
      )
      expect(r.stdout).toContain("Hard limit: at most 9 CLI calls, including retries")
      expect(r.stdout).not.toContain("No hard limit")
    }),
  )

  it.effect("a large history says it is sampled", () =>
    Effect.gen(function* () {
      const dir = longHistory()
      const h = makeHarness({ env: onlyClaude(dir) })
      const r = yield* h.run(["--since", "all"])
      expect(r.stdout).toContain(
        "Large history: sampling 30 / 32 chunks (--full analyses everything)",
      )
      expect(r.stdout).toMatch(
        /32 prompts in 32 sessions after cleaning → 30 selected in 30 chunks/,
      )
      expect(calls(h)).toBe(0)
    }),
  )

  it.effect("declining the confirmation calls nothing", () =>
    Effect.gen(function* () {
      const h = makeHarness({ env: { isTTY: true }, keys: ["n"] })
      const r = yield* h.run(["--since", "all", "--out", join(h.root, "out")])
      expect(r.code).toBe(0)
      expect(r.stdout).toContain("Cancelled. No LLM was called and nothing was sent.")
      expect(calls(h)).toBe(0)
      expect(existsSync(join(h.root, "out"))).toBe(false)
    }),
  )

  it.effect("help names the remote analysis, the quota and the free routes", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const r = yield* h.run(["--help"])
      expect(r.stdout).toContain("logged-in claude or codex CLI")
      expect(r.stdout).toContain("subscription quota")
      expect(r.stdout).toContain("no API key")
      expect(r.stdout).not.toContain("prompts locally and generate")
      expect(r.stdout).toMatch(/--dry-run .*free/s)
    }),
  )
})

describe("--dry-run", () => {
  it.effect("shows the same summary, calls nothing and says where the sensitive files are", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "dry")
      const r = yield* h.run(["--dry-run", "--out", out, "--since", "all"])
      expect(r.code).toBe(0)
      expect(h.fakes).toHaveLength(0)
      expect(r.stdout).toMatch(/16 prompts in 8 sessions after cleaning → 16 selected in 2 chunks/)
      expect(r.stdout).toContain("No LLM was called")
      expect(r.stdout).toContain(`${out}/chunks/`)
      expect(r.stdout).toMatch(/redacted prompt text/)
      expect(r.stdout).toMatch(/delete .* when done/)
      const plan = JSON.parse(readFileSync(join(out, "plan.json"), "utf8"))
      expect(plan.llmCallsEstimate).toMatch(/translations/)
    }),
  )

  it.effect("works without a logged-in CLI and says a real run needs one", () =>
    Effect.gen(function* () {
      const h = makeHarness({ statuses: [{ ...ok("claude-code"), loggedIn: false }] })
      const r = yield* h.run(["--dry-run", "--out", join(h.root, "dry"), "--since", "all"])
      expect(r.code).toBe(0)
      expect(h.fakes).toHaveLength(0)
      expect(r.stdout).toContain("No logged-in Claude Code or Codex found")
    }),
  )
})

describe("during and after a run", () => {
  it.effect("progress names each phase and never shows a time estimate", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const r = yield* h.run(["--yes", "--since", "all", "--lang", "en,zh-TW"])
      expect(r.code).toBe(0)
      const phases = [
        "● Analysing",
        "● Writing the profile",
        "● Verifying evidence",
        "● Translating into zh-TW",
        "● Writing report files",
      ]
      const at = phases.map((p) => r.stdout.indexOf(p))
      expect(at.every((i) => i >= 0)).toBe(true)
      expect(at).toEqual([...at].toSorted((a, b) => a - b))
      expect(r.stdout).not.toMatch(/remaining|ETA|minutes? left|about \d+ (s|min)/i)
    }),
  )

  it.effect("one session gives a report with observations, no role and no coaching", () =>
    Effect.gen(function* () {
      const dir = oneSession()
      const h = makeHarness({ env: onlyClaude(dir) })
      const out = join(h.root, "out")
      const r = yield* h.run(["--yes", "--since", "all", "--out", out])
      expect(r.code).toBe(0)
      expect(r.stdout).toMatch(/3 prompts in 1 session after cleaning/)
      expect(r.stdout).toContain("Limited evidence")
      const page = readFileSync(reportPath(out, "report.html"), "utf8")
      expect(page).toContain("Early observations")
      // the generated role name is not presented as an identity
      expect(page).not.toContain("The Fixer")
      expect(page).not.toContain('class="coaching"')
      // observations and measurements stay readable
      expect(page).toContain('class="dims"')
      expect(page).toContain('class="sigs"')
      expect(existsSync(reportPath(out, "card.png"))).toBe(true)
    }),
  )

  it.effect("a failed translation keeps the report and gives the command that adds it", () =>
    Effect.gen(function* () {
      const failed = new ProcessFailed({
        runner: "claude-code",
        exitCode: 1,
        detail: "x",
        stderrTail: "",
      })
      // 2 chunks + final profile + evidence review, then the translation fails
      const h = makeHarness({ fake: { failures: new Map([[5, failed]]) } })
      const out = join(h.root, "out")
      const r = yield* h.run(["--yes", "--since", "all", "--out", out, "--lang", "zh-TW,en"])
      expect(r.code).toBe(0)
      const profile = JSON.parse(readFileSync(reportPath(out, "profile.json"), "utf8"))
      expect(profile.languages).toEqual(["en"])
      expect(r.stdout).toContain("zh-TW is missing")
      expect(r.stdout).toContain(`prompt-profile --since all --out ${out} --lang zh-TW,en --yes`)
      // the suggested re-run reuses the cached chunks: final profile + evidence review + translation only
      const again = makeHarness({ env: { ...h.environment } })
      const r2 = yield* again.run(["--since", "all", "--out", out, "--lang", "zh-TW,en", "--yes"])
      expect(r2.code).toBe(0)
      expect(calls(again)).toBe(3)
      expect(JSON.parse(readFileSync(reportPath(out, "profile.json"), "utf8")).languages).toEqual([
        "zh-TW",
        "en",
      ])
    }),
  )

  it.effect("a missing card gives the render command that retries it without analysis", () =>
    Effect.gen(function* () {
      const h = makeHarness({ cjkFontsFail: true })
      const out = join(h.root, "out")
      const r = yield* h.run(["--yes", "--since", "all", "--out", out, "--lang", "zh-TW,en"])
      expect(r.code).toBe(0)
      expect(existsSync(reportPath(out, "card.png"))).toBe(false)
      expect(existsSync(reportPath(out, "card.en.png"))).toBe(true)
      expect(r.stdout).toContain("(zh-TW) not created: font download failed")
      expect(r.stdout).toContain(
        `Retry missing cards without new analysis: prompt-profile render ${reportPath(out, "profile.json")}`,
      )
      // the command works once the font is available, and calls no LLM
      const fixed = makeHarness({ env: { ...h.environment } })
      const r2 = yield* fixed.run(["render", `${reportPath(out, "profile.json")}`])
      expect(r2.code).toBe(0)
      expect(
        existsSync(
          join(dirname(reportPath(out, "profile.json")), "variants", "classic", "card.png"),
        ),
      ).toBe(true)
      expect(fixed.fakes).toHaveLength(0)
    }),
  )
})

describe("recovery", () => {
  it.effect("does not write a report when the budget ends between drafting and review", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "review-budget")
      const result = yield* h.run(["--yes", "--since", "all", "--out", out, "--max-calls", "3"])
      expect(result.code).toBe(1)
      expect(calls(h)).toBe(3)
      expect(result.stderr).toContain("No report was written")
      expect(existsSync(reportPath(out, "profile.json"))).toBe(false)
      expect(existsSync(reportPath(out, "report.html"))).toBe(false)
      const again = makeHarness({ env: { ...h.environment } })
      const resumed = yield* again.run([
        "--yes",
        "--since",
        "all",
        "--out",
        out,
        "--max-calls",
        "2",
      ])
      expect(resumed.code).toBe(0)
      expect(calls(again)).toBe(2)
    }),
  )

  it.effect("a call budget states what is saved; the given command resumes from the cache", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "out")
      // 2 chunk calls fit, the final profile call does not
      const r = yield* h.run(["--yes", "--since", "all", "--out", out, "--max-calls", "2"])
      expect(r.code).toBe(1)
      expect(r.stderr).toContain("call budget of 2")
      expect(r.stderr).toContain("saved in the analysis cache")
      expect(r.stderr).toContain("No report was written")
      expect(r.stderr).toContain("the final profile step and translations always run again")
      const command = `prompt-profile --since all --out ${out} --max-calls 2 --yes`
      expect(r.stderr).toContain(command)
      expect(existsSync(reportPath(out, "report.html"))).toBe(false)
      const again = makeHarness({ env: { ...h.environment } })
      expect(command.startsWith("prompt-profile ")).toBe(true)
      const r2 = yield* again.run(command.slice("prompt-profile ".length).split(" "))
      expect(r2.code).toBe(0)
      // draft and review are called: both chunks come from the cache
      expect(calls(again)).toBe(2)
      expect(existsSync(reportPath(out, "report.html"))).toBe(true)
    }),
  )

  it.effect("started through npx, the recovery command runs through npx at the same version", () =>
    Effect.gen(function* () {
      const base = makeHarness()
      const h = makeHarness({ env: { env: { ...base.environment.env, npm_command: "exec" } } })
      const r = yield* h.run(["--yes", "--since", "all", "--max-calls", "1"])
      expect(r.code).toBe(1)
      expect(r.stderr).toContain(
        `\n  npx prompt-profile@${VERSION} --since all --max-calls 1 --yes`,
      )
      expect(r.stderr).not.toMatch(/\n  prompt-profile --since/)
    }),
  )

  it.effect("installed, the recovery command is the installed command itself", () =>
    Effect.gen(function* () {
      const r = yield* makeHarness().run(["--yes", "--since", "all", "--max-calls", "1"])
      expect(r.stderr).toContain("\n  prompt-profile --since all --max-calls 1 --yes")
    }),
  )

  it.effect("--no-cache is dropped from the recovery command: it must read the cache", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const r = yield* h.run(["--yes", "--since", "all", "--no-cache", "--max-calls", "1"])
      expect(r.code).toBe(1)
      expect(r.stderr).toContain("prompt-profile --since all --max-calls 1 --yes")
      expect(r.stderr).not.toContain("--no-cache")
    }),
  )

  it.effect.each([
    ["rate limit", new RateLimited({ runner: "claude-code", detail: "x" }), 5],
    ["interrupted CLI", new Interrupted({ runner: "claude-code" }), 130],
  ] as const)("%s: what is saved and the exact command", ([_name, error, code]) =>
    Effect.gen(function* () {
      const h = makeHarness({
        fake: { failures: new Map([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => [i, error] as const)) },
      })
      const r = yield* runToEnd(h, ["--yes", "--since", "3m", "--engine", "claude"])
      expect(r.code).toBe(code)
      expect(r.stderr).toContain("saved in the analysis cache")
      expect(r.stderr).toContain("prompt-profile --since 3m --engine claude --yes")
      expect(r.stderr).not.toMatch(/continue where it stopped/)
    }),
  )

  it.effect("a failed final step says only that step and translations repeat", () =>
    Effect.gen(function* () {
      const failed = new ProcessFailed({
        runner: "codex",
        exitCode: 2,
        detail: "x",
        stderrTail: "",
      })
      const h = makeHarness({ statuses: [ok("codex")], fake: { failures: new Map([[3, failed]]) } })
      const r = yield* h.run(["--yes", "--since", "all"])
      expect(r.code).toBe(1)
      expect(r.stderr).toContain("final profile step failed")
      expect(r.stderr).toContain("prompt-profile --since all --yes")
    }),
  )

  it.effect("a not-logged-in CLI points to the free routes", () =>
    Effect.gen(function* () {
      const h = makeHarness({ statuses: [{ ...ok("codex"), loggedIn: false }] })
      const r = yield* h.run(["--yes", "--since", "all"])
      expect(r.code).toBe(4)
      expect(r.stderr).toContain("codex login")
      expect(r.stderr).toContain("--dry-run")
      expect(r.stderr).toContain("prompt-profile stats")
      expect(calls(h)).toBe(0)
    }),
  )
})

describe("rendered errors", () => {
  it("a CLI failure never prints its message (it may quote a prompt) without --verbose", () => {
    const secret = "Add a watering schedule table to the garden planner page"
    const e = new ProcessFailed({
      runner: "claude-code",
      exitCode: 1,
      detail: `bad request: ${secret}`,
      stderrTail: "",
    })
    const { message } = renderError(e, "prompt-profile --since all --yes")
    expect(message).not.toContain(secret)
    expect(message).toContain("--verbose")
    expect(message).toContain("prompt-profile --since all --yes")
  })

  it("a failed merge says unfinished merges, the final profile and translations run again", () => {
    const merge = renderError(
      new AnalysisFailed({ reason: "merge-failed", chunksFailed: 0, chunksTotal: 4 }),
      "prompt-profile --since all --yes",
    ).message
    expect(merge).toContain("merge")
    expect(merge).toContain("unfinished merges")
    expect(merge).not.toContain("repeats only the final profile")
    const reduce = renderError(
      new AnalysisFailed({ reason: "reduce-failed", chunksFailed: 0, chunksTotal: 4 }),
      "prompt-profile --since all --yes",
    ).message
    expect(reduce).toContain("final profile")
    expect(reduce).not.toContain("unfinished merges")
  })

  it("without a command context it still says what to do", () => {
    const e: AnalyzeError = new AnalysisFailed({
      reason: "reduce-failed",
      chunksFailed: 0,
      chunksTotal: 2,
    })
    expect(renderError(e).message).toContain("run the same command again")
  })
})
