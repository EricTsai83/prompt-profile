import { INTERACTION_AXES } from "../domain/Interaction.ts"
import type { Portrait } from "../domain/Profile.ts"
import { verifyCompleteEvidence, type EvidenceCounts, type PromptOrigin } from "./verify.ts"

/** Verify source quotes before allowing prose or classification into the report. */
export const verifyPortrait = (
  portrait: Portrait | null | undefined,
  texts: ReadonlyMap<string, string>,
  origins: ReadonlyMap<string, PromptOrigin>,
  counts: EvidenceCounts,
): Portrait | null => {
  if (!portrait) return null
  const initiallyKept = counts.kept
  const reject = () => {
    counts.dropped += counts.kept - initiallyKept
    counts.kept = initiallyKept
    return null
  }
  const chapters = portrait.chapters.flatMap((c) => {
    const evidence = verifyCompleteEvidence(c.evidence, texts, counts)
    return evidence.length > 0 ? [{ ...c, evidence }] : []
  })
  if (chapters.length === 0 || chapters.length !== portrait.chapters.length) return reject()
  let rejectedAxis = false
  const axes = INTERACTION_AXES.map(({ key }) => {
    const axis = portrait.axes.find((a) => a.key === key)
    const evidence = verifyCompleteEvidence(axis?.evidence ?? [], texts, counts)
    const counterEvidence = verifyCompleteEvidence(axis?.counterEvidence ?? [], texts, counts)
    if (
      axis &&
      ((axis.evidence.length > 0 && evidence.length === 0) ||
        (axis.counterEvidence.length > 0 && counterEvidence.length === 0))
    )
      rejectedAxis = true
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
  return rejectedAxis ? reject() : { ...portrait, chapters, axes }
}
