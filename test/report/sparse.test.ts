import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { cardTree } from "../../src/report/card.ts"
import {
  DEFAULT_RENDER_OPTIONS,
  isLimitedEvidence,
  LOOK_IDS,
  reportContents,
} from "../../src/report/index.ts"
import { renderHtml } from "../../src/report/html.ts"

/*
 * Sparse histories (plan 24): when nothing in the profile has verified support from two or
 * more sessions, the report keeps its observations and measurements and states its limits;
 * a role name and prompt coaching are not presented.
 */

const sample = (): Promise<Profile> =>
  Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )

const portrait = () =>
  JSON.parse(readFileSync(new URL("../fixtures/portrait.sample.json", import.meta.url), "utf8"))

/** Every trait from one session (low confidence) and no portrait: a fictional one-session run. */
const sparse = async (): Promise<Profile> => {
  const p = await sample()
  return {
    ...p,
    portrait: null,
    traits: p.traits.map((t) => ({
      ...t,
      confidence: "low" as const,
      support: { sessions: 1, weeks: 1 },
    })),
    coverage: { ...p.coverage, promptsAnalyzed: 3, sessionsAnalyzed: 1, chunksTotal: 1 },
  }
}

const texts = (node: unknown): Array<string> => {
  if (typeof node === "string") return [node]
  if (Array.isArray(node)) return node.flatMap(texts)
  if (node && typeof node === "object" && "props" in node)
    return texts((node as { props: { children?: unknown } }).props.children)
  return []
}

describe("limited evidence", () => {
  it("is decided by verified multi-session support, not by a prompt count", async () => {
    const full = await sample()
    expect(isLimitedEvidence(full)).toBe(false)
    expect(isLimitedEvidence(await sparse())).toBe(true)
    // a large history with only low-confidence traits is limited too
    const many = await sparse()
    expect(
      isLimitedEvidence({ ...many, coverage: { ...many.coverage, sessionsAnalyzed: 400 } }),
    ).toBe(true)
    // the model may state "low" even when quotes come from two sessions: that is support
    const lowButSpread = await sparse()
    expect(
      isLimitedEvidence({
        ...lowButSpread,
        traits: lowButSpread.traits.map((t, i) =>
          i === 0
            ? { ...t, support: { sessions: 2, weeks: 1 } }
            : { ...t, support: { sessions: 1, weeks: 1 } },
        ),
      }),
    ).toBe(false)
    // a legacy trait without support falls back to its confidence
    expect(
      isLimitedEvidence({
        ...lowButSpread,
        traits: lowButSpread.traits.map((t) => ({ ...t, support: null })),
      }),
    ).toBe(true)
    // a resolved preference axis (two sessions, no counter-evidence) is support
    const withPortrait = { ...(await sparse()), portrait: portrait() }
    expect(withPortrait.portrait.axes.some((a: { pole: string }) => a.pole !== "unclear")).toBe(
      true,
    )
    expect(isLimitedEvidence(withPortrait)).toBe(false)
  })

  it("the report states its limits in both languages and keeps observations", async () => {
    const page = renderHtml(await sparse())
    expect(page).toContain("Early observations")
    expect(page).toContain("初步觀察")
    expect(page).toMatch(/3 prompts in 1 session/)
    // the analyzed line is singular too
    expect(page).toMatch(/3 prompts · 1 session(?!s)/)
    expect(page).toContain("3 則提示、1 段對話")
    expect(page).toContain("--since")
    // no generated role: neither the archetype nor its headline
    expect(page).not.toContain("The Midnight Architect")
    expect(page).not.toContain("午夜架構師")
    expect(page).not.toContain("argues with AI about naming")
    // no coaching
    expect(page).not.toContain('class="coaching"')
    expect(page).not.toContain('class="improves"')
    // observations, measurements and the method stay
    expect(page).toContain('class="dims"')
    expect(page).toContain('class="sigs"')
    expect(page).toContain('class="about"')
    expect(page).toContain("Plan first")
  })

  it("the CLI's contents summary counts no suggestions or their quotes", async () => {
    const p = await sparse()
    const full = reportContents(await sample(), DEFAULT_RENDER_OPTIONS)
    const limited = reportContents(p, DEFAULT_RENDER_OPTIONS)
    expect(full.improvements).toBeGreaterThan(0)
    expect(limited.improvements).toBe(0)
    const suggestionQuotes = p.improvements.reduce((n, i) => n + i.evidence.length, 0)
    expect(limited.quotes).toBe(full.quotes - suggestionQuotes)
  })

  it("a supported profile is unchanged", async () => {
    const page = renderHtml(await sample())
    expect(page).not.toContain("Early observations")
    expect(page).toContain("The Midnight Architect")
    expect(page).toContain('class="coaching"')
  })

  it.each(LOOK_IDS)(
    "the %s card shows the limits instead of a role or trait chips",
    async (look) => {
      const p = await sparse()
      for (const lang of ["en", "zh-TW"] as const) {
        const card = texts(cardTree(p, { look, cardHide: [], exclude: [] }, lang)).join("\n")
        expect(card).toContain(lang === "en" ? "Early observations" : "初步觀察")
        expect(card).not.toContain(lang === "en" ? "The Midnight Architect" : "午夜架構師")
        expect(card).not.toContain(lang === "en" ? "Plan first" : "先規劃")
      }
    },
  )
})
