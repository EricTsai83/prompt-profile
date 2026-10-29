import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect } from "effect"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { makeClaudeCodeAdapter } from "../../src/adapters/claude-code/adapter.ts"
import { makeCodexAdapter } from "../../src/adapters/codex/adapter.ts"
import { totalTokens, UNKNOWN_PLAN } from "../../src/domain/Usage.ts"
import { summarizeUsage } from "../../src/pipeline/usage.ts"
import { claudeHome, codexHome } from "./helpers.ts"

/**
 * Usage on real data (plan 23): prints counts only — never content, plan names or amounts —
 * and checks the invariants a real log must satisfy.
 */
const claudeRoot = claudeHome()
const codexRoot = codexHome()

describe.skipIf(
  !existsSync(join(claudeRoot, "projects")) && !existsSync(join(codexRoot, "sessions")),
)("usage (real data)", () => {
  it.effect("reads usage from both tools (counts only)", () =>
    Effect.gen(function* () {
      const start = Date.now()
      const claude = yield* makeClaudeCodeAdapter(
        claudeRoot,
        process.env["CLAUDE_CONFIG_DIR"] ? undefined : join(homedir(), ".claude.json"),
      )
      const codex = yield* makeCodexAdapter(codexRoot)
      const reads = [yield* claude.read, yield* codex.read]
      const plans = [yield* claude.plan!, yield* codex.plan!]
      const elapsed = Date.now() - start
      const usage = summarizeUsage(
        [claude, codex].map((a, i) => ({
          source: a.id,
          events: reads[i]!.usage?.events ?? [],
          plan: plans[i] ?? UNKNOWN_PLAN,
          diagnostics: {
            unreadableFiles: reads[i]!.diagnostics.unreadableFiles,
            ...reads[i]!.usage!.diagnostics,
          },
        })),
        {
          since: null,
          now: DateTime.makeUnsafe(Date.now()),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      )
      for (const s of usage.sources) {
        console.log(`[smoke] usage ${s.source}:`, {
          responses: s.totals.requests,
          months: s.byMonth.length,
          models: s.byModel.length,
          unpricedModels: s.unpricedModels.length,
          planKnown: s.plan.kind !== "unknown",
          priced: s.totals.cost !== null,
          ...s.diagnostics,
        })
        // months and models partition the totals
        const sum = (xs: ReadonlyArray<{ usage: { requests: number } }>) =>
          xs.reduce((n, x) => n + x.usage.requests, 0)
        expect(sum(s.byMonth)).toBe(s.totals.requests)
        expect(sum(s.byModel)).toBe(s.totals.requests)
        expect(totalTokens(s.totals.tokens)).toBeGreaterThanOrEqual(0)
      }
      console.log(`[smoke] usage read in ${elapsed}ms`)
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
