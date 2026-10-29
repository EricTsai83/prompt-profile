import { describe, expect, it } from "@effect/vitest"
import { claudeArgs } from "../../src/llm/claude.ts"
import { codexArgs } from "../../src/llm/codex.ts"

const input = { system: "S", jsonSchema: { type: "object" } }
const paths = { schemaPath: "/tmp/s.json", outputPath: "/tmp/o.json" }

describe("--effort", () => {
  it("is passed to claude as --effort", () => {
    const args = claudeArgs(input, { effort: "medium" })
    expect(args.slice(args.indexOf("--effort"), args.indexOf("--effort") + 2)).toEqual([
      "--effort",
      "medium",
    ])
    expect(claudeArgs(input, {})).not.toContain("--effort")
  })

  it("is passed to codex as a reasoning effort override, which --ignore-user-config allows", () => {
    const args = codexArgs(paths, { effort: "high" })
    expect(args.join(" ")).toContain('-c model_reasoning_effort="high"')
    expect(codexArgs(paths, {}).join(" ")).not.toContain("model_reasoning_effort")
  })
})
