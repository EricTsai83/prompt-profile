import type {
  Collaboration,
  ReportedEffect,
  Episode,
  LlmCollaboration,
  Evidence,
} from "../domain/index.ts"
import { independentSessions } from "./portrait.ts"
import { verifyCompleteEvidence, type EvidenceCounts, type PromptOrigin } from "./verify.ts"

/** Structured collaboration evidence, never a numerical ability or personality assessment. */
export const verifyCollaboration = (
  proposed: LlmCollaboration | null | undefined,
  episodes: ReadonlyArray<Episode>,
  texts: ReadonlyMap<string, string>,
  origins: ReadonlyMap<string, PromptOrigin>,
  counts: EvidenceCounts,
): Collaboration | null => {
  if (!proposed) return null
  const rejected = { moves: 0, signals: 0, effects: 0 }
  const spread = (evidence: ReadonlyArray<Evidence>) => ({
    sessions: independentSessions(evidence, origins, texts),
    weeks: new Set(
      evidence.flatMap((e) => (origins.has(e.promptId) ? [origins.get(e.promptId)!.week] : [])),
    ).size,
  })
  const effect = (
    value: ReportedEffect | null,
    supporting: ReadonlyArray<Episode>,
  ): ReportedEffect | null => {
    if (!value) return null
    const evidence = verifyCompleteEvidence(value.evidence, texts, counts)
    const reported = new Set(
      supporting.filter((e) => e.ending.kind === "user_reported").map((e) => e.ending.promptId),
    )
    if (!evidence.length || !evidence.every((e) => reported.has(e.promptId))) {
      counts.kept -= evidence.length
      counts.dropped += evidence.length
      rejected.effects++
      return null
    }
    return { ...value, evidence }
  }
  const moves = proposed.moves.flatMap((m) => {
    const supporting = episodes.filter((e) => m.episodeIds.includes(e.id))
    const independent = independentSessions(
      supporting.flatMap((episode) => {
        const first = episode.turns[0]
        return first
          ? [
              {
                promptId: first.promptId,
                quote: JSON.stringify(
                  episode.turns.map((turn) => texts.get(turn.promptId) ?? turn.quote),
                ),
              },
            ]
          : []
      }),
      origins,
    )
    if (
      !m.name.trim() ||
      !m.episodeIds.every((id) => supporting.some((e) => e.id === id)) ||
      new Set(supporting.map((e) => e.session)).size < 2 ||
      independent < 2 ||
      supporting.some((e) => e.turns.length < 2)
    ) {
      rejected.moves++
      return []
    }
    return [
      {
        ...m,
        episodeIds: supporting.map((e) => e.id),
        support: {
          sessions: independent,
          weeks: spread(supporting.flatMap((e) => e.turns)).weeks,
        },
        benefit: effect(m.benefit, supporting),
        cost: effect(m.cost, supporting),
      },
    ]
  })
  const signals = proposed.signals.flatMap((s) => {
    if (s.basis !== "user_request" && s.basis !== "user_report") {
      rejected.signals++
      return []
    }
    const evidence = verifyCompleteEvidence(s.evidence, texts, counts)
    const support = spread(evidence)
    if (!evidence.length || support.sessions === 0) {
      rejected.signals++
      return []
    }
    return [{ ...s, basis: s.basis, evidence, support }]
  })
  return { moves, signals, rejected }
}
