import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect, Schema } from "effect"
import { existsSync } from "node:fs"
import { homedir, userInfo } from "node:os"
import { join } from "node:path"
import { makeAdapters, readSources } from "../../src/adapters/registry.ts"
import { Stats } from "../../src/domain/Stats.ts"
import { openingKey } from "../../src/pipeline/filter.ts"
import { processRecords } from "../../src/pipeline/index.ts"
import { claudeHome, codexHome } from "./helpers.ts"

const hasData =
  existsSync(join(claudeHome(), "projects")) || existsSync(join(codexHome(), "sessions"))

describe.skipIf(!hasData)("pipeline (real data)", () => {
  it.effect("runs end to end (prints stats and counts only, never prompt text)", () =>
    Effect.gen(function* () {
      const adapters = yield* makeAdapters({ home: homedir(), env: process.env })
      const sources = yield* readSources(adapters)
      const records = sources.flatMap((s) => s.records)
      const slashCommands: Record<string, number> = {}
      for (const s of sources)
        for (const [name, n] of Object.entries(s.diagnostics.slashCommands))
          slashCommands[name] = (slashCommands[name] ?? 0) + n
      const now = DateTime.makeUnsafe(Date.now())
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const result = processRecords(records, {
        since: DateTime.subtract(now, { months: 6 }),
        now,
        timezone,
        username: userInfo().username,
        slashCommands,
        events: sources.flatMap((s) => s.events),
      })
      console.log("[smoke] PipelineReport", JSON.stringify(result.report, null, 2))
      const stats = Schema.encodeSync(Stats)(result.stats)
      console.log(
        "[smoke] Stats",
        JSON.stringify(
          {
            ...stats,
            topProjects: stats.topProjects.length,
            // Command names can be the user's own; print the count only.
            topSlashCommands: stats.topSlashCommands.length,
          },
          null,
          2,
        ),
      )

      // Delegation heuristics: per client, how many sessions share the same first-prompt
      // prefix (hashed — never print the text).
      const first = new Map<string, (typeof records)[number]>()
      for (const r of records.toSorted(
        (a, b) => DateTime.toEpochMillis(a.timestamp) - DateTime.toEpochMillis(b.timestamp),
      )) {
        const key = `${r.source}:${r.sessionId}`
        if (!first.has(key)) first.set(key, r)
      }
      const dist = new Map<string, number>()
      for (const r of first.values()) {
        const k = openingKey(r)
        dist.set(k, (dist.get(k) ?? 0) + 1)
      }
      const repeated = [...dist.entries()].filter(([, n]) => n >= 3).toSorted((a, b) => b[1] - a[1])
      console.log(
        "[smoke] first-prompt prefix hashes shared by ≥3 sessions (client hash → sessions):",
        repeated,
      )
      expect(result.stats.totalPrompts).toBeGreaterThan(0)
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
