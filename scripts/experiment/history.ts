/** Freeze local input once; never persist raw records or source paths. */
import { DateTime } from "effect"
import type { PromptRecord } from "../../src/domain/PromptRecord.ts"
import { sha256 } from "../../src/analysis/hash.ts"
import { processRecords, type PipelineOptions } from "../../src/pipeline/index.ts"
import { PIPELINE_VERSION } from "../../src/pipeline/version.ts"
import type { PreparedPersona } from "./prepare.ts"
import { UsageError } from "./config.ts"

export const prepareHistory = (
  records: ReadonlyArray<PromptRecord>,
  options: Pick<PipelineOptions, "now" | "timezone" | "username">,
  diagnostics: ReadonlyArray<{ source: string; badLines: number; unreadableFiles: number }>,
) => {
  const result = processRecords(records, { ...options, since: null })
  if (result.prompts.length === 0) throw new UsageError("No analysable local history")
  const metadata = {
    version: 1,
    pipelineVersion: PIPELINE_VERSION,
    now: DateTime.formatIso(options.now),
    timezone: options.timezone,
    since: null,
    diagnostics,
    report: result.report,
    qualityPolicy:
      "No authored persona expectations; heuristic measurements only; review manually.",
  }
  const hash = sha256(JSON.stringify(result.prompts.map((p) => [p.id, p.text])))
  const prepared: PreparedPersona = {
    name: "local-history",
    timezone: options.timezone,
    prompts: result.prompts,
    stats: result.stats,
    inputSha256: sha256(JSON.stringify({ metadata, prompts: result.prompts })),
    preparedSha256: hash,
    rubric: {
      requiredConcepts: [],
      forbiddenPatterns: [],
      minTraits: 0,
      minEvidenceRetention: 0,
      maxEmptyDimensions: 5,
    },
  }
  return { metadata, prepared }
}
