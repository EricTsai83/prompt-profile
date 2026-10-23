import type { ChunkObservations } from "../domain/ChunkObservations.ts"
import type { Confidence, Dimension, Evidence, Trait } from "../domain/Profile.ts"

/**
 * Normalise text before comparing quotes: unescape &lt; &gt;, unify full-width / CJK
 * punctuation with ASCII, collapse whitespace, lower-case.
 */
export const normalizeForMatch = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .normalize("NFKC")
    .replace(/[。]/g, ".")
    .replace(/[、]/g, ",")
    .replace(/[「」『』“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

/** Quotes may elide parts with "…" / "..." (and `truncateQuote` appends "…"). */
const quoteSegments = (quote: string): ReadonlyArray<string> =>
  normalizeForMatch(quote)
    .split(/…|\.\.\./)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

/** Every segment of the quote must appear, in order, in the prompt text. */
export const quoteMatches = (quote: string, promptText: string): boolean => {
  const segments = quoteSegments(quote)
  if (segments.length === 0) return false
  const haystack = normalizeForMatch(promptText)
  let from = 0
  for (const seg of segments) {
    const idx = haystack.indexOf(seg, from)
    if (idx === -1) return false
    from = idx + seg.length
  }
  return true
}

export interface EvidenceCounts {
  kept: number
  dropped: number
}

/** Keep only evidence whose prompt id exists and whose quote is in that prompt's text. */
export const verifyEvidence = (
  evidence: ReadonlyArray<Evidence>,
  texts: ReadonlyMap<string, string>,
  counts: EvidenceCounts,
): ReadonlyArray<Evidence> =>
  evidence.filter((e) => {
    const text = texts.get(e.promptId)
    const ok = text !== undefined && quoteMatches(e.quote, text)
    if (ok) counts.kept++
    else counts.dropped++
    return ok
  })

/** After map: drop invalid evidence, then observations with no evidence left. */
export const verifyObservations = (
  obs: ChunkObservations,
  texts: ReadonlyMap<string, string>,
  counts: EvidenceCounts = { kept: 0, dropped: 0 },
): ChunkObservations => ({
  chunkId: obs.chunkId,
  observations: obs.observations
    .map((o) => ({ ...o, evidence: verifyEvidence(o.evidence, texts, counts) }))
    .filter((o) => o.evidence.length > 0),
})

const DOWNGRADE: Record<Confidence, Confidence> = { high: "medium", medium: "low", low: "low" }

/**
 * After reduce: a trait with < 2 valid evidence drops one confidence level; with 0 it is
 * removed. Fewer than 3 traits is reported as-is (never loosen the rules to fill up).
 */
export const verifyTraits = (
  traits: ReadonlyArray<Trait>,
  texts: ReadonlyMap<string, string>,
  counts: EvidenceCounts,
): ReadonlyArray<Trait> =>
  traits.flatMap((t) => {
    const evidence = verifyEvidence(t.evidence, texts, counts)
    if (evidence.length === 0) return []
    return [
      { ...t, evidence, confidence: evidence.length < 2 ? DOWNGRADE[t.confidence] : t.confidence },
    ]
  })

/** Dimensions keep their summary even with 0 evidence (the report flags "insufficient evidence"). */
export const verifyDimensions = (
  dimensions: ReadonlyArray<Dimension>,
  texts: ReadonlyMap<string, string>,
  counts: EvidenceCounts,
): ReadonlyArray<Dimension> =>
  dimensions.map((d) => ({ ...d, evidence: verifyEvidence(d.evidence, texts, counts) }))
