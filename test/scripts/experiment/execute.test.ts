import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Fiber } from "effect"
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  createExperimentDir,
  outcomeOf,
  runExperiment,
  type Manifest,
} from "../../../scripts/experiment/execute.ts"
import { InvalidOutput, ProcessFailed } from "../../../src/llm/LlmRunner.ts"
import { selection } from "../../../scripts/experiment/prepare.ts"
import { respond } from "../../cli/harness.ts"
import { configOf, fakeDeps, LENIENT_RUBRIC, prepareAll, provenance } from "./helpers.ts"

const tmp = () => mkdtempSync(join(tmpdir(), "pp-exp-"))

const matrix = (extra: Record<string, unknown> = {}) =>
  configOf({
    personas: ["curious-learner"],
    repeats: 2,
    baseline: "claude-default",
    variants: [
      { id: "claude-default", engine: "claude", model: null },
      { id: "claude-opus", engine: "claude", model: "opus" },
      { id: "codex-default", engine: "codex", model: null },
    ],
    ...extra,
  })

const run = (config = matrix(), deps = fakeDeps().deps, budget = 500, root = tmp()) => {
  const prepared = prepareAll(config)
  return runExperiment(
    { id: "exp", root, config, configSha256: "cfg", prepared, budget, provenance },
    deps,
  ).pipe(Effect.map((manifest) => ({ manifest, root, prepared })))
}

const json = (file: string) => JSON.parse(readFileSync(file, "utf8"))
const mode = (file: string) => statSync(file).mode & 0o777

