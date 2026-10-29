import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeClaudeCodeAdapter } from "../../src/adapters/claude-code/adapter.ts"
import { makeCodexAdapter } from "../../src/adapters/codex/adapter.ts"
import { fakeCodexAuth, FAKE_SECRETS } from "./credentials.ts"

const codexPlan = (auth: unknown | null) => {
  const root = mkdtempSync(join(tmpdir(), "pp-codex-"))
  if (auth !== null)
    writeFileSync(join(root, "auth.json"), typeof auth === "string" ? auth : JSON.stringify(auth))
  return makeCodexAdapter(root).pipe(
    Effect.flatMap((a) => a.plan!),
    Effect.provide(NodeServices.layer),
  )
}

describe("Codex plan", () => {
  it.effect("decodes only the plan type of the local id token", () =>
    Effect.gen(function* () {
      const plan = yield* codexPlan(fakeCodexAuth("plus"))
      expect(plan).toEqual({ kind: "subscription", name: "plus", detail: null })
      for (const secret of FAKE_SECRETS) expect(JSON.stringify(plan)).not.toContain(secret)
    }),
  )

  it.effect("an API-key login is 'API key', never the key", () =>
    Effect.gen(function* () {
      const plan = yield* codexPlan({ auth_mode: "apikey", OPENAI_API_KEY: "sk-fake-api-key" })
      expect(plan).toEqual({ kind: "api-key", name: null, detail: null })
    }),
  )

  it.effect.each([
    ["no auth file", null],
    ["not JSON", "{"],
    ["a token that is not a JWT", { auth_mode: "chatgpt", tokens: { id_token: "x" } }],
    ["a plan type that is not text", fakeCodexAuth(42)],
    ["an implausible plan code", fakeCodexAuth("dev@example.com")],
  ] as const)("%s → unknown, not an error", ([, auth]) =>
    Effect.gen(function* () {
      const plan = yield* codexPlan(auth)
      expect(plan).toEqual({ kind: "unknown", name: null, detail: null })
    }),
  )
})

describe("Claude Code plan hint", () => {
  const claudePlan = (config: unknown | null) => {
    const root = mkdtempSync(join(tmpdir(), "pp-claude-"))
    mkdirSync(join(root, "projects"))
    if (config !== null) writeFileSync(join(root, ".claude.json"), JSON.stringify(config))
    return makeClaudeCodeAdapter(root).pipe(
      Effect.flatMap((a) => a.plan!),
      Effect.provide(NodeServices.layer),
    )
  }

  it.effect("reads the rate-limit tier as an undocumented hint; nothing personal", () =>
    Effect.gen(function* () {
      const plan = yield* claudePlan({
        oauthAccount: {
          emailAddress: "dev@example.com",
          fullName: "Dev Example",
          accountUuid: "acct-fake-0001",
          userRateLimitTier: "default_claude_max_5x",
          seatTier: "team_tier_1",
        },
      })
      expect(plan).toEqual({ kind: "unknown", name: null, detail: "default_claude_max_5x" })
      for (const secret of FAKE_SECRETS) expect(JSON.stringify(plan)).not.toContain(secret)
    }),
  )

  it.effect("no config → unknown", () =>
    Effect.gen(function* () {
      expect(yield* claudePlan(null)).toEqual({ kind: "unknown", name: null, detail: null })
    }),
  )
})
