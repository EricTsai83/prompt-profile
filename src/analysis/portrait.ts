import { INTERACTION_AXES } from "../domain/Interaction.ts"
import type { Portrait } from "../domain/Profile.ts"
import { verifyCompleteEvidence, type EvidenceCounts, type PromptOrigin } from "./verify.ts"

/** Maximum independent conversation support: copied excerpts cannot multiply recurrence.
 * Match distinct excerpts to distinct sessions, independent of citation order. Each session
 * contributes at most once. Keep original evidence even when it adds no independent support.
 */
export const independentSessions = (
  evidence: Portrait["axes"][number]["sides"][number]["evidence"],
  origins: ReadonlyMap<string, PromptOrigin>,
  texts?: ReadonlyMap<string, string>,
): number => {
  const choices = new Map<string, Set<string>>()
  for (const e of evidence) {
    const session = origins.get(e.promptId)?.session
    if (!session) continue
    const quotes = choices.get(session) ?? new Set<string>()
    quotes.add(e.quote.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim())
    choices.set(session, quotes)
  }
  const owners = new Map<string, string>()
  const assign = (session: string, visited: Set<string>): boolean => {
    for (const quote of choices.get(session) ?? []) {
      if (visited.has(quote)) continue
      visited.add(quote)
      const owner = owners.get(quote)
      if (owner === undefined || assign(owner, visited)) {
        owners.set(quote, session)
        return true
      }
    }
    return false
  }
  for (const session of choices.keys()) assign(session, new Set())
  if (!texts) return owners.size
  // Identical source templates cannot gain recurrence by quoting different fragments.
  const sourceEvidence = evidence.map((e) => ({ ...e, quote: texts.get(e.promptId) ?? e.quote }))
  return Math.min(owners.size, independentSessions(sourceEvidence, origins))
}

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
      const sessions = independentSessions(evidence, origins, texts)
      return [{ ...side, evidence, sessions }]
    })
    const cited = sides
      .flatMap((s) => s.evidence)
      .flatMap((e) => (origins.has(e.promptId) ? [origins.get(e.promptId)!] : []))
    return {
      key,
      explanation: axis?.explanation ?? "",
      sides,
      coverage: {
        citedSessions: new Set(cited.map((o) => o.session)).size,
        analysedSessions: new Set([...origins.values()].map((o) => o.session)).size,
        periods: new Set(cited.map((o) => o.week)).size,
        scope: "cited_choices" as const,
      },
    }
  })
  return rejectedAxis ? reject() : { ...portrait, chapters, axes }
}
