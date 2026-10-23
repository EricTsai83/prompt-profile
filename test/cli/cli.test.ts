import { describe, expect, it } from "@effect/vitest"
import { Effect, Fiber } from "effect"
import { TestClock } from "effect/testing"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { NotLoggedIn, RateLimited } from "../../src/llm/LlmRunner.ts"
import { VERSION } from "../../src/version.ts"
import { fixture, makeHarness, ok } from "./harness.ts"

const scrub = (s: string, root: string) =>
  s.replaceAll(root, "<tmp>").replaceAll(fixture(""), "<fixtures>/")

describe("prompt-profile (E2E with fixtures + FakeLlmRunner)", () => {
  it.effect("--version", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const r = yield* h.run(["--version"])
      expect(r.stdout).toContain(VERSION)
    }),
  )

  it.effect("--yes --out writes report.html, card.png and profile.json", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "out")
      const r = yield* h.run(["--yes", "--out", out, "--since", "all"])
      expect(r.code).toBe(0)
      for (const f of ["report.html", "card.png", "profile.json"])
        expect(existsSync(join(out, f))).toBe(true)
      expect(scrub(r.stdout, h.root)).toMatchSnapshot("stdout")
      // non-TTY: do not open a browser
      expect(h.opened).toEqual([])
      const profile = JSON.parse(readFileSync(join(out, "profile.json"), "utf8"))
      expect(profile.engine.runner).toBe("claude-code")
    }),
  )

  it.effect("refuses to run without --yes in a non-interactive session", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const r = yield* h.run(["--since", "all"])
      expect(r.code).toBe(2)
      expect(r.stderr).toContain("--yes")
      expect(h.fakes.reduce((n, f) => n + f.calls(), 0)).toBe(0)
    }),
  )

  it.effect("--engine codex selects Codex", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "out")
      const r = yield* h.run(["--yes", "--engine", "codex", "--out", out, "--since", "all"])
      expect(r.code).toBe(0)
      expect(r.stdout).toContain("Using Codex")
      const profile = JSON.parse(readFileSync(join(out, "profile.json"), "utf8"))
      expect(profile.engine.runner).toBe("codex")
      expect(existsSync(join(out, "card.png"))).toBe(true)
    }),
  )

  it.effect("there is no --lang flag any more (English only)", () =>
    Effect.gen(function* () {
      const r = yield* makeHarness().run(["--yes", "--lang", "en", "--since", "all"])
      expect(r.code).toBe(2)
    }),
  )

  it.effect("second run uses the cache", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      yield* h.run(["--yes", "--since", "all"])
      const firstCalls = h.fakes[0]!.calls()
      yield* h.run(["--yes", "--since", "all"])
      expect(firstCalls).toBeGreaterThan(1)
      expect(h.fakes[1]!.calls()).toBe(1)
    }),
  )

  it.effect("--dry-run writes chunks and plan.json without calling an LLM", () =>
    Effect.gen(function* () {
      const h = makeHarness({ statuses: [] })
      const out = join(h.root, "dry")
      const r = yield* h.run(["--dry-run", "--out", out, "--since", "all"])
      expect(r.code).toBe(0)
      expect(h.fakes).toHaveLength(0)
      const plan = JSON.parse(readFileSync(join(out, "plan.json"), "utf8"))
      expect(plan.chunksSelected).toBeGreaterThan(0)
      const chunks = readdirSync(join(out, "chunks"))
      expect(chunks.length).toBe(plan.chunksSelected)
      const text = readFileSync(join(out, "chunks", chunks[0]!), "utf8")
      expect(text).toMatch(/^<prompt id="/)
    }),
  )

  it.effect("--dry-run estimates with the engine a real run would pick", () =>
    Effect.gen(function* () {
      const h = makeHarness({ statuses: [ok("codex")] })
      expect((yield* h.run(["--yes", "--since", "all"])).code).toBe(0)
      expect(h.fakes.map((f) => f.id)).toEqual(["codex"])
      const out = join(h.root, "dry")
      expect((yield* h.run(["--dry-run", "--out", out, "--since", "all"])).code).toBe(0)
      const plan = JSON.parse(readFileSync(join(out, "plan.json"), "utf8"))
      // everything is cached for codex: only the final reduce call is left
      expect(plan.cacheHits).toBe(plan.chunksSelected)
      expect(plan.llmCalls).toBe(1)
      expect(h.fakes).toHaveLength(1)
    }),
  )

  it.effect("stats writes stats.json without an LLM", () =>
    Effect.gen(function* () {
      const h = makeHarness({ statuses: [] })
      const r = yield* h.run(["stats", "--since", "all", "--out", join(h.root, "s")])
      expect(r.code).toBe(0)
      const stats = JSON.parse(readFileSync(join(h.root, "s", "stats.json"), "utf8"))
      expect(stats.totalPrompts).toBeGreaterThan(0)
    }),
  )

  it.effect("stats prints its summary", () =>
    Effect.gen(function* () {
      const h = makeHarness({ statuses: [] })
      const r = yield* h.run(["stats", "--since", "all", "--out", join(h.root, "s")])
      expect(r.stdout).toMatch(/active days \d+/)
      expect(r.stdout).toMatch(/zh \d+% · en \d+% · mixed \d+%/)
    }),
  )

  it.effect("render re-creates the report; unknown schemaVersion is a clear error", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const good = join(h.root, "profile.json")
      writeFileSync(good, readFileSync(fixture("profile.sample.json")))
      const r1 = yield* h.run(["render", good])
      expect(r1.code).toBe(0)
      expect(existsSync(join(h.root, "report.html"))).toBe(true)

      const bad = join(h.root, "future.json")
      writeFileSync(
        bad,
        JSON.stringify({ ...JSON.parse(readFileSync(good, "utf8")), schemaVersion: 99 }),
      )
      const r2 = yield* h.run(["render", bad])
      expect(r2.code).toBe(1)
      expect(r2.stderr).toContain("format version 99")

      const badZone = join(h.root, "zone.json")
      const sample = JSON.parse(readFileSync(good, "utf8"))
      writeFileSync(
        badZone,
        JSON.stringify({ ...sample, stats: { ...sample.stats, timezone: "Mars/Olympus" } }),
      )
      const r3 = yield* h.run(["render", badZone])
      expect(r3.code).toBe(1)
      expect(r3.stderr).toContain("profile.json is invalid")
    }),
  )

  it.effect("cache clear deletes the analysis cache", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      yield* h.run(["--yes", "--since", "all"])
      const dir = join(h.root, "cache", "prompt-profile")
      expect(readdirSync(join(dir, "map")).length).toBeGreaterThan(0)
      const r = yield* h.run(["cache", "clear"])
      expect(r.code).toBe(0)
      expect(existsSync(join(dir, "map"))).toBe(false)
      // the second run has to analyse everything again
      const fakesBefore = h.fakes.length
      yield* h.run(["--yes", "--since", "all"])
      expect(h.fakes[fakesBefore]!.calls()).toBe(h.fakes[0]!.calls())
    }),
  )

  it.effect("an unexpected error (a bug) gets a short message; the stack only with --verbose", () =>
    Effect.gen(function* () {
      const boom = {
        fake: {
          respond: () => {
            throw new Error("boom inside the analysis")
          },
        },
      }
      const h = makeHarness(boom)
      const r = yield* h.run(["--yes", "--since", "all"])
      expect(r.code).toBe(1)
      expect(r.stderr).toContain("unexpected error")
      expect(r.stderr).toContain("--verbose")
      expect(r.stderr).not.toContain("boom inside the analysis")
      const v = yield* makeHarness(boom).run(["--yes", "--since", "all", "--verbose"])
      expect(v.code).toBe(1)
      expect(v.stderr).toContain("boom inside the analysis")
    }),
  )

  describe("errors", () => {
    it.effect.each([
      [
        "no data",
        { env: { env: { CLAUDE_CONFIG_DIR: "/nope/claude", CODEX_HOME: "/nope/codex" } } },
        ["--yes"],
        3,
      ],
      ["out of range", {}, ["--yes", "--since", "1m"], 3],
      ["no LLM installed", { statuses: [] }, ["--yes", "--since", "all"], 4],
      [
        "not logged in",
        { statuses: [{ ...ok("claude-code"), loggedIn: false }] },
        ["--yes", "--since", "all"],
        4,
      ],
      [
        "login expired during analysis",
        {
          fake: {
            failures: new Map([[1, new NotLoggedIn({ runner: "claude-code", detail: "x" })]]),
          },
        },
        ["--yes", "--since", "all"],
        4,
      ],
      [
        "rate limited",
        {
          fake: {
            failures: new Map(
              [1, 2, 3, 4, 5, 6, 7, 8, 9].map(
                (i) => [i, new RateLimited({ runner: "claude-code", detail: "x" })] as const,
              ),
            ),
          },
        },
        ["--yes", "--since", "all"],
        5,
      ],
      ["bad --since", {}, ["--yes", "--since", "soon"], 2],
      ["unknown flag", {}, ["--frobnicate"], 2],
    ] as const)("%s", ([name, options, args, code]) =>
      Effect.gen(function* () {
        const h = makeHarness(options as never)
        const fiber = yield* Effect.forkChild(h.run(args))
        // advance virtual time (retry backoff) until the run finishes
        while (fiber.pollUnsafe() === undefined) {
          yield* TestClock.adjust("1 minute")
          yield* Effect.promise(() => new Promise((r) => setTimeout(r, 2)))
        }
        const r = yield* Fiber.join(fiber)
        expect(r.code).toBe(code)
        if (name !== "unknown flag") expect(scrub(r.stderr, h.root)).toMatchSnapshot("stderr")
      }),
    )
  })

  it.effect("interrupting keeps finished chunks in the cache", () =>
    Effect.gen(function* () {
      const h = makeHarness({ fake: { failures: new Map([[2, "hang"]]) } })
      const fiber = yield* Effect.forkChild(h.run(["--yes", "--since", "all"]))
      const mapDir = join(h.root, "cache", "prompt-profile", "map")
      while (!existsSync(mapDir) || !readdirSync(mapDir).some((f) => f.endsWith(".json"))) {
        yield* Effect.promise(() => new Promise((r) => setTimeout(r, 10)))
      }
      yield* Fiber.interrupt(fiber)
      expect(readdirSync(join(h.root, "cache", "prompt-profile", "map")).length).toBeGreaterThan(0)
    }),
  )
})
