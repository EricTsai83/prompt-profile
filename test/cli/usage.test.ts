import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { cpSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { RunnerStatus } from "../../src/llm/detect.ts"
import { fakeCodexAuth, FAKE_SECRETS } from "../adapters/credentials.ts"
import { fixture, makeHarness, ok } from "./harness.ts"

/** The prompt fixtures plus the usage fixtures and fake credentials, in temporary homes. */
const homes = () => {
  const root = mkdtempSync(join(tmpdir(), "pp-usage-"))
  const claude = join(root, "claude")
  const codex = join(root, "codex")
  cpSync(fixture("claude-code"), claude, { recursive: true })
  cpSync(fixture("usage/claude-code"), claude, { recursive: true })
  cpSync(fixture("codex"), codex, { recursive: true })
  cpSync(fixture("usage/codex"), codex, { recursive: true })
  writeFileSync(join(codex, "auth.json"), JSON.stringify(fakeCodexAuth("plus")))
  writeFileSync(
    join(claude, ".claude.json"),
    JSON.stringify({
      oauthAccount: {
        emailAddress: "dev@example.com",
        fullName: "Dev Example",
        accountUuid: "acct-fake-0001",
        userRateLimitTier: "default_claude_max_5x",
      },
    }),
  )
  return { CLAUDE_CONFIG_DIR: claude, CODEX_HOME: codex }
}

const withPlan: RunnerStatus = {
  ...ok("claude-code"),
  plan: { kind: "subscription", name: "team", detail: null },
}

const filesUnder = (dir: string): Array<string> =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? filesUnder(full) : [full]
  })

describe("usage, plan and API list-price equivalent (plan 23)", () => {
  const run = (statuses: ReadonlyArray<RunnerStatus>, args: ReadonlyArray<string> = []) =>
    Effect.gen(function* () {
      const cache = mkdtempSync(join(tmpdir(), "pp-usage-cache-"))
      const h = makeHarness({ statuses, env: { env: { ...homes(), XDG_CACHE_HOME: cache } } })
      const out = join(h.root, "out")
      const r = yield* h.run(["--yes", "--out", out, "--since", "all", ...args])
      expect(r.code).toBe(0)
      const profile = JSON.parse(readFileSync(join(out, "profile.json"), "utf8"))
      return { r, out, cache, profile, html: readFileSync(join(out, "report.html"), "utf8") }
    })

  it.effect("profile.json carries usage per source, priced, with the detected plans", () =>
    Effect.gen(function* () {
      const { profile } = yield* run([withPlan, ok("codex")])
      const [claude, codex] = profile.usage.sources
      expect(profile.usage.pricingVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // the CLI's plan, with the config file's hint
      expect(claude.plan).toEqual({
        kind: "subscription",
        name: "team",
        detail: "default_claude_max_5x",
      })
      expect(codex.plan).toEqual({ kind: "subscription", name: "plus", detail: null })
      expect(claude.totals.requests).toBe(6)
      expect(codex.totals.requests).toBe(6)
      expect(claude.unpricedModels).toEqual(["claude-unreleased-9"])
      expect(codex.unpricedModels).toEqual(["codex-auto-review"])
      expect(claude.totals.cost).toBeGreaterThan(0)
      // one analysis session in the usage fixtures, one in the prompt fixtures
      expect(codex.diagnostics).toMatchObject({ duplicates: 3, markerSessions: 2 })
      // broken and unusable usage lines reach the report's diagnostics
      expect(claude.diagnostics.badLines).toBe(2)
      expect(codex.diagnostics.badLines).toBe(3)
      expect(profile.usage.range).toEqual({
        from: "2026-10-01T01:00:05.000Z",
        to: "2026-10-04T09:00:30.000Z",
      })
    }),
  )

  it.effect("no plan from the CLI: the local view, or unknown; never an error", () =>
    Effect.gen(function* () {
      const { profile } = yield* run([ok("claude-code"), ok("codex")])
      expect(profile.usage.sources[0].plan).toEqual({
        kind: "unknown",
        name: null,
        detail: "default_claude_max_5x",
      })
    }),
  )

  it.effect("no credential, email or account id reaches any output, cache or log", () =>
    Effect.gen(function* () {
      const { r, out, cache } = yield* run([withPlan, ok("codex")], ["--verbose"])
      const written = [...filesUnder(out), ...filesUnder(cache)]
        .filter((f) => !f.endsWith(".png"))
        .map((f) => readFileSync(f, "utf8"))
      for (const text of [r.stdout, r.stderr, ...written])
        for (const secret of FAKE_SECRETS) expect(text).not.toContain(secret)
    }),
  )

  it.effect("the report shows usage, and the terminal says so", () =>
    Effect.gen(function* () {
      const full = yield* run([withPlan, ok("codex")])
      expect(full.html).toContain('class="usage"')
      expect(full.html).toContain("API list-price equivalent")
      expect(full.r.stdout).toContain("plans, usage and API list-price equivalent")
    }),
  )

  it.effect("--exclude usage leaves plans, tokens and amounts out of every rendered file", () =>
    Effect.gen(function* () {
      const without = yield* run([withPlan, ok("codex")], ["--exclude", "usage"])
      expect(without.html).not.toContain('class="usage"')
      expect(without.html).not.toContain("API list-price equivalent")
      expect(without.html).not.toContain("team")
      expect(without.r.stdout).not.toContain("plans, usage and API list-price equivalent")
    }),
  )
})
