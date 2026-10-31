import { describe, expect, it } from "@effect/vitest"
import { AnalysisFailed } from "../../src/analysis/errors.ts"
import { UnsupportedProfileVersion } from "../../src/domain/Profile.ts"
import { renderError, verboseDetail } from "../../src/cli/render-error.ts"
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

describe("profile format recovery", () => {
  it("guides a newer format toward an update and a free render retry", () => {
    const result = renderError(
      new UnsupportedProfileVersion({ found: 21, supported: 20 }),
      undefined,
      {
        latestRenderCommand:
          "npx prompt-profile@latest render 'saved profile.json' --exclude usage",
      },
    )
    expect(result.code).toBe(1)
    expect(result.message).toContain("newer")
    expect(result.message).toContain("npm i -g prompt-profile@latest")
    expect(result.message).toContain(
      "npx prompt-profile@latest render 'saved profile.json' --exclude usage",
    )
    expect(result.message).toContain("https://github.com/EricTsai83/prompt-profile/releases/latest")
    expect(result.message).toContain("no model calls")
    expect(result.message).not.toContain("re-run the analysis")
  })

  it("guides an unsupported older format to explicit regeneration with quota and history requirements", () => {
    const result = renderError(
      new UnsupportedProfileVersion({ found: 19, supported: 20 }),
      undefined,
      {
        analysisLauncher: "npx prompt-profile@0.1.5",
      },
    )
    expect(result.message).toContain("older")
    expect(result.message).toContain("npx prompt-profile@0.1.5 --dry-run")
    expect(result.message).toContain("subscription quota")
    expect(result.message).toContain("original local prompt history")
    expect(result.message).toContain("HTML and PNG")
    expect(result.message).not.toContain("npm i -g")
  })

  it.each([undefined, null, "21", -1, 0, 1.5, {}, Number.NaN, Number.POSITIVE_INFINITY])(
    "does not recommend an update for invalid version data: %s",
    (found) => {
      const { message } = renderError(new UnsupportedProfileVersion({ found, supported: 20 }))
      expect(message).toContain("missing or invalid")
      expect(message).toContain("original profile.json")
      expect(message).not.toContain("npm i -g")
      expect(message).not.toContain("[object Object]")
    },
  )
})
