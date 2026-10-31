import { writePrivateFile } from "../../src/platform/files.ts"
import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path, Schema } from "effect"
import { randomUUID } from "node:crypto"
import { join } from "node:path"
import { LlmChunkAnalysis, LlmProfileDraft } from "../../src/domain/llm/LlmSchemas.ts"
import { makeRunner } from "../../src/llm/detect.ts"
import { makeLlmSchema, type CallMeasurement, type RunnerId } from "../../src/llm/LlmRunner.ts"
import { claudeHome, codexHome, filesContaining, hasBinary } from "./helpers.ts"

const OK = makeLlmSchema("Ok", Schema.Struct({ ok: Schema.Boolean }))
const OBS = makeLlmSchema("LlmChunkAnalysis", LlmChunkAnalysis)
const DRAFT = makeLlmSchema("LlmProfileDraft", LlmProfileDraft)

const DATA = `<prompt id="p1" session="s1" turn="1/2" time="2026-09-03 23:41" project="demo">
先不要寫 code，幫我把計畫拆成小步驟
</prompt>
<prompt id="p2" session="s1" turn="2/2" time="2026-09-04 01:10" project="demo">
no, that's wrong. use a Map instead of an object
</prompt>`

const historyPaths = (id: RunnerId) =>
  id === "claude-code"
    ? [join(claudeHome(), "projects"), join(claudeHome(), "history.jsonl")]
    : [join(codexHome(), "sessions"), join(codexHome(), "history.jsonl")]

for (const [id, bin] of [
  ["claude-code", "claude"],
  ["codex", "codex"],
] as const) {
  describe.skipIf(!hasBinary(bin))(`${id} (real CLI)`, () => {
    it.effect("returns a tiny structured result without polluting history", () =>
      Effect.gen(function* () {
        const nonce = `nonce-${randomUUID()}`
        const start = Date.now()
        const runner = yield* makeRunner(id, {})
        const measurements: CallMeasurement[] = []
        const result = yield* runner.generate({
          onMeasurement: (m) => measurements.push(m),
          system: "Answer with ok = true.",
          prompt: `Reply ok=true. (${nonce})`,
          schema: OK,
        })
        expect(result.value).toEqual({ ok: true })
        expect(measurements).toHaveLength(1)
        expect(measurements[0]!.costUsd).toBe(result.usage.costUsd)
        expect(measurements[0]!.tokens?.output).toBe(result.usage.outputTokens)
        console.log(
          `[smoke] ${id}: attempts=1 model=${result.model} modelSource=${result.modelSource} durationMs=${result.durationMs} costUsd=${result.usage.costUsd} inputTokens=${result.usage.inputTokens} outputTokens=${result.usage.outputTokens}`,
        )
        yield* writePrivateFile(
          yield* FileSystem.FileSystem,
          yield* Path.Path,
          `tmp/plan33-smoke/${id}.json`,
          JSON.stringify(
            {
              attempts: 1,
              engine: id,
              model: result.model,
              modelSource: result.modelSource,
              usage: result.usage,
              measurements,
            },
            null,
            2,
          ),
        )
        expect(filesContaining(historyPaths(id), start, nonce)).toEqual([])
      }).pipe(Effect.provide(NodeServices.layer)),
    )

    it.effect("accepts LlmChunkAnalysis", () =>
      Effect.gen(function* () {
        const runner = yield* makeRunner(id, {})
        const result = yield* runner.generate({
          system:
            "Analyse the developer's prompts inside <prompt> tags. Give 2 observations, each quoting a prompt id and a verbatim excerpt, and one episode of session s1 with both turns.",
          prompt: DATA,
          schema: OBS,
        })
        expect(result.value.observations.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(NodeServices.layer)),
    )

    it.effect("accepts LlmProfileDraft", () =>
      Effect.gen(function* () {
        const runner = yield* makeRunner(id, {})
        const result = yield* runner.generate({
          system:
            "Write a short developer profile from these prompts: 5 dimensions (one per key), 3 traits, 2 funFacts. Evidence must quote prompt ids p1/p2 verbatim.",
          prompt: DATA,
          schema: DRAFT,
        })
        expect(result.value.dimensions.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(NodeServices.layer)),
    )
  })
}
