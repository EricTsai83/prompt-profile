import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema, Stream } from "effect"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { makeCodexAdapter } from "../../src/adapters/codex/adapter.ts"
import { PromptRecord } from "../../src/domain/PromptRecord.ts"
import { codexHome } from "./helpers.ts"

const root = codexHome()

describe.skipIf(!existsSync(join(root, "sessions")))("Codex adapter (real data)", () => {
  it.effect("reads real data (counts only, never content)", () =>
    Effect.gen(function* () {
      const start = Date.now()
      const adapter = yield* makeCodexAdapter(root)
      const records = yield* Stream.runCollect(adapter.read)
      const elapsed = Date.now() - start
      const diagnostics = yield* adapter.diagnostics
      const byOrigin: Record<string, number> = {}
      for (const r of records) byOrigin[r.origin] = (byOrigin[r.origin] ?? 0) + 1
      console.log(`[smoke] codex: ${records.length} records in ${elapsed}ms`, byOrigin)
      console.log(
        "[smoke] codex excluded:",
        diagnostics.excluded,
        "badLines:",
        diagnostics.badLines,
      )
      expect(records.length).toBeGreaterThan(0)
      const encode = Schema.encodeUnknownSync(PromptRecord)
      for (const r of records) encode(r)
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
