import { it, expect } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync } from "node:fs"
import { decodeProfile } from "../../src/domain/Profile.ts"
import { renderHtml } from "../../src/report/html.ts"

it.effect("renders one optional experiment, subordinate alternatives and inert copy text", () =>
  Effect.gen(function* () {
    const base = yield* decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    )
    const p = {
      ...base,
      languages: ["en"] as const,
      translations: {},
      improvements: base.improvements.map((i) => ({
        ...i,
        experiment: {
          when: "When adding a test",
          observe: "Check whether a follow-up clarifies the expected result.",
        },
        rewrite: i.rewrite ? { ...i.rewrite, after: "</textarea><script>bad()</script>" } : null,
      })),
    }
    const out = renderHtml(p)
    expect(out).toContain("When to try")
    expect(out).toContain("What to observe next time")
    expect(out).toContain("readonly")
    expect(out).not.toContain("<script>bad()")
    expect(out).toContain("&lt;/textarea&gt;&lt;script&gt;bad()&lt;/script&gt;")
    expect(out).toContain('class="experiment-alternatives"')
    expect(renderHtml(p, { look: "classic", cardHide: [], exclude: ["coaching"] })).not.toContain(
      "When adding a test",
    )
    expect(renderHtml(p, { look: "classic", cardHide: [], exclude: ["quotes"] })).not.toContain(
      "bad()",
    )
  }),
)

it.effect("preserves an empty experiment state and translates the bounded contract", () =>
  Effect.gen(function* () {
    const p = yield* decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    )
    const empty = renderHtml({ ...p, improvements: [], translations: {}, languages: ["en"] })
    expect(empty).toContain("No supported experiment is offered")
    expect(empty).not.toContain('id="experiment-copy-0"')
    const i = p.improvements[0]!
    const t = p.translations["zh-TW"]!
    const bilingual = {
      ...p,
      improvements: [{ ...i, experiment: { when: "Next test", observe: "Inspect a correction" } }],
      translations: {
        "zh-TW": {
          ...t,
          improvements: [
            {
              ...t.improvements[0]!,
              experiment: { when: "下次新增測試時", observe: "看看是否還需要補充預期結果" },
            },
          ],
        },
      },
    }
    const out = renderHtml(bilingual)
    expect(out).toContain("下次新增測試時")
    expect(out).toContain("看看是否還需要補充預期結果")
    expect(out).toContain("效果尚未驗證")
  }),
)