describe("runExperiment", () => {
  it.effect("forwards each variant's engine and model, on identical prepared input", () => {
    const fake = fakeDeps()
    return Effect.gen(function* () {
      const { manifest, root } = yield* run(matrix(), fake.deps)
      expect(manifest.outcome).toBe("passed")
      expect(manifest.exitCode).toBe(0)
      // persona → repeat → variant: variants interleave within each repetition
      expect(manifest.cases.map((c) => c.id)).toEqual([
        "curious-learner/claude-default/r1",
        "curious-learner/claude-opus/r1",
        "curious-learner/codex-default/r1",
        "curious-learner/claude-default/r2",
        "curious-learner/claude-opus/r2",
        "curious-learner/codex-default/r2",
      ])
      // one fresh runner per case, never a substituted engine or model
      expect(fake.requests).toEqual([
        { engine: "claude-code", model: null },
        { engine: "claude-code", model: "opus" },
        { engine: "codex", model: null },
        { engine: "claude-code", model: null },
        { engine: "claude-code", model: "opus" },
        { engine: "codex", model: null },
      ])
      const inputs = new Set(manifest.cases.map((c) => JSON.stringify(c.input)))
      expect(inputs.size).toBe(1)
      // cache disabled: every repetition makes all of its calls again
      const perCase = manifest.cases.map((c) => c.calls.attempts)
      expect(new Set(perCase).size).toBe(1)
      expect(perCase[0]).toBeGreaterThan(1)
      expect(manifest.budget.used).toBe(perCase[0]! * 6)
      const opus = manifest.cases[1]!
      expect(opus.model).toEqual({ requested: "opus", reported: ["opus"], echoed: [] })
      expect(opus.changedFactors).toEqual(["model"])
      for (const c of manifest.cases) {
        expect(c.status).toBe("ok")
        for (const f of ["profile.json", "quality.json", "run.json"])
          expect(mode(join(root, c.dir, f))).toBe(0o600)
      }
      expect(mode(join(root, "manifest.json"))).toBe(0o600)
      expect(mode(join(root, "cases"))).toBe(0o700)
      const saved: Manifest = json(join(root, "manifest.json"))
      expect(saved.outcome).toBe("passed")
      expect(saved.provenance.git.revision).toBe("abc123")
    }).pipe(Effect.provide(NodeServices.layer))
  })

  it.effect("counts retries against the cap and skips cases that cannot finish", () => {
    // The first call of every runner fails once and is retried.
    const fake = fakeDeps({
      fake: () => ({
        failures: new Map([[1, new InvalidOutput({ runner: "claude-code", detail: "bad" })]]),
      }),
    })
    const config = matrix({
      variants: [{ id: "claude-default", engine: "claude", model: null }],
    })
    const prepared = prepareAll(config)
    const minimum = selection(prepared.get("curious-learner")!, config.variants[0]!).minimumCalls
    // Enough for the first case including its retry, not for a second one.
    const budget = minimum + 1 + minimum - 1
    return Effect.gen(function* () {
      const { manifest, root } = yield* run(config, fake.deps, budget)
      const [first, second] = manifest.cases
      expect(first!.status).toBe("ok")
      expect(first!.calls).toEqual({
        attempts: minimum + 1,
        failedAttempts: 1,
        errorCategories: { InvalidOutput: 1 },
      })
      expect(second!.status).toBe("budget-skipped")
      expect(second!.calls.attempts).toBe(0)
      expect(manifest.budget).toEqual({ cap: budget, used: minimum + 1 })
      expect(manifest.outcome).toBe("incomplete")
      expect(manifest.exitCode).toBe(5)
      // failure metadata is written without a profile
      expect(existsSync(join(root, second!.dir, "run.json"))).toBe(true)
      expect(existsSync(join(root, second!.dir, "profile.json"))).toBe(false)
    }).pipe(Effect.provide(NodeServices.layer))
  })

  it.effect("stops at the cap mid-case, records budget-exhausted and starts nothing else", () => {
    const fake = fakeDeps({
      fake: () => ({
        failures: new Map([[1, new InvalidOutput({ runner: "claude-code", detail: "bad" })]]),
      }),
    })
    const config = matrix({ variants: [{ id: "claude-default", engine: "claude", model: null }] })
    const minimum = selection(
      prepareAll(config).get("curious-learner")!,
      config.variants[0]!,
    ).minimumCalls
    return Effect.gen(function* () {
      // Exactly the minimum: the case starts, but its retry uses the last allowed attempt.
      const { manifest } = yield* run(config, fake.deps, minimum)
      expect(manifest.cases.map((c) => c.status)).toEqual(["budget-exhausted", "budget-skipped"])
      expect(manifest.cases[0]!.error).toMatch(/CallBudgetExceeded/)
      expect(manifest.budget.used).toBe(minimum)
      expect(fake.calls()).toBe(minimum)
      expect(manifest.outcome).toBe("incomplete")
    }).pipe(Effect.provide(NodeServices.layer))
  })

  it.effect("does not call a case ok when the cap silently dropped a translation", () => {
    const config = matrix({
      repeats: 1,
      shared: { languages: ["en", "zh-TW"] },
      variants: [{ id: "claude-default", engine: "claude", model: null }],
    })
    const minimum = selection(
      prepareAll(config).get("curious-learner")!,
      config.variants[0]!,
    ).minimumCalls
    // The first call fails once: its retry takes the attempt meant for the translation.
    const fake = fakeDeps({
      fake: () => ({
        failures: new Map([[1, new InvalidOutput({ runner: "claude-code", detail: "bad" })]]),
      }),
    })
    return Effect.gen(function* () {
      const { manifest, root } = yield* run(config, fake.deps, minimum)
      expect(manifest.cases[0]!.status).toBe("budget-exhausted")
      expect(manifest.outcome).toBe("incomplete")
      expect(existsSync(join(root, manifest.cases[0]!.dir, "profile.json"))).toBe(false)
    }).pipe(Effect.provide(NodeServices.layer))
  })

  it.effect("fails the quality gate when a requested language could not be generated", () => {
    const config = matrix({
      repeats: 1,
      shared: { languages: ["en", "zh-TW"] },
      variants: [{ id: "claude-default", engine: "claude", model: null }],
    })
    const fake = fakeDeps({
      fake: () => ({
        respond: (input) => (input.schemaName === "LlmTranslation" ? { nope: 1 } : respond!(input)),
      }),
    })
    return Effect.gen(function* () {
      const { manifest } = yield* run(config, fake.deps)
      expect(manifest.cases[0]!.status).toBe("ok")
      expect(manifest.cases[0]!.quality!.failures).toContain("Missing requested language: zh-TW")
      expect(manifest.outcome).toBe("quality-failed")
    }).pipe(Effect.provide(NodeServices.layer))
  })

  it.live("on Ctrl-C records the running and the unstarted cases as interrupted", () => {
    const config = matrix({ repeats: 1 })
    // The second case's first call never returns; the run is interrupted while it waits.
    let made = 0
    const fake = fakeDeps({
      fake: () => (++made === 2 ? { failures: new Map([[1, "hang" as const]]) } : {}),
    })
    const root = tmp()
    return Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(run(config, fake.deps, 500, root))
      for (let i = 0; i < 200 && fake.calls() < 7; i++) yield* Effect.sleep("5 millis")
      yield* Fiber.interrupt(fiber)
      const saved: Manifest = json(join(root, "manifest.json"))
      expect(saved.outcome).toBe("interrupted")
      expect(saved.exitCode).toBe(4)
      expect(saved.cases.map((c) => [c.variant, c.status])).toEqual([
        ["claude-default", "ok"],
        ["claude-opus", "interrupted"],
        ["codex-default", "interrupted"],
      ])
      expect(saved.cases[1]!.startedAt).not.toBeNull()
      expect(saved.cases[2]!.startedAt).toBeNull()
      for (const c of saved.cases) expect(existsSync(join(root, c.dir, "run.json"))).toBe(true)
      // calls in flight when interrupted are still counted for their case
      expect(saved.cases[1]!.calls.attempts).toBeGreaterThan(0)
      expect(saved.cases[1]!.calls.errorCategories.Interrupted).toBeGreaterThan(0)
      expect(saved.cases.reduce((n, c) => n + c.calls.attempts, 0)).toBe(saved.budget.used)
    }).pipe(Effect.provide(NodeServices.layer))
  })

  it.effect("fails the quality gate when a profile misses the persona rubric", () => {
    const config = matrix({
      repeats: 1,
      variants: [{ id: "claude-default", engine: "claude", model: null }],
    })
    const prepared = prepareAll(config, { ...LENIENT_RUBRIC, minTraits: 99 })
    return Effect.gen(function* () {
      const manifest = yield* runExperiment(
        { id: "exp", root: tmp(), config, configSha256: "cfg", prepared, budget: 100, provenance },
        fakeDeps().deps,
      )
      expect(manifest.cases[0]!.quality!.failures).toContain("Too few traits")
      expect(manifest.outcome).toBe("quality-failed")
      expect(manifest.exitCode).toBe(6)
    }).pipe(Effect.provide(NodeServices.layer))
  })

  it.effect("records an unsupported model as failed without falling back to the default", () => {
    const fake = fakeDeps({
      fake: (_engine, model) =>
        model === "no-such-model"
          ? {
              respond: () => {
                throw new Error("unreachable")
              },
              failures: new Map(
                Array.from({ length: 50 }, (_, i) => [
                  i + 1,
                  new ProcessFailed({
                    runner: "claude-code",
                    exitCode: 1,
                    detail: "model not found",
                    stderrTail: "",
                  }),
                ]),
              ),
            }
          : {},
    })
    const config = matrix({
      repeats: 1,
      variants: [
        { id: "claude-default", engine: "claude", model: null },
        { id: "bad-model", engine: "claude", model: "no-such-model" },
      ],
    })
    return Effect.gen(function* () {
      const { manifest } = yield* run(config, fake.deps)
      expect(manifest.cases.map((c) => [c.variant, c.status])).toEqual([
        ["claude-default", "ok"],
        ["bad-model", "failed"],
      ])
      expect(manifest.cases[1]!.error).toMatch(/AnalysisFailed|ProcessFailed/)
      expect(fake.requests.filter((r) => r.model === null)).toHaveLength(1)
      expect(manifest.outcome).toBe("failed")
      expect(manifest.exitCode).toBe(4)
      // error categories only: no CLI detail text
      expect(JSON.stringify(manifest)).not.toContain("model not found")
    }).pipe(Effect.provide(NodeServices.layer))
  })

  it.effect("marks an unavailable engine's cases and never starts its runner", () => {
    const fake = fakeDeps({
      statuses: { codex: { id: "codex", installed: false, version: null, loggedIn: null } },
    })
    return Effect.gen(function* () {
      const { manifest } = yield* run(matrix({ repeats: 1 }), fake.deps)
      expect(manifest.cases.map((c) => c.status)).toEqual(["ok", "ok", "unavailable"])
      expect(manifest.cases[2]!.error).toBe("NotInstalled")
      expect(fake.requests.some((r) => r.engine === "codex")).toBe(false)
      expect(manifest.outcome).toBe("unavailable")
      expect(manifest.exitCode).toBe(3)
    }).pipe(Effect.provide(NodeServices.layer))
  })

  it.effect("keeps a model name only echoed from the request apart from a reported one", () => {
    const fake = fakeDeps({
      wrap: (r) => ({
        ...r,
        generate: (input) =>
          r.generate(input).pipe(Effect.map((x) => ({ ...x, modelSource: "requested" as const }))),
      }),
    })
    const config = matrix({
      repeats: 1,
      baseline: "codex-x",
      variants: [{ id: "codex-x", engine: "codex", model: "gpt-x" }],
    })
    return Effect.gen(function* () {
      const { manifest } = yield* run(config, fake.deps)
      expect(manifest.cases[0]!.model).toEqual({
        requested: "gpt-x",
        reported: [],
        echoed: ["gpt-x"],
      })
    }).pipe(Effect.provide(NodeServices.layer))
  })
})

