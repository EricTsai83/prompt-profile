import { describe, expect, it } from "@effect/vitest"
import { DateTime, Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import type { SourceUsage } from "../../src/domain/Usage.ts"
import { LOOK_IDS, renderHtml } from "../../src/report/index.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)
const sample = () => decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))

/** The usage section's HTML, and the overview page's (which must never show usage). */
const parts = (p: Profile, exclude: ReadonlyArray<"usage"> = []) => {
  const page = renderHtml(p, { look: "classic", cardHide: [], exclude })
  const usage = /<section class="usage">[\s\S]*?<\/section>\s*<section class="about">/.exec(page)
  const overview = page.slice(page.indexOf('id="overview"'), page.indexOf('id="detail"'))
  return { page, usage: usage?.[0] ?? null, overview }
}

const withSources = (p: Profile, f: (s: SourceUsage) => SourceUsage): Profile => ({
  ...p,
  usage: { ...p.usage!, sources: p.usage!.sources.map(f) },
})

const empty = (s: SourceUsage): SourceUsage => ({
  ...s,
  totals: {
    requests: 0,
    tokens: {
      ...s.totals.tokens,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite5m: 0,
      cacheWrite1h: 0,
      reasoning: 0,
    },
    cost: null,
    unpricedRequests: 0,
    fastRequests: 0,
  },
  byMonth: [],
  byModel: [],
  unpricedModels: [],
})

describe("usage in the report (plan 23)", () => {
  it.effect(
    "both tools side by side: plan, tokens and API list-price equivalent, in each language",
    () =>
      Effect.gen(function* () {
        const { usage, overview } = parts(yield* sample())
        expect(usage).not.toBeNull()
        for (const text of [
          "Claude Code",
          "Codex",
          "max",
          "plus",
          "$829.03",
          "API list-price equivalent",
          "API 牌價等值",
          "not what was paid",
          "price table 2026-10-29",
          "Share between the tools",
          "2026-10",
          "claude-opus-5-5",
        ])
          expect({ text, shown: usage!.includes(text) }).toEqual({ text, shown: true })
        // the identity side: never an amount or a plan
        expect(overview).not.toContain('class="usage"')
        expect(overview).not.toContain("$829")
      }),
  )

  it.effect(
    "a model without a list price: its tokens shown, its cost unknown, never borrowed",
    () =>
      Effect.gen(function* () {
        const { usage } = parts(yield* sample())
        expect(usage).toContain("No list price for codex-auto-review")
        expect(usage).toContain("+ 90 unpriced responses")
        expect(usage).toMatch(/codex-auto-review<\/th>[\s\S]*?Unknown \(no list price\)/)
      }),
  )

  it.effect("the period shown is the usage's own, not the prompts'", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const { usage } = parts({
        ...p,
        usage: {
          ...p.usage!,
          range: {
            from: DateTime.makeUnsafe("2026-05-03T02:00:00Z"),
            to: DateTime.makeUnsafe("2026-10-23T15:00:00Z"),
          },
        },
      })
      // the prompts run Apr 25 – Oct 23 (Taipei); the usage May 3 – Oct 23
      expect(usage).toContain("May 3, 2026 – Oct 23, 2026")
      expect(usage).not.toContain("Apr 25, 2026")
    }),
  )

  it.effect("fast-mode responses are named, with the rates they were priced at", () =>
    Effect.gen(function* () {
      const { usage } = parts(yield* sample())
      expect(usage).toMatch(/[\d,]+ responses ran in fast mode \(Codex priority\)/)
      expect(usage).toContain("以快速模式牌價計算")
    }),
  )

  it.effect("wide tables scroll in keyboard-reachable, labelled regions", () =>
    Effect.gen(function* () {
      const { usage } = parts(yield* sample())
      const regions = [...usage!.matchAll(/<div\s+class="usage-scroll"([^>]*)>/g)].map((m) => m[1]!)
      expect(regions).toHaveLength(2)
      for (const attrs of regions) {
        expect(attrs).toContain('tabindex="0"')
        expect(attrs).toContain('role="region"')
        expect(attrs).toMatch(/aria-label="By (month|model)"/)
      }
    }),
  )

  it.effect("unknown plan and an API-key login are stated as such", () =>
    Effect.gen(function* () {
      const p = withSources(yield* sample(), (s) => ({
        ...s,
        plan:
          s.source === "codex"
            ? { kind: "api-key", name: null, detail: null }
            : { kind: "unknown", name: null, detail: null },
      }))
      const { usage } = parts(p)
      expect(usage).toContain("Unknown (the tool did not report it)")
      expect(usage).toContain("未知（工具未回報）")
      expect(usage).toContain("API key login")
    }),
  )

  it.effect("unreadable logs are told apart from unknown prices", () =>
    Effect.gen(function* () {
      const p = withSources(yield* sample(), (s) =>
        s.source === "codex"
          ? { ...s, diagnostics: { ...s.diagnostics, unreadableFiles: 2, badLines: 0 } }
          : { ...s, diagnostics: { ...s.diagnostics, badLines: 0 } },
      )
      const { usage } = parts(p)
      expect(usage).toContain("2 log files could not be read: totals may be lower")
      expect(usage).not.toContain("0 log files")
    }),
  )

  it.effect("a single tool: the other says it has no responses; no share between tools", () =>
    Effect.gen(function* () {
      const p = withSources(yield* sample(), (s) => (s.source === "codex" ? empty(s) : s))
      const { usage } = parts(p)
      expect(usage).toContain("No model responses found in this period.")
      expect(usage).not.toContain("Share between the tools")
      expect(usage).toContain("$829.03")
    }),
  )

  it.effect("no usage at all has its own message", () =>
    Effect.gen(function* () {
      const { usage } = parts(withSources(yield* sample(), empty))
      expect(usage).toContain("No model responses were found in the local logs for this period.")
      expect(usage).not.toContain("By month")
    }),
  )

  it.effect("a legacy profile is 'not measured', which is not zero", () =>
    Effect.gen(function* () {
      const { usage } = parts({ ...(yield* sample()), usage: null })
      expect(usage).toContain("Not measured")
      expect(usage).toContain("未測量")
      expect(usage).not.toContain("$")
    }),
  )

  it.effect("--exclude usage removes it in every look", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      for (const look of LOOK_IDS) {
        const page = renderHtml(p, { look, cardHide: [], exclude: ["usage"] })
        expect({ look, shown: page.includes('class="usage"') }).toEqual({ look, shown: false })
        expect(page).not.toContain("$829")
        expect(page).not.toContain("default_claude_max_5x")
      }
    }),
  )
})
