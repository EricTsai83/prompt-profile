import { EvidenceOrigin } from "./EvidenceOrigin.ts"
import { DateTime, Schema } from "effect"
import { axisState, AXIS_KEYS } from "./Interaction.ts"
import type { Profile } from "./Profile.ts"
import { MAX_QUOTE_LENGTH } from "./quote.ts"
const Quote = Schema.Struct({
  promptId: Schema.String,
  quote: Schema.String.check(Schema.isMaxLength(MAX_QUOTE_LENGTH)),
})
const Window = Schema.Struct({
  since: Schema.DateTimeUtcFromString,
  until: Schema.DateTimeUtcFromString,
})
export const HistoryComparison = Schema.Struct({
  previousProjects: Schema.Array(Schema.String),
  previousGeneratedAt: Schema.DateTimeUtcFromString,
  previousWindow: Window,
  currentWindow: Window,
  toolComparable: Schema.Boolean,
  changes: Schema.Array(
    Schema.Struct({
      key: Schema.Literals(AXIS_KEYS),
      before: Schema.Literals(["first", "second", "both"]),
      after: Schema.Literals(["first", "second", "both"]),
      previousEvidence: Schema.Array(Quote),
      previousSources: Schema.Array(EvidenceOrigin),
      previousContexts: Schema.Array(Schema.String),
      contexts: Schema.Array(Schema.String),
      evidence: Schema.Array(Quote),
    }),
  ),
})
export type HistoryComparison = typeof HistoryComparison.Type
export interface ComparisonVersions {
  readonly schema: number
  readonly pipeline: string
}

/** Strict product comparability policy; a role label alone is never evidence of change. */
export const compareHistory = (
  current: Profile,
  previous: Profile,
  nowVersion: ComparisonVersions,
  previousVersion: ComparisonVersions,
): { readonly comparison: HistoryComparison | null; readonly reasons: ReadonlyArray<string> } => {
  const reasons: Array<string> = []
  if (current.context?.identity !== previous.context?.identity) reasons.push("different-context")
  const a = current.stats.window,
    b = previous.stats.window
  if (!a.since || !b.since) reasons.push("unbounded-window")
  else {
    const fromA = DateTime.toEpochMillis(a.since),
      toA = DateTime.toEpochMillis(a.until),
      fromB = DateTime.toEpochMillis(b.since),
      toB = DateTime.toEpochMillis(b.until)
    if (fromA < toB && fromB < toA) reasons.push("overlapping-windows")
    if (toB > fromA) reasons.push("nonchronological-windows")
    if (toA <= fromA || toB <= fromB || toA - fromA !== toB - fromB)
      reasons.push("different-window-length")
  }
  if (nowVersion.schema !== previousVersion.schema) reasons.push("different-schema")
  if (nowVersion.pipeline !== previousVersion.pipeline || previousVersion.pipeline === "unknown")
    reasons.push("different-pipeline")
  if (current.engine.analysisVersion !== previous.engine.analysisVersion)
    reasons.push("different-analysis")
  const models = (p: Profile) =>
    p.engine.modelSource === "reported" &&
    p.engine.model !== null &&
    p.engine.modelsUsed?.length === 1 &&
    p.engine.modelsUsed[0] === p.engine.model
  if (!models(current) || !models(previous)) reasons.push("unknown-model-provenance")
  if (
    current.engine.runner !== previous.engine.runner ||
    current.engine.model !== previous.engine.model ||
    current.engine.effort !== previous.engine.effort
  )
    reasons.push("different-engine")
  if (current.stats.timezone !== previous.stats.timezone) reasons.push("different-timezone")
  for (const p of [current, previous]) {
    if (
      p.coverage.sampled ||
      p.coverage.chunksFailed ||
      p.coverage.promptsAnalyzed !== p.stats.analyzedPrompts
    )
      reasons.push("incomplete-evidence-coverage")
  }
  if (
    Object.keys(current.stats.bySource)
      .filter((s) => current.stats.bySource[s as keyof typeof current.stats.bySource] > 0)
      .join(",") !==
    Object.keys(previous.stats.bySource)
      .filter((s) => previous.stats.bySource[s as keyof typeof previous.stats.bySource] > 0)
      .join(",")
  )
    reasons.push("different-source-coverage")
  if (reasons.length || !a.since || !b.since)
    return { comparison: null, reasons: [...new Set(reasons)] }
  const completeTools = (p: Profile) =>
    p.stats.techniques !== null &&
    p.stats.techniques.coveredSessions > 0 &&
    p.stats.techniques.coveredSessions === p.stats.totalSessions
  const changes = AXIS_KEYS.flatMap((key) => {
    const before = previous.portrait?.axes.find((axis) => axis.key === key),
      after = current.portrait?.axes.find((axis) => axis.key === key)
    if (!before || !after) return []
    const left = axisState(before),
      right = axisState(after)
    if (left === "none" || right === "none" || left === right) return []
    const quotes = (axis: typeof before) =>
      axis.sides.filter((s) => s.sessions >= 2).flatMap((s) => s.evidence.slice(0, 2))
    if (!quotes(before).length || !quotes(after).length) return []
    return [
      {
        key,
        before: left,
        after: right,
        previousEvidence: quotes(before),
        previousSources: (previous.evidenceOrigins ?? []).filter((o) =>
          quotes(before).some((e) => e.promptId === o.promptId),
        ),
        previousContexts: before.sides.filter((s) => s.sessions >= 2).map((s) => s.context),
        contexts: after.sides.filter((s) => s.sessions >= 2).map((s) => s.context),
        evidence: quotes(after),
      },
    ]
  }).slice(0, 2)
  return {
    comparison: {
      previousProjects: [
        ...new Set([
          ...previous.stats.activity.projects,
          ...previous.stats.topProjects.map((p) => p.name),
        ]),
      ],
      previousGeneratedAt: previous.generatedAt,
      previousWindow: { since: b.since, until: b.until },
      currentWindow: { since: a.since, until: a.until },
      toolComparable: completeTools(current) && completeTools(previous),
      changes,
    },
    reasons: [],
  }
}
