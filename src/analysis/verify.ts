import type { ChunkObservations } from "../domain/ChunkObservations.ts"
import type { Confidence, Dimension, Evidence, Trait } from "../domain/Profile.ts"
import { escapeText, unescapeText } from "./chunk.ts"

/**
 * Normalise text before comparing quotes: unify full-width / CJK punctuation with ASCII,
 * collapse whitespace, lower-case. (`&lt;` / `&gt;` are handled by `matchQuote`.)
 */
export const normalizeForMatch = (s: string): string =>
  s
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

/** Every segment of the quote must appear, in order, in the (normalised) prompt text. */
const segmentsMatch = (quote: string, haystack: string): boolean => {
  const segments = quoteSegments(quote)
  if (segments.length === 0) return false
  let from = 0
  for (const seg of segments) {
    const idx = haystack.indexOf(seg, from)
    if (idx === -1) return false
    from = idx + seg.length
  }
  return true
}

/**
 * The quote to store, or null when it is not in the prompt. The LLM copies quotes from the
 * chunk text, where `<` / `>` are escaped (`escapeText`), so the quote is matched against
 * the escaped prompt. It is stored unescaped — unless the prompt itself contains a literal
 * `&lt;` / `&gt;`, where unescaping would be ambiguous and the quote is kept as written.
 * A quote the LLM unescaped itself is matched against the original prompt.
 */
export const matchQuote = (quote: string, promptText: string): string | null => {
  if (segmentsMatch(quote, normalizeForMatch(escapeText(promptText)))) {
    return /&lt;|&gt;/.test(promptText) ? quote : unescapeText(quote)
  }
  return segmentsMatch(quote, normalizeForMatch(promptText)) ? quote : null
}

export const quoteMatches = (quote: string, promptText: string): boolean =>
  matchQuote(quote, promptText) !== null

export interface EvidenceCounts {
  kept: number
  dropped: number
}

/**
 * Keep only evidence whose prompt id exists and whose quote is in that prompt's text.
 * Kept quotes are stored as they appear in the prompt (see `matchQuote`).
 */
export const verifyEvidence = (
  evidence: ReadonlyArray<Evidence>,
  texts: ReadonlyMap<string, string>,
  counts: EvidenceCounts,
): ReadonlyArray<Evidence> =>
  evidence.flatMap((e) => {
    const text = texts.get(e.promptId)
    const quote = text === undefined ? null : matchQuote(e.quote, text)
    if (quote === null) {
      counts.dropped++
      return []
    }
    counts.kept++
    return [{ ...e, quote }]
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
