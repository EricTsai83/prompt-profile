import { describe, expect, it } from "@effect/vitest"
import { AnalysisFailed } from "../../src/analysis/errors.ts"
import { verboseDetail } from "../../src/cli/render-error.ts"
import { InvalidOutput } from "../../src/llm/LlmRunner.ts"

describe("verboseDetail", () => {
  it("includes the underlying cause (Error.cause is not enumerable)", () => {
    const error = new AnalysisFailed({
      reason: "reduce-failed",
      chunksFailed: 0,
      chunksTotal: 22,
      cause: new InvalidOutput({ runner: "claude-code", detail: "LlmChunkObservations: bad" }),
    })
    const detail = verboseDetail(error)
    expect(detail).toContain('"reason": "reduce-failed"')
    expect(detail).toContain('"_tag": "InvalidOutput"')
    expect(detail).toContain("LlmChunkObservations: bad")
    expect(detail).not.toContain("stack")
  })
})
