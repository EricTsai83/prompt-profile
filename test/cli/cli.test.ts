import { describe, expect, it } from "@effect/vitest"
import { Effect, Fiber } from "effect"
import { TestClock } from "effect/testing"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { NotLoggedIn, RateLimited } from "../../src/llm/LlmRunner.ts"
import { VERSION } from "../../src/version.ts"
import { fixture, makeHarness, ok } from "./harness.ts"

// The version changes on every release; snapshots must not
const scrub = (s: string, root: string) =>
  s
    .replaceAll(root, "<tmp>")
    .replaceAll(fixture(""), "<fixtures>/")
    .replaceAll(`v${VERSION}`, "v<version>")

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
      expect(r.stdout).toContain("your logged-in Codex CLI")
      const profile = JSON.parse(readFileSync(join(out, "profile.json"), "utf8"))
      expect(profile.engine.runner).toBe("codex")
      expect(existsSync(join(out, "card.png"))).toBe(true)
    }),
  )

  it.effect("second run uses the cache", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      yield* h.run(["--yes", "--since", "all"])
      const firstCalls = h.fakes[0]!.calls()
      yield* h.run(["--yes", "--since", "all"])
      expect(firstCalls).toBeGreaterThan(1)
      expect(h.fakes[1]!.calls()).toBe(2)
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
      expect(plan.llmCalls).toBe(2)
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

  it.effect("render --look writes a new variant folder and keeps the original report", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const profile = join(h.root, "profile.json")
      writeFileSync(profile, readFileSync(fixture("profile.sample.json")))
      expect((yield* h.run(["render", profile])).code).toBe(0)
      const original = readFileSync(join(h.root, "report.html"), "utf8")
      const originalCard = readFileSync(join(h.root, "card.png"))

      const r = yield* h.run(["render", profile, "--look", "signal", "--card-hide", "stats"])
      expect(r.code).toBe(0)
      expect(r.stdout).toContain("No new analysis, no LLM calls")
      const variant = join(h.root, "variants", "signal-no-stats")
      expect(readFileSync(join(variant, "report.html"), "utf8")).toContain('data-look="signal"')
      expect(existsSync(join(variant, "card.png"))).toBe(true)
      expect(JSON.parse(readFileSync(join(variant, "render.json"), "utf8"))).toMatchObject({
        look: "signal",
        cardHidden: ["stats"],
        source: "../../profile.json",
      })
      expect(readFileSync(join(h.root, "report.html"), "utf8")).toBe(original)
      expect(readFileSync(join(h.root, "card.png"))).toEqual(originalCard)
      expect(h.fakes.length).toBe(0)
    }),
  )

  it.effect("render --exclude writes a variant without those parts and records them", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const profile = join(h.root, "profile.json")
      writeFileSync(profile, readFileSync(fixture("profile.sample.json")))
      const r = yield* h.run(["render", profile, "--exclude", "personal"])
      expect(r.code).toBe(0)
      const variant = join(h.root, "variants", "classic-without-personal")
      const report = readFileSync(join(variant, "report.html"), "utf8")
      expect(report).not.toContain("<blockquote")
      expect(report).not.toContain('class="usage"')
      expect(existsSync(join(variant, "share.html"))).toBe(false)
      expect(JSON.parse(readFileSync(join(variant, "render.json"), "utf8"))).toMatchObject({
        renderVersion: 3,
        excluded: ["quotes", "projects", "dates", "coaching", "funfacts", "custom-names", "usage"],
      })
      const r2 = yield* h.run(["render", profile, "--exclude", "dates,quotes"])
      expect(r2.code).toBe(0)
      expect(existsSync(join(h.root, "variants", "classic-without-quotes-dates"))).toBe(true)
      const bad = yield* h.run(["render", profile, "--exclude", "quotes,secrets"])
      expect(bad.code).toBe(2)
      expect(bad.stderr).toContain("--exclude")
      expect(bad.stderr).toContain("personal")
    }),
  )

  it.effect("the final check masks secrets and personal data, and lists where", () =>
    Effect.gen(function* () {
      const TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"
      const EMAIL = "someone@example.com"
      const leaky = JSON.parse(readFileSync(fixture("profile.sample.json"), "utf8"))
      leaky.funFacts[0] = `Pasted ${TOKEN} once`
      leaky.traits[1].description = `Mails ${EMAIL} a lot`
      const setup = (name: string) => {
        const h = makeHarness()
        const dir = join(h.root, name)
        mkdirSync(dir)
        writeFileSync(join(dir, "profile.json"), JSON.stringify(leaky))
        return { h, dir, profile: join(dir, "profile.json") }
      }

      const masked = setup("mask")
      const r = yield* masked.h.run(["render", masked.profile])
      expect(r.code).toBe(0)
      const report = readFileSync(join(masked.dir, "report.html"), "utf8")
      expect(report).not.toContain(TOKEN)
      expect(report).not.toContain(EMAIL)
      expect(readFileSync(join(masked.dir, "profile.json"), "utf8")).not.toContain(TOKEN)
      expect(r.stdout).toContain("Check  2 masked")
      expect(r.stdout).toContain("api-token (Fun facts › 1)")
      expect(r.stdout).toContain("email (Traits › 2)")
      expect(r.stdout + r.stderr).not.toContain(TOKEN)
      expect(r.stdout + r.stderr).not.toContain(EMAIL)

      const strict = setup("strict")
      const rs = yield* strict.h.run(["render", strict.profile, "--check", "strict"])
      expect(rs.code).toBe(1)
      expect(existsSync(join(strict.dir, "report.html"))).toBe(false)
      expect(rs.stderr).toContain("--check strict")
      expect(rs.stderr).toContain("email (Traits › 2)")
      expect(rs.stdout + rs.stderr).not.toContain(EMAIL)

      const warn = setup("warn")
      const rw = yield* warn.h.run(["render", warn.profile, "--check", "warn"])
      expect(rw.code).toBe(0)
      const warned = readFileSync(join(warn.dir, "report.html"), "utf8")
      expect(warned).toContain(EMAIL)
      expect(warned).not.toContain(TOKEN)
      expect(rw.stdout).toContain("1 kept (--check warn): email (Traits › 2)")

      const allowed = setup("allow")
      const ra = yield* allowed.h.run(["render", allowed.profile, "--allow", "email"])
      expect(ra.code).toBe(0)
      expect(readFileSync(join(allowed.dir, "report.html"), "utf8")).toContain(EMAIL)
      const bad = yield* allowed.h.run(["render", allowed.profile, "--allow", "api-token"])
      expect(bad.code).toBe(2)
      expect(bad.stderr).toContain("--allow")
    }),
  )

  it.effect("after writing, lists what the report contains and how to leave parts out", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const profile = join(h.root, "profile.json")
      writeFileSync(profile, readFileSync(fixture("profile.sample.json")))
      const r = yield* h.run(["render", profile])
      expect(r.stdout).toContain(
        "Contains  22 quotes · 3 project names · exact dates · 2 improvements · 2 fun facts",
      )
      expect(r.stdout).toContain("skim the quotes yourself")
      expect(r.stdout).toContain(`prompt-profile render ${profile} --exclude personal`)
    }),
  )

  it.effect("with --exclude personal there is nothing personal to point out", () =>
    Effect.gen(function* () {
      const h2 = makeHarness()
      const profile2 = join(h2.root, "profile.json")
      writeFileSync(profile2, readFileSync(fixture("profile.sample.json")))
      const r2 = yield* h2.run(["render", profile2, "--exclude", "personal"])
      expect(r2.stdout).toContain("Contains  no quotes, project names or exact dates")
      expect(r2.stdout).not.toContain("skim the quotes")
      expect(r2.stdout).not.toContain("--exclude personal")
    }),
  )

  it.effect("the final check reports a clean profile", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const profile = join(h.root, "profile.json")
      writeFileSync(profile, readFileSync(fixture("profile.sample.json")))
      const r = yield* h.run(["render", profile])
      expect(r.stdout).toContain("Check  no secrets or personal data found")
    }),
  )

  it.effect("render rejects an unknown look or card part", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const profile = join(h.root, "profile.json")
      writeFileSync(profile, readFileSync(fixture("profile.sample.json")))
      expect((yield* h.run(["render", profile, "--look", "neon"])).code).toBe(2)
      const r = yield* h.run(["render", profile, "--card-hide", "stats,quotes"])
      expect(r.code).toBe(2)
      expect(r.stderr).toContain("--card-hide")
      expect(r.stderr).toContain("traits, stats, graphic")
    }),
  )

  it.effect("the main command renders in the chosen look", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "studio")
      const r = yield* h.run(["--yes", "--since", "all", "--look", "studio", "--out", out])
      expect(r.code).toBe(0)
      expect(readFileSync(join(out, "report.html"), "utf8")).toContain('data-look="studio"')
      expect(existsSync(join(out, "render.json"))).toBe(true)
    }),
  )

  it.effect("--lang writes a bilingual report and one card per language", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "bi")
      const r = yield* h.run(["--yes", "--since", "all", "--lang", "zh-TW,en", "--out", out])
      expect(r.code).toBe(0)
      expect(r.stdout).toContain("Translated into zh-TW")
      const report = readFileSync(join(out, "report.html"), "utf8")
      expect(report).toMatch(/id="lang-zh-TW"[^>]*checked/)
      expect(report).toContain('id="lang-en"')
      expect(report).toContain("譯 Collaboration Portrait")
      expect(existsSync(join(out, "card.png"))).toBe(true)
      expect(existsSync(join(out, "card.en.png"))).toBe(true)
      expect(existsSync(join(out, "share.html"))).toBe(false)
      const profile = JSON.parse(readFileSync(join(out, "profile.json"), "utf8"))
      expect(profile.languages).toEqual(["zh-TW", "en"])
      // one translation call on top of the map and reduce calls
      expect(h.fakes.at(-1)!.log.filter((c) => c.schema === "LlmTranslation")).toHaveLength(1)
    }),
  )

  it.effect("the default languages follow the system locale", () =>
    Effect.gen(function* () {
      const h = makeHarness({ env: { locale: "zh_TW.UTF-8" } })
      const out = join(h.root, "zh")
      expect((yield* h.run(["--yes", "--since", "all", "--out", out])).code).toBe(0)
      expect(JSON.parse(readFileSync(join(out, "profile.json"), "utf8")).languages).toEqual([
        "zh-TW",
        "en",
      ])
      const en = makeHarness()
      const outEn = join(en.root, "en")
      expect((yield* en.run(["--yes", "--since", "all", "--out", outEn])).code).toBe(0)
      expect(readFileSync(join(outEn, "report.html"), "utf8")).not.toContain('name="lang"')
      expect(en.fakes.at(-1)!.log.some((c) => c.schema === "LlmTranslation")).toBe(false)
    }),
  )

  it.effect("an unknown --lang is a usage error before any work", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const r = yield* h.run(["--yes", "--since", "all", "--lang", "fr"])
      expect(r.code).toBe(2)
      expect(r.stderr).toContain("--lang")
      expect(h.fakes.length).toBe(0)
    }),
  )

  it.effect("retains a snapshot without presenting an unverified comparison", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "again")
      expect((yield* h.run(["--yes", "--since", "all", "--out", out])).code).toBe(0)
      const first = JSON.parse(readFileSync(join(out, "profile.json"), "utf8"))
      expect(first.previous).toBeNull()
      expect((yield* h.run(["--yes", "--since", "all", "--out", out, "--no-cache"])).code).toBe(0)
      const second = JSON.parse(readFileSync(join(out, "profile.json"), "utf8"))
      expect(second.previous.generatedAt).toBe(first.generatedAt)
      expect(second.previous.improvements).toEqual(
        first.improvements.map((i: { title: string }) => i.title),
      )
      expect(readFileSync(join(out, "report.html"), "utf8")).not.toContain("Since your last report")
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

it.effect("a call budget stops analysis with an actionable error", () =>
  Effect.gen(function* () {
    const h = makeHarness()
    const result = yield* h.run(["--yes", "--since", "all", "--max-calls", "1"])
    expect(result.code).toBe(1)
    expect(result.stderr).toContain("call budget")
    expect(h.fakes[0]!.calls()).toBe(1)
  }),
)

it.effect.each(["0", "-1", "1.5", "NaN"])("rejects invalid call budget %s", (value) =>
  Effect.gen(function* () {
    const h = makeHarness()
    const result = yield* h.run(["--yes", "--since", "all", "--max-calls", value])
    expect(result.code).toBe(2)
    expect(h.fakes).toHaveLength(0)
  }),
)
