import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { parseConfig, type ExperimentConfig } from "../../../scripts/experiment/config.ts"
import type { Provenance } from "../../../scripts/experiment/execute.ts"
import { preparePersona, type PreparedPersona } from "../../../scripts/experiment/prepare.ts"
import type { RunnerStatus } from "../../../src/llm/detect.ts"
import { makeFakeLlmRunner, type FakeOptions } from "../../../src/llm/fake.ts"
import type { LlmRunnerShape, RunnerId } from "../../../src/llm/LlmRunner.ts"
import { withRetry } from "../../../src/llm/retry.ts"
import { respond } from "../../cli/harness.ts"

export const PERSONAS = ["curious-learner", "methodical-backend"]
const root = new URL("../../eval/personas/", import.meta.url).pathname

export const personaFiles = (name: string) => ({
  raw: readFileSync(`${root}${name}/prompts.json`, "utf8"),
  rubric: JSON.parse(readFileSync(`${root}${name}/rubric.json`, "utf8")),
})

export const configOf = (input: Record<string, unknown>): ExperimentConfig => {
  const result = parseConfig({ version: 1, ...input }, PERSONAS)
  if (!result.ok) throw new Error(result.errors.join("\n"))
  return result.config
}

/** Passes any profile, so tests can set their own gate; the real rubrics need a real LLM. */
export const LENIENT_RUBRIC = {
  requiredConcepts: [],
  forbiddenPatterns: [],
  minTraits: 0,
  minEvidenceRetention: 0,
  maxEmptyDimensions: 5,
}

export const prepareAll = (
  config: ExperimentConfig,
  rubric: unknown = LENIENT_RUBRIC,
): Map<string, PreparedPersona> =>
  new Map(
    config.personas.map((p) => [
      p,
      preparePersona(p, { ...personaFiles(p), rubric: rubric as never }, config.timezone),
    ]),
  )

export const provenance: Provenance = {
  git: { revision: "abc123", dirty: false },
  packageVersion: "0.0.0-test",
  node: "v22",
  versions: {
    pipeline: "1",
    analysis: "1",
    profileSchema: 9,
    renderManifest: 2,
    looks: { classic: 2 },
  },
}

export const available = (id: RunnerId): RunnerStatus => ({
  id,
  installed: true,
  version: "1.0.0",
  loggedIn: true,
})

/** Fake runners per engine/model; records every makeRunner request. */
export const fakeDeps = (
  options: {
    readonly fake?: (engine: RunnerId, model: string | null) => FakeOptions
    readonly statuses?: Partial<Record<RunnerId, RunnerStatus>>
    readonly wrap?: (runner: LlmRunnerShape) => LlmRunnerShape
  } = {},
) => {
  const requests: Array<{ engine: RunnerId; model: string | null }> = []
  let calls = 0
  const deps = {
    makeRunner: (engine: RunnerId, model: string | null) =>
      Effect.sync(() => {
        requests.push({ engine, model })
        const fake = makeFakeLlmRunner({
          id: engine,
          respond: respond!,
          model: model ?? `${engine}-default-model`,
          ...options.fake?.(engine, model),
        })
        const counted: LlmRunnerShape = {
          ...fake,
          generate: (input) =>
            Effect.suspend(() => {
              calls++
              return fake.generate(input)
            }),
        }
        return options.wrap ? options.wrap(counted) : counted
      }),
    detect: (engine: RunnerId) => Effect.succeed(options.statuses?.[engine] ?? available(engine)),
    retry: (r: LlmRunnerShape) => withRetry(r, { baseDelay: 0, rateLimitMinDelay: 0 }),
  }
  return { deps, requests, calls: () => calls }
}
