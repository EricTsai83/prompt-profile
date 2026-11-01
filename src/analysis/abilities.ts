import {
  ABILITY_KEYS,
  MIN_PROJECT_CONVERSATIONS,
  type Ability,
  type Evidence,
  type LlmProfileDraft,
} from "../domain/index.ts"
import { verifyEvidence, type EvidenceCounts, type PromptOrigin } from "./verify.ts"

export interface AbilitySources {
  readonly texts: ReadonlyMap<string, string>
  readonly origins: ReadonlyMap<string, PromptOrigin>
  readonly projectOf: ReadonlyMap<string, string | null>
  readonly projects: ReadonlyMap<string, number>
}
export const abilityCap = (s: { sessions: number; weeks: number }): number =>
  s.sessions >= 3 && s.weeks >= 2 ? 100 : s.sessions >= 2 ? 85 : 60

export const projectConversations = (
  prompts: ReadonlyArray<{ source: string; sessionId: string; project: string | null }>,
): ReadonlyMap<string, number> => {
  const groups = new Map<string, Set<string>>()
  for (const p of prompts)
    if (p.project)
      groups.set(p.project, (groups.get(p.project) ?? new Set()).add(`${p.source}:${p.sessionId}`))
  return new Map(
    [...groups].filter(([, s]) => s.size >= MIN_PROJECT_CONVERSATIONS).map(([p, s]) => [p, s.size]),
  )
}

/** Bare waivers/closeout commands do not demonstrate result verification. */
const VERIFICATION_WAIVERS: ReadonlyArray<RegExp> = [
  /^(?:當作|視為|算作|當成)(?:全數|全部)(?:都)?通過吧?[，,。.]?(?:幫我做(?:這個)?(?:plan|計畫|計劃)的?(?:收尾|結案)[。.]?)?$/i,
  /^(?:assume|treat)(?:all)?(?:tests|checks)(?:as)?passed[,!.]?(?:(?:please)?(?:closetheplan|wrapitup)[.!]?)?$/i,
]
const isBareWaiver = (quote: string) =>
  VERIFICATION_WAIVERS.some((p) => p.test(quote.replace(/\s/g, "")))

export const verifyAbilities = (
  drafts: LlmProfileDraft["abilities"],
  sources: AbilitySources,
  counts: EvidenceCounts,
): ReadonlyArray<Ability> => {
  const checked = (
    draft: { score: number | null; evidence: ReadonlyArray<Evidence> } | undefined,
    project?: string,
    verification = false,
  ) => {
    const texts =
      project === undefined
        ? sources.texts
        : new Map([...sources.texts].filter(([id]) => sources.projectOf.get(id) === project))
    const checkedEvidence = verifyEvidence(draft?.evidence ?? [], texts, counts)
    const evidence = verification
      ? checkedEvidence.filter((e) => !isBareWaiver(e.quote))
      : checkedEvidence
    counts.kept -= checkedEvidence.length - evidence.length
    counts.dropped += checkedEvidence.length - evidence.length
    const origins = evidence.flatMap((e) => sources.origins.get(e.promptId) ?? [])
    const support = {
      sessions: new Set(origins.map((o) => o.session)).size,
      weeks: new Set(origins.map((o) => o.week)).size,
    }
    const score =
      !evidence.length || !origins.length || draft?.score == null || !Number.isFinite(draft.score)
        ? null
        : Math.min(abilityCap(support), Math.max(0, Math.min(100, Math.round(draft.score / 5) * 5)))
    return { score, evidence, support }
  }
  return ABILITY_KEYS.map((key) => {
    const draft = drafts.find((d) => d.key === key)
    return {
      key,
      ...checked(draft, undefined, key === "verification"),
      byProject: [...sources.projects].map(([project, analysedSessions]) => ({
        project,
        analysedSessions,
        ...checked(
          draft?.byProject.find((p) => p.project === project),
          project,
          key === "verification",
        ),
      })),
    }
  })
}
