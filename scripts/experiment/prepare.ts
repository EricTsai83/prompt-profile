/**
 * Hold the experiment input constant (plan 22 §2): each persona is prepared once with a fixed
 * clock, and the same prepared prompts are reused by every variant and repetition.
 */
import { DateTime } from "effect"
import { sha256 } from "../../src/analysis/hash.ts"
import { selectChunks, translationCalls, type AnalyzeOptions } from "../../src/analysis/plan.ts"
import type { SafePrompt } from "../../src/domain/SafePrompt.ts"
import type { Stats } from "../../src/domain/Stats.ts"
import { processRecords } from "../../src/pipeline/index.ts"
import { toRecords, type Persona } from "../eval-personas.ts"
import type { QualityRubric } from "../eval-quality.ts"
import type { ExperimentConfig, Variant } from "./config.ts"

/** Fixed "now" so the pipeline (e.g. relative dates) never depends on when a run happens. */
export const FIXED_NOW = DateTime.makeUnsafe("2026-10-24T00:00:00Z")

export interface PersonaFiles {
  /** The exact `prompts.json` text, hashed as the source input. */
  readonly raw: string
  readonly rubric: QualityRubric
}

export interface PreparedPersona {
  readonly name: string
  readonly timezone: string
  readonly prompts: ReadonlyArray<SafePrompt>
  readonly stats: Stats
  readonly rubric: QualityRubric
  readonly inputSha256: string
  /** Hash of the cleaned, redacted prompts actually available to the analysis. */
  readonly preparedSha256: string
}

export const preparePersona = (
  name: string,
  files: PersonaFiles,
  timezoneOverride: string | null,
): PreparedPersona => {
  const persona = JSON.parse(files.raw) as Persona
  const timezone = timezoneOverride ?? persona.timezone
  const { prompts, stats } = processRecords(toRecords(name, persona), {
    since: null,
    now: FIXED_NOW,
    timezone,
    username: null,
  })
  return {
    name,
    timezone,
    prompts,
    stats,
    rubric: files.rubric,
    inputSha256: sha256(files.raw),
    preparedSha256: sha256(JSON.stringify(prompts.map((p) => [p.id, p.text]))),
  }
}

/** Every repetition is fresh: the cache is never read. */
export const analyzeOptions = (persona: PreparedPersona, variant: Variant): AnalyzeOptions => ({
  timezone: persona.timezone,
  full: variant.options.full,
  noCache: true,
  model: variant.options.model,
  languages: variant.options.languages,
})

export interface Selection {
  readonly chunkIds: ReadonlyArray<string>
  readonly selectedPromptIds: ReadonlyArray<string>
  readonly chunksTotal: number
  readonly sampled: boolean
  /** Map calls + reduce + one per non-English language; merges and retries come on top. */
  readonly minimumCalls: number
}

export const selection = (persona: PreparedPersona, variant: Variant): Selection => {
  const options = analyzeOptions(persona, variant)
  const { all, chunks, sampled } = selectChunks(persona.prompts, options)
  return {
    chunkIds: chunks.map((c) => c.id),
    selectedPromptIds: chunks.flatMap((c) => c.prompts.map((p) => p.id)),
    chunksTotal: all.length,
    sampled,
    minimumCalls: chunks.length === 0 ? 0 : chunks.length + 1 + translationCalls(options),
  }
}

export interface Case {
  readonly id: string
  /** 1-based position in the planned execution order. */
  readonly order: number
  readonly persona: string
  readonly variant: Variant
  readonly repeat: number
}

/** Folder of a case, relative to the experiment folder. Built from validated ids only. */
export const caseDir = (c: Pick<Case, "persona" | "repeat"> & { variant: { id: string } }) =>
  `cases/${c.persona}/${c.variant.id}/r${c.repeat}`

/**
 * Persona, then repeat, then variant: variants are interleaved, so every variant of one
 * repetition runs close together on the same input.
 */
export const expandCases = (config: ExperimentConfig): ReadonlyArray<Case> => {
  const cases: Array<Case> = []
  for (const persona of config.personas)
    for (let repeat = 1; repeat <= config.repeats; repeat++)
      for (const variant of config.variants)
        cases.push({
          id: `${persona}/${variant.id}/r${repeat}`,
          order: cases.length + 1,
          persona,
          variant,
          repeat,
        })
  return cases
}

/** What `--dry-run` prints. Sends nothing. */
export const dryRunLines = (
  config: ExperimentConfig,
  prepared: ReadonlyMap<string, PreparedPersona>,
  budget: number,
): ReadonlyArray<string> => {
  const lines: Array<string> = []
  const cases = expandCases(config)
  let total = 0
  lines.push(
    `Experiment: ${config.personas.length} persona(s) × ${config.variants.length} variant(s) × ${config.repeats} repeat(s) = ${cases.length} case(s); baseline ${config.baseline}`,
  )
  lines.push(`Render looks (no LLM calls): ${config.looks.join(", ")}`)
  for (const v of config.variants) {
    const o = v.options
    lines.push(
      `  variant ${v.id}: engine ${o.engine}, model ${o.model ?? "CLI default (not a stable named model)"}, full ${o.full}, languages ${o.languages.join(",")}` +
        (v.changedFactors.length > 0
          ? `; differs from baseline in: ${v.changedFactors.join(", ")}`
          : ""),
    )
  }
  for (const name of config.personas) {
    const p = prepared.get(name)!
    lines.push(
      `  persona ${name}: ${p.prompts.length} prepared prompt(s), time zone ${p.timezone}, input ${p.inputSha256.slice(0, 12)}`,
    )
    for (const v of config.variants) {
      const s = selection(p, v)
      lines.push(
        `    ${v.id}: ${s.chunkIds.length} of ${s.chunksTotal} chunk(s)${s.sampled ? " (sampled)" : ""}, at least ${s.minimumCalls} call(s) per repeat`,
      )
      total += s.minimumCalls * config.repeats
    }
  }
  lines.push(
    `Expected minimum CLI calls: ${total}. Merges of large inputs and retries add an uncertain number.`,
  )
  lines.push(
    `Attempt cap (--budget): ${budget}. The cap stops new work; it does not promise completion.`,
  )
  if (total > budget)
    lines.push(`Warning: the minimum exceeds the cap; some cases will be skipped for budget.`)
  lines.push("Dry run: no prompt was sent.")
  return lines
}
