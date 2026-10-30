import type { NarrativePlan } from "../domain/Narrative.ts"
import type { Portrait } from "../domain/Profile.ts"
import type { Episode, Pattern } from "../domain/Episode.ts"
import { truncateQuote } from "../domain/llm/LlmSchemas.ts"
import { verifyCompleteEvidence } from "./verify.ts"

/** Validate an outline as a whole: rejected support cannot leave narrative transitions behind. */
export const verifyNarrative = (
  plan: NarrativePlan | null | undefined,
  portrait: Portrait | null | undefined,
  episodes: ReadonlyArray<Episode>,
  patterns: ReadonlyArray<Pattern>,
  texts: ReadonlyMap<string, string>,
): NarrativePlan | null => {
  if (
    !plan ||
    !portrait ||
    plan.chapters.length !== portrait.chapters.length ||
    !plan.chapters.length
  )
    return null
  if (
    plan.representativeEpisodeId !== null &&
    !episodes.some((e) => e.id === plan.representativeEpisodeId)
  )
    return null
  const claim = (c: NarrativePlan["thread"]) => {
    const counts = { kept: 0, dropped: 0 }
    const evidence = verifyCompleteEvidence(
      c.evidence.map((e) => ({ ...e, quote: truncateQuote(e.quote) })),
      texts,
      counts,
    )
    return c.text.trim() && evidence.length ? { ...c, evidence } : null
  }
  const thread = claim(plan.thread),
    nuance = claim(plan.nuance),
    closing = claim(plan.closing)
  if (!thread || !nuance || !closing) return null
  const chapterIds = new Set(portrait.chapters.flatMap((c) => c.evidence.map((e) => e.promptId)))
  if (![thread, nuance, closing].every((c) => c.evidence.every((e) => chapterIds.has(e.promptId))))
    return null
  if (
    portrait.introduction.trim() !== thread.text.trim() ||
    !portrait.chapters.at(-1)!.body.trimEnd().endsWith(closing.text.trim()) ||
    !portrait.chapters.some((c) => c.body.includes(nuance.text))
  )
    return null
  const chapters = []
  for (const [i, chapter] of plan.chapters.entries()) {
    const prose = portrait.chapters[i]!
    const focus = claim(chapter.focus)
    if (
      !focus ||
      !prose.body.includes(focus.text) ||
      chapter.title !== prose.title ||
      !chapter.episodeIds.every((id) => episodes.some((e) => e.id === id)) ||
      !chapter.patternClaims.every((text) => patterns.some((p) => p.claim === text)) ||
      !prose.evidence.length ||
      !prose.evidence.every((e) => focus.evidence.some((f) => f.promptId === e.promptId))
    )
      return null
    chapters.push({ ...chapter, focus })
  }
  return { ...plan, thread, nuance, closing, chapters }
}
