import { describe, expect, it } from "vitest"
import {
  legacyConfig,
  parseBudget,
  parseConfig,
  UsageError,
} from "../../../scripts/experiment/config.ts"

const PERSONAS = ["methodical-backend", "curious-learner"]

const valid = () => ({
  version: 1,
  personas: ["methodical-backend"],
  repeats: 2,
  baseline: "claude-default",
  shared: { timezone: "Asia/Taipei", languages: ["en", "zh-TW"], full: true, look: "classic" },
  variants: [
    { id: "claude-default", engine: "claude", model: null },
    { id: "claude-explicit", engine: "claude", model: "opus" },
    { id: "codex-default", engine: "codex", model: null, full: false },
  ],
})

const errorsOf = (input: unknown) => {
  const result = parseConfig(input, PERSONAS)
  return result.ok ? [] : result.errors
}

describe("parseConfig", () => {
  it("accepts a valid matrix and resolves each variant's effective options", () => {
    const result = parseConfig(valid(), PERSONAS)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { config } = result
    expect(config.looks).toEqual(["classic"])
    expect(config.variants.map((v) => v.options)).toEqual([
      { engine: "claude-code", model: null, full: true, languages: ["en", "zh-TW"] },
      { engine: "claude-code", model: "opus", full: true, languages: ["en", "zh-TW"] },
      { engine: "codex", model: null, full: false, languages: ["en", "zh-TW"] },
    ])
    // every factor that differs from the baseline is named
    expect(config.variants.map((v) => v.changedFactors)).toEqual([
      [],
      ["model"],
      ["engine", "full"],
    ])
  })

  it("collects every problem instead of stopping at the first", () => {
    const input = {
      ...valid(),
      repeats: 0,
      baseline: "missing",
      personas: ["nobody", "../escape"],
      variants: [
        { id: "a", engine: "claude", model: null },
        { id: "a", engine: "gemini", model: null },
      ],
    }
    const errors = errorsOf(input)
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/repeats/),
        expect.stringMatching(/baseline "missing"/),
        expect.stringMatching(/Unknown persona "nobody"/),
        expect.stringMatching(/persona.*"\.\.\/escape"/),
        expect.stringMatching(/Duplicate variant id "a"/),
        expect.stringMatching(/engine/),
      ]),
    )
  })

  it.each([
    ["../up", "path traversal"],
    ["a/b", "separator"],
    ["UPPER", "uppercase"],
    ["", "empty"],
    ["-flag", "leading dash"],
  ])("rejects unsafe variant id %j (%s)", (id) => {
    const input = valid()
    input.variants[0] = { id, engine: "claude", model: null }
    input.baseline = id
    expect(errorsOf(input).join("\n")).toMatch(/variant id/)
  })

  it.each([["--dangerously-skip-permissions"], ["has space"], [""], ["a\nb"]])(
    "rejects a model that could be read as a CLI flag or is malformed: %j",
    (model) => {
      const input = valid()
      input.variants[1] = { id: "claude-explicit", engine: "claude", model }
      expect(errorsOf(input).join("\n")).toMatch(/model/)
    },
  )

  it("rejects unknown keys, conflicting look options and bad languages", () => {
    const input = {
      ...valid(),
      temperature: 0.2,
      shared: { look: "classic", looks: ["prism"], languages: ["en", "en", "fr"] },
      variants: [{ id: "claude-default", engine: "claude", model: null, seed: 1 }],
    }
    const text = errorsOf(input).join("\n")
    expect(text).toMatch(/Unknown key "temperature"/)
    expect(text).toMatch(/Unknown key "seed"/)
    expect(text).toMatch(/look.*looks/)
    expect(text).toMatch(/Duplicate language "en"/)
    expect(text).toMatch(/Unsupported language "fr"/)
  })

  it("rejects an unknown look, a bad time zone and an unsupported version", () => {
    const text = errorsOf({
      ...valid(),
      version: 2,
      shared: { timezone: "Mars/Olympus", looks: ["neon"] },
    }).join("\n")
    expect(text).toMatch(/version/)
    expect(text).toMatch(/time zone/)
    expect(text).toMatch(/Unknown look "neon"/)
  })

  it.each([["constructor"], ["toString"], ["__proto__"]])(
    "rejects an inherited property name as an engine: %s",
    (engine) => {
      const input = valid()
      input.variants[2] = { id: "codex-default", engine, model: null }
      expect(errorsOf(input).join("\n")).toMatch(/engine must be one of/)
    },
  )

  it("rejects input that is not an object", () => {
    expect(errorsOf(null)).toEqual(["Config must be a JSON object"])
    expect(errorsOf([])).toEqual(["Config must be a JSON object"])
  })
})

describe("parseBudget", () => {
  it("accepts a positive integer and rejects anything else", () => {
    expect(parseBudget("40")).toBe(40)
    for (const bad of ["0", "-1", "1.5", "abc", "", "1e3"]) {
      expect(() => parseBudget(bad)).toThrow(UsageError)
    }
  })
})

describe("legacyConfig", () => {
  it("turns the old --engines/--repeats flags into an equivalent default-model matrix", () => {
    const result = parseConfig(legacyConfig(["claude", "codex"], 2, PERSONAS), PERSONAS)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.baseline).toBe("claude-default")
    expect(result.config.variants.map((v) => [v.id, v.options.engine, v.options.model])).toEqual([
      ["claude-default", "claude-code", null],
      ["codex-default", "codex", null],
    ])
    expect(result.config.personas).toEqual(PERSONAS)
    expect(result.config.repeats).toBe(2)
  })
})
