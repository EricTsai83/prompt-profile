import { INTERACTION_AXES } from "../domain/Interaction.ts"
import type { Portrait } from "../domain/Profile.ts"
import { verifyEvidence, type EvidenceCounts, type PromptOrigin } from "./verify.ts"

/** Verify source quotes before allowing prose or classification into the report. */
export const verifyPortrait = (
  portrait: Portrait | null | undefined,
  texts: ReadonlyMap<string, string>,
  origins: ReadonlyMap<string, PromptOrigin>,
  counts: EvidenceCounts,
): Portrait | null => {
  if (!portrait) return null
  const chapters = portrait.chapters.flatMap((c) => {
    const evidence = verifyEvidence(c.evidence, texts, counts)
    return evidence.length > 0 ? [{ ...c, evidence }] : []
  })
  if (chapters.length === 0) return null
  const axes = INTERACTION_AXES.map(({ key }) => {
    const axis = portrait.axes.find((a) => a.key === key)
    const evidence = verifyEvidence(axis?.evidence ?? [], texts, counts)
    const counterEvidence = verifyEvidence(axis?.counterEvidence ?? [], texts, counts)
    const sessions = new Set(
      evidence.flatMap((e) => {
        const origin = origins.get(e.promptId)
        return origin ? [origin.session] : []
      }),
    ).size
    // Contradictions are surfaced, never resolved by the volume of one long session.
    const pole =
      sessions >= 2 && counterEvidence.length === 0 ? (axis?.pole ?? "unclear") : "unclear"
    return { key, pole, explanation: axis?.explanation ?? "", evidence, counterEvidence }
  })
  return { ...portrait, chapters, axes }
}
