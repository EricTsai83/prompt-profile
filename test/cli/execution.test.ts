import { expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { makeHarness } from "./harness.ts"
import { parseExecution } from "../../src/domain/Execution.ts"

it.effect(
  "shares generation accounting between terminal, saved execution and report, and free commands add no executions",
  () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "output")
      const result = yield* h.run(["--yes", "--since", "all", "--out", out])
      expect(result.code).toBe(0)
      const ids = readdirSync(join(out, "executions"))
      expect(ids).toHaveLength(1)
      const record = parseExecution(
        JSON.parse(readFileSync(join(out, "executions", ids[0]!, "summary.json"), "utf8")),
      )!
      expect(record.outcome).toBe("succeeded")
      expect(record.summary.calls).toBe(h.fakes[0]!.calls())
      const profilePath = join(out, "reports", record.reportId!, "profile.json")
      const profile = JSON.parse(readFileSync(profilePath, "utf8"))
      expect(profile.generation.summary).toEqual(record.summary)
      expect(result.stdout).toContain(`Model calls: ${record.summary.calls}`)
      expect(readFileSync(join(out, "reports", record.reportId!, "report.html"), "utf8")).toContain(
        "Report generation",
      )
      yield* h.run(["history", "--out", out])
      yield* h.run(["render", profilePath])
      expect(readdirSync(join(out, "executions"))).toEqual(ids)
    }),
)

it.effect("retains a failed execution and recovery command without publishing a report", () =>
  Effect.gen(function* () {
    const h = makeHarness()
    const out = join(h.root, "output")
    const result = yield* h.run(["--yes", "--since", "all", "--max-calls", "1", "--out", out])
    expect(result.code).toBe(1)
    const id = readdirSync(join(out, "executions"))[0]!
    const record = parseExecution(
      JSON.parse(readFileSync(join(out, "executions", id, "summary.json"), "utf8")),
    )!
    expect(record.outcome).toBe("failed")
    expect(record.summary.calls).toBe(1)
    expect(record.reportId).toBeNull()
    expect(existsSync(join(out, "library.json"))).toBe(false)
    expect(result.stdout).toContain("Model calls: 1")
  }),
)

it.effect(
  "rejects unsupported monetary limits before calls and lists failed executions for free",
  () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "output")
      const invalid = yield* h.run([
        "--yes",
        "--since",
        "all",
        "--engine",
        "codex",
        "--max-cost-usd",
        "1",
        "--out",
        out,
      ])
      expect(invalid.code).toBe(2)
      expect(h.fakes).toHaveLength(0)
      expect(existsSync(join(out, "executions"))).toBe(false)
      yield* h.run(["--yes", "--since", "all", "--max-calls", "1", "--out", out])
      const calls = h.fakes.reduce((n, f) => n + f.calls(), 0)
      const listed = yield* h.run(["history", "--executions", "--out", out])
      expect(listed.code).toBe(0)
      expect(listed.stdout).toContain("failed")
      expect(listed.stdout).toContain("summary.json")
      expect(h.fakes.reduce((n, f) => n + f.calls(), 0)).toBe(calls)
    }),
)

it.effect(
  "a stalled execution save cannot hang the analysis, even when its cleanup stalls too",
  () =>
    Effect.gen(function* () {
      // The first summary (written when the execution starts) succeeds; every later summary
      // write never finishes, and neither does removing its temp file.
      let summaries = 0
      const stalls = (file: string) => /summary\.json\.[^/]+\.tmp$/u.test(file)
      const h = makeHarness({
        fileSystem: (fs) => ({
          ...fs,
          writeFileString: (file, data, options) =>
            stalls(file) && summaries++ > 0
              ? Effect.never
              : fs.writeFileString(file, data, options),
          remove: (file, options) => (stalls(file) ? Effect.never : fs.remove(file, options)),
        }),
      })
      const out = join(h.root, "output")
      const started = Date.now()
      const result = yield* h.run(["--yes", "--since", "all", "--out", out])
      // each checkpoint gives up after 5 s of wall time instead of waiting forever
      expect(Date.now() - started).toBeLessThan(20_000)
      expect(result.code).not.toBe(0)
      expect(result.stderr).toContain(join(out, "executions"))
    }),
  30_000,
)
