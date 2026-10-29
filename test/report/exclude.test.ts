import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { escapeHtml } from "../../src/report/html-template.ts"
import {
  LOOK_IDS,
  REPORT_PARTS,
  renderHtml,
  reportContents,
  writeReport,
  type LookId,
  type ReportPart,
} from "../../src/report/index.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)
const sample = () => decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))
const without = (p: Profile, exclude: ReadonlyArray<ReportPart>, look: LookId = "classic") =>
  renderHtml(p, { look, cardHide: [], exclude })
/** As they appear in the HTML. */
const quotesOf = (p: Profile) =>
  [
    ...[...p.traits, ...p.dimensions, ...p.improvements].flatMap((x) =>
      x.evidence.map((e) => e.quote),
    ),
    ...p.improvements.flatMap((i) => (i.rewrite ? [i.rewrite.after] : [])),
  ].map(escapeHtml)

/** A profile whose generated text mentions a project by name, as models sometimes do. */
const mentioning = (p: Profile): Profile => ({
  ...p,
  headline: "Builds drawstuff at midnight",
  translations: {
    "zh-TW": { ...p.translations["zh-TW"]!, headline: "半夜在做 drawstuff" },
  },
})

const forbidden = (p: Profile) => [
  ...[...p.traits, ...p.dimensions, ...p.improvements].flatMap((x) =>
    x.evidence.map((e) => e.quote),
  ),
  ...p.improvements.flatMap((i) => (i.rewrite ? [i.rewrite.after] : [])),
  ...p.stats.activity.projects.filter((n) => n !== "prompt-profile"),
  ...p.stats.topProjects.map((x) => x.name).filter((n) => n !== "prompt-profile"),
]

describe("--exclude", () => {
  it.effect("personal leaves out quotes, project names and exact dates, in any look", () =>
    Effect.gen(function* () {
      const p = mentioning(yield* sample())
      for (const look of LOOK_IDS) {
        const out = without(p, REPORT_PARTS, look)
        for (const f of forbidden(p))
          expect({ look, leaked: out.includes(f) }).toEqual({ look, leaked: false })
        expect(out).not.toMatch(/\d{4}-\d{2}-\d{2}/)
        expect(out).not.toContain("<blockquote")
        expect(out).not.toContain('class="cal"')
        expect(out).not.toContain('class="coaching"')
        expect(out).toContain("Project A")
        expect(out).toContain("專案 A")
        expect(out).toContain("Builds Project A at midnight")
      }
    }),
  )

  it.effect("by default everything is shown", () =>
    Effect.gen(function* () {
      const p = mentioning(yield* sample())
      const out = renderHtml(p)
      for (const q of quotesOf(p)) expect(out).toContain(q)
      expect(out).toContain("Builds drawstuff at midnight")
      for (const part of ['class="cal"', 'class="coaching"', "How this was measured"])
        expect(out).toContain(part)
    }),
  )

  it.effect("quotes: no quotes or rewrites, everything else kept", () =>
    Effect.gen(function* () {
      const p = mentioning(yield* sample())
      const out = without(p, ["quotes"])
      for (const q of quotesOf(p))
        expect({ q, shown: out.includes(q) }).toEqual({ q, shown: false })
      expect(out).not.toContain("<blockquote")
      expect(out).toContain("Builds drawstuff at midnight")
      expect(out).toContain('class="coaching"')
      expect(out).toContain(p.improvements[0]!.title)
    }),
  )

  it.effect("projects: names are replaced in quotes, rewrites and skills too", () =>
    Effect.gen(function* () {
      const base = mentioning(yield* sample())
      const t = base.stats.techniques!
      const p: Profile = {
        ...base,
        traits: base.traits.map((x, i) =>
          i === 0
            ? { ...x, evidence: x.evidence.map((e) => ({ ...e, quote: `fix drawstuff login` })) }
            : x,
        ),
        improvements: base.improvements.map((x) =>
          x.rewrite ? { ...x, rewrite: { ...x.rewrite, after: "In drawstuff, add a test" } } : x,
        ),
        stats: {
          ...base.stats,
          techniques: {
            ...t,
            details: {
              ...t.details,
              skills: t.details.skills.map((x, i) =>
                i === 0 ? { ...x, description: "Ships drawstuff releases" } : x,
              ),
            },
          },
        },
      }
      const out = without(p, ["projects"])
      expect(out.toLowerCase()).not.toContain("drawstuff")
      expect(out).toContain("fix Project A login")
      expect(out).toContain("In Project A, add a test")
      expect(out).toContain("Ships Project A releases")
      expect(renderHtml(p)).toContain("fix drawstuff login")
    }),
  )

  it.effect("projects: names replaced everywhere, quotes kept", () =>
    Effect.gen(function* () {
      const p = mentioning(yield* sample())
      const out = without(p, ["projects"])
      for (const f of forbidden(p).filter((x) => !quotesOf(p).includes(escapeHtml(x))))
        expect({ f, shown: out.includes(f) }).toEqual({ f, shown: false })
      expect(out).toContain("Builds Project A at midnight")
      expect(out).toContain("<blockquote")
    }),
  )

  it.effect("dates: no calendar, the data period by month", () =>
    Effect.gen(function* () {
      const out = without(yield* sample(), ["dates"])
      expect(out).not.toContain('class="cal"')
      expect(out).toContain("Apr 2026 – Oct 2026 · 6 months")
      expect(out).toContain("2026年4月 – 2026年10月 · 6 個月")
      expect(out).not.toContain("Apr 25, 2026")
      // the generation time is shown by month too, in the header and under How this was measured
      expect(out).not.toContain("Oct 24, 2026")
      expect(out).not.toContain("2026年10月24日")
      expect(out).toContain("<blockquote")
    }),
  )

  it.effect("coaching and funfacts each remove only their section", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const noCoaching = without(p, ["coaching"])
      expect(noCoaching).not.toContain('class="coaching"')
      expect(noCoaching).toContain(p.funFacts[0]!)
      const noFacts = without(p, ["funfacts"])
      expect(noFacts).not.toContain(p.funFacts[0]!)
      expect(noFacts).toContain('class="coaching"')
    }),
  )

  it.effect("the parts left out are listed under How this was measured", () =>
    Effect.gen(function* () {
      const out = without(yield* sample(), ["quotes", "dates"])
      expect(out).toContain("Left out: quotes, dates")
      expect(renderHtml(yield* sample())).not.toContain("Left out:")
    }),
  )

  it.effect("writeReport writes one report and removes an old share page", () =>
    Effect.gen(function* () {
      const dir = mkdtempSync(join(tmpdir(), "pp-one-"))
      writeFileSync(join(dir, "share.html"), "old")
      yield* writeReport(yield* sample(), dir)
      expect(existsSync(join(dir, "report.html"))).toBe(true)
      expect(existsSync(join(dir, "share.html"))).toBe(false)
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("reportContents counts what the report shows", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      expect(reportContents(p, { look: "classic", cardHide: [] })).toEqual({
        quotes: 22,
        projects: 3,
        exactDates: true,
        improvements: 2,
        funFacts: 2,
        usage: true,
      })
      expect(reportContents(p, { look: "classic", cardHide: [], exclude: ["coaching"] })).toEqual({
        quotes: 20,
        projects: 3,
        exactDates: true,
        improvements: 0,
        funFacts: 2,
        usage: true,
      })
      expect(reportContents(p, { look: "classic", cardHide: [], exclude: REPORT_PARTS })).toEqual({
        quotes: 0,
        projects: 0,
        exactDates: false,
        improvements: 0,
        funFacts: 0,
        usage: false,
      })
    }),
  )
})
