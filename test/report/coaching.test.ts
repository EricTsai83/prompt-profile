import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { escapeHtml } from "../../src/report/html-template.ts"
import { renderHtml, renderShareHtml } from "../../src/report/index.ts"
import { SIGNALS, triggeredSignals } from "../../src/report/signals.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)
const sample = () => decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))
const englishOnly = (p: Profile): Profile => ({ ...p, languages: ["en"], translations: {} })

describe("prompt coaching", () => {
  it.effect("the private report shows each improvement with its before and after", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const out = renderHtml(englishOnly(p))
      const [first, second] = p.improvements
      expect(out).toContain(first!.title)
      expect(out).toContain(first!.suggestion)
      // "before" is the verified quote of the rewritten prompt; "after" is the suggestion
      expect(out).toContain(escapeHtml(first!.evidence[0]!.quote))
      expect(out).toContain(first!.rewrite!.after)
      // an improvement without a rewrite still shows its quotes
      expect(out).toContain(second!.title)
      expect(out).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;")
    }),
  )

  it.effect("signals appear only above their threshold, with their number", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      expect(triggeredSignals(p.stats).map((s) => s.id)).toEqual([
        "corrections",
        "terse",
        "reusedOpenings",
      ])
      const out = renderHtml(englishOnly(p))
      expect(out).toContain("31% of prompts are under ~4 words")
      expect(out).not.toContain("past 40 prompts")
      expect(SIGNALS.length).toBe(4)
    }),
  )

  it.effect("the share page never shows improvements, rewrites or signals", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const out = renderShareHtml(p)
      for (const i of p.improvements) {
        expect(out).not.toContain(i.title)
        if (i.rewrite) expect(out).not.toContain(i.rewrite.after)
      }
      expect(out).not.toContain("under ~4 words")
    }),
  )

  it.effect("improvements are translated; the rewrite stays as written", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const out = renderHtml(p)
      expect(out).toContain(p.translations["zh-TW"]!.improvements[0]!.title)
      expect(out.split(p.improvements[0]!.rewrite!.after).length - 1).toBe(1)
    }),
  )
})
