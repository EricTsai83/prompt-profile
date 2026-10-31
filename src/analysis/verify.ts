import type {
  ChunkObservations,
  Confidence,
  Dimension,
  Evidence,
  Improvement,
  Trait,
} from "../domain/index.ts"
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
): ReadonlyArray<Evidence> => {
  const seen = new Set<string>()
  return evidence.flatMap((e) => {
    const text = texts.get(e.promptId)
    const quote = text === undefined ? null : matchQuote(e.quote, text)
    const key = JSON.stringify([e.promptId, quote === null ? null : normalizeForMatch(quote)])
    if (quote === null || seen.has(key)) {
      counts.dropped++
      return []
    }
    seen.add(key)
    counts.kept++
    return [{ ...e, quote }]
  })
}

/** Prose can combine several assertions; after losing a citation we cannot safely keep it.
 * Duplicate citations are deduplicated but do not invalidate otherwise authentic support.
 */
export const verifyCompleteEvidence = (
  evidence: ReadonlyArray<Evidence>,
  texts: ReadonlyMap<string, string>,
  counts: EvidenceCounts,
): ReadonlyArray<Evidence> => {
  const invalid = evidence.some((e) => {
    const text = texts.get(e.promptId)
    return text === undefined || !quoteMatches(e.quote, text)
  })
  const verified = verifyEvidence(evidence, texts, counts)
  if (invalid) {
    counts.kept -= verified.length
    counts.dropped += verified.length
    return []
  }
  return verified
}

/** After map: drop invalid evidence, then observations with no evidence left. */
export const verifyObservations = (
  obs: ChunkObservations,
  texts: ReadonlyMap<string, string>,
  counts: EvidenceCounts = { kept: 0, dropped: 0 },
): ChunkObservations => ({
  ...obs,
  observations: obs.observations
    .map((o) => ({ ...o, evidence: verifyCompleteEvidence(o.evidence, texts, counts) }))
    .filter((o) => o.evidence.length > 0),
})

const DOWNGRADE: Record<Confidence, Confidence> = { high: "medium", medium: "low", low: "low" }

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 }
const lower = (a: Confidence, b: Confidence): Confidence => (RANK[a] <= RANK[b] ? a : b)

/** Where a prompt came from: its session and its analysed week (chunk). */
export interface PromptOrigin {
  readonly session: string
  readonly week: string
}

/**
 * After reduce: a trait supported by < 2 distinct prompts drops one confidence level; with 0 it is
 * removed. Then the spread of its quotes caps the confidence (never raises it): `high` needs 3
 * sessions across at least 2 weeks, `medium` 2 sessions, otherwise `low`. Without complete origin data
 * spread is unknown and confidence is capped at low. Fewer than 3 traits is reported as-is.
 */
export const verifyTraits = (
  traits: ReadonlyArray<Omit<Trait, "support">>,
  texts: ReadonlyMap<string, string>,
  counts: EvidenceCounts,
  origins?: ReadonlyMap<string, PromptOrigin>,
): ReadonlyArray<Trait> =>
  traits.flatMap((t) => {
    const evidence = verifyCompleteEvidence(t.evidence, texts, counts)
    if (evidence.length === 0) return []
    const prompts = new Set(evidence.map((e) => e.promptId))
    const known = origins !== undefined && evidence.every((e) => origins.has(e.promptId))
    const support = known
      ? {
          sessions: new Set(evidence.map((e) => origins!.get(e.promptId)!.session)).size,
          weeks: new Set(evidence.map((e) => origins!.get(e.promptId)!.week)).size,
        }
      : null
    const allowed: Confidence =
      support && support.sessions >= 3 && support.weeks >= 2
        ? "high"
        : support && support.sessions >= 2
          ? "medium"
          : "low"
    const stated = prompts.size < 2 ? DOWNGRADE[t.confidence] : t.confidence
    return [{ ...t, evidence, confidence: lower(stated, allowed), support }]
  })

/**
 * Improvements need at least one verified quote; the rewrite is kept only when its prompt is
 * among the verified evidence (its quote is the "before" shown in the report).
 */
export const verifyImprovements = (
  improvements: ReadonlyArray<Improvement>,
  texts: ReadonlyMap<string, string>,
  counts: EvidenceCounts,
): ReadonlyArray<Improvement> =>
  improvements.flatMap((i) => {
    const evidence = verifyCompleteEvidence(i.evidence, texts, counts)
    if (evidence.length === 0) return []
    const rewrite =
      i.rewrite !== null && evidence.some((e) => e.promptId === i.rewrite!.promptId)
        ? i.rewrite
        : null
    const experiment =
      i.experiment?.when.trim() && i.experiment.observe.trim() ? i.experiment : null
    return [{ ...i, evidence, rewrite, ...(i.experiment !== undefined ? { experiment } : {}) }]
  })

/** Empty or partially rejected support cannot leave a generated dimension assertion. */
export const verifyDimensions = (
  dimensions: ReadonlyArray<Dimension>,
  texts: ReadonlyMap<string, string>,
  counts: EvidenceCounts,
): ReadonlyArray<Dimension> =>
  dimensions.map((d) => {
    const evidence = verifyCompleteEvidence(d.evidence, texts, counts)
    return {
      ...d,
      title: evidence.length ? d.title : d.key,
      summary: evidence.length ? d.summary : "",
      evidence,
    }
  })
