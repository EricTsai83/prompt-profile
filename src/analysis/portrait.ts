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
    // At most one side per pole; each is checked on its own and counted by conversation, so
    // both ways of working can stand: different contexts, not a contradiction.
    const sides = (["first", "second"] as const).flatMap((pole) => {
      const side = axis?.sides.find((s) => s.pole === pole)
      if (!side) return []
      const evidence = verifyCompleteEvidence(side.evidence, texts, counts)
      if (side.evidence.length > 0 && evidence.length === 0) rejectedAxis = true
      if (evidence.length === 0) return []
      const sessions = new Set(
        evidence.flatMap((e) => {
          const origin = origins.get(e.promptId)
          return origin ? [origin.session] : []
        }),
      ).size
      return [{ ...side, evidence, sessions }]
    })
    return { key, explanation: axis?.explanation ?? "", sides }
  })
  return rejectedAxis ? reject() : { ...portrait, chapters, axes }
}
