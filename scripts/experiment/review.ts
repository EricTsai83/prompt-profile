/** Free, deterministic preparation for an agent-guided experiment review. Never judges meaning. */
import { sha256 } from "../../src/analysis/hash.ts"
import { quoteMatches } from "../../src/analysis/verify.ts"
import type { Evidence } from "../../src/domain/Profile.ts"
import type { Manifest } from "./execute.ts"
import type { Loaded } from "./render.ts"

type CaseRecord = Manifest["cases"][number]
export interface ReviewInput {
  readonly experimentId: string
  readonly cases: ReadonlyArray<
    Pick<CaseRecord, "id" | "persona" | "dir" | "status"> & {
      readonly input: Pick<CaseRecord["input"], "preparedSha256" | "selectedPromptIds">
      readonly effectiveOptions: Partial<CaseRecord["effectiveOptions"]>
    }
  >
}

export const buildReviewPacket = (
  manifest: ReviewInput,
  profiles: ReadonlyMap<string, Loaded>,
  sources: ReadonlyMap<string, string> | null,
) => {
  const problems: Array<{ code: string; case: string }> = []
  const items: Array<{
    id: string
    case: string
    field: string
    claim: string
    report: string
    decision: "unreviewed"
    missingContext: ReadonlyArray<string>
    evidence: Array<{
      promptId: string
      quote: string
      sourceText: string | null
      valid: boolean | null
      selected: boolean
    }>
  }> = []
  const first = new Map<string, ReviewInput["cases"][number]>()
  for (const c of manifest.cases) {
    const base = first.get(c.persona)
    if (!base) first.set(c.persona, c)
    else {
      if (
        base.input.preparedSha256 !== c.input.preparedSha256 ||
        JSON.stringify(base.input.selectedPromptIds) !== JSON.stringify(c.input.selectedPromptIds)
      )
        problems.push({ code: "input-mismatch", case: c.id })
      if (
        ["full", "languages", "timezone"].some(
          (k) =>
            JSON.stringify(base.effectiveOptions[k as keyof typeof base.effectiveOptions]) !==
            JSON.stringify(c.effectiveOptions[k as keyof typeof c.effectiveOptions]),
        )
      )
        problems.push({ code: "analysis-options-differ", case: c.id })
    }
    if (c.status !== "ok") problems.push({ code: "execution-incomplete", case: c.id })
    const loaded = profiles.get(c.id)
    if (!loaded?.ok) {
      problems.push({ code: "profile-unavailable", case: c.id })
      continue
    }
    const p = loaded.profile,
      selected = new Set(c.input.selectedPromptIds)
    const check = (e: Evidence) => ({
      ...e,
      sourceText: sources?.get(e.promptId) ?? null,
      valid:
        sources === null
          ? null
          : sources.has(e.promptId) && quoteMatches(e.quote, sources.get(e.promptId)!),
      selected: selected.has(e.promptId),
    })
    // Check all citation locations, including episodes and collaboration, not only review cards.
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== "object") return
      const o = value as Record<string, unknown>
      if (typeof o.promptId === "string" && typeof o.quote === "string") {
        const e = check({ promptId: o.promptId, quote: o.quote })
        if (e.valid === false) problems.push({ code: "quote-mismatch", case: c.id })
        if (!e.selected) problems.push({ code: "unselected-citation", case: c.id })
      }
      for (const v of Object.values(o)) if (typeof v === "object") visit(v)
    }
    visit(p)
    const add = (field: string, claim: string, evidence: ReadonlyArray<Evidence>) =>
      items.push({
        id: sha256(manifest.experimentId, c.id, c.input.preparedSha256, field, claim).slice(0, 20),
        case: c.id,
        field,
        claim,
        report: `${c.dir}/profile.json`,
        decision: "unreviewed",
        missingContext: ["image-contents", "assistant-actions", "owner-intent"],
        evidence: evidence.map(check),
      })
    p.improvements.forEach((i, n) =>
      add(
        `improvements[${n}]`,
        [i.title, i.pattern, i.impact, i.suggestion, i.experiment?.when, i.experiment?.observe]
          .filter(Boolean)
          .join("\n"),
        i.evidence,
      ),
    )
    p.traits.forEach((t, n) => add(`traits[${n}]`, `${t.name}\n${t.description}`, t.evidence))
    p.portrait?.chapters.forEach((chapter, n) =>
      add(`portrait.chapters[${n}]`, `${chapter.title}\n${chapter.body}`, chapter.evidence),
    )
    p.dimensions.forEach((d, n) => add(`dimensions[${n}]`, `${d.title}\n${d.summary}`, d.evidence))
    add("headline", p.headline, [])
  }
  return {
    version: 1,
    experimentId: manifest.experimentId,
    mechanical: {
      problems,
      sourceVerification: sources === null ? ("unavailable" as const) : ("checked" as const),
    },
    modelComparisonReady: problems.length === 0 && sources !== null,
    semanticStatus: "needs-review" as const,
    limits: [
      "Quote authenticity is not semantic support.",
      "Model agreement is not truth.",
      "Browser layout and card fit require separate visual inspection.",
      "A few repetitions do not establish a model ranking.",
    ],
    items,
  }
}