describe("createExperimentDir", () => {
  it.effect("creates a private folder and refuses to reuse an existing one", () => {
    const out = join(tmp(), "comparisons")
    return Effect.gen(function* () {
      const root = yield* createExperimentDir(out, "e1")
      expect(mode(root)).toBe(0o700)
      expect(mode(out)).toBe(0o700)
      const again = yield* Effect.flip(createExperimentDir(out, "e1"))
      expect(again).toBeDefined()
    }).pipe(Effect.provide(NodeServices.layer))
  })
})

describe("outcomeOf", () => {
  it("lets the most serious problem decide and needs passing quality gates", () => {
    const ok = { status: "ok" as const, quality: { passed: true } as never }
    expect(outcomeOf([ok])).toEqual({ outcome: "passed", exitCode: 0 })
    expect(outcomeOf([ok], [{ error: "cannot write" }])).toEqual({
      outcome: "render-failed",
      exitCode: 7,
    })
    expect(outcomeOf([ok, { status: "ok", quality: { passed: false } as never }])).toEqual({
      outcome: "quality-failed",
      exitCode: 6,
    })
    expect(
      outcomeOf([
        { status: "budget-skipped", quality: null },
        { status: "failed", quality: null },
        { status: "unavailable", quality: null },
      ]).outcome,
    ).toBe("unavailable")
  })
})
