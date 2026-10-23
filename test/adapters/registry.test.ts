import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { makeAdapters, readSources } from "../../src/adapters/registry.ts"
import { fixtureDir } from "./helpers.ts"

describe("registry", () => {
  it.effect("reads every source, in registry order, with its diagnostics", () =>
    Effect.gen(function* () {
      const adapters = yield* makeAdapters({
        home: "/nowhere",
        env: { CLAUDE_CONFIG_DIR: fixtureDir("claude-code"), CODEX_HOME: fixtureDir("codex") },
      })
      const sources = yield* readSources(adapters)
      expect(sources.map((s) => s.adapter.id)).toEqual(["claude-code", "codex"])
      for (const s of sources) {
        expect(s.records.length).toBeGreaterThan(0)
        expect(new Set(s.records.map((r) => r.source))).toEqual(new Set([s.adapter.id]))
        expect(s.diagnostics.filesRead).toBeGreaterThan(0)
        expect(s.locations.length).toBe(2)
      }
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
