import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { mkdtempSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { LOOK_IDS, renderShareHtml, writeReport } from "../../src/report/index.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)
const sample = () => decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))

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

describe("share page", () => {
  it.effect("never contains quotes, project names or exact dates, in any look", () =>
    Effect.gen(function* () {
      const p = mentioning(yield* sample())
      for (const look of LOOK_IDS) {
        const out = renderShareHtml(p, { look, cardHide: [] })
        for (const f of forbidden(p))
          expect({ look, leaked: out.includes(f) }).toEqual({ look, leaked: false })
        expect(out).not.toMatch(/\d{4}-\d{2}-\d{2}/)
        expect(out).not.toContain("<blockquote")
        expect(out).not.toContain('class="cal"')
        expect(out).toContain("Project A")
        expect(out).toContain("專案 A")
        expect(out).toContain("Builds Project A at midnight")
      }
    }),
  )

  it.effect("keeps identity, signature, rhythm and chapters", () =>
    Effect.gen(function* () {
      const out = renderShareHtml(yield* sample())
      for (const part of ['class="hero"', 'class="sigs"', 'class="heat"', 'class="chapters"'])
        expect(out).toContain(part)
      expect(out).not.toContain("How this was measured")
    }),
  )

  it.effect("writeReport writes share.html privately next to the report", () =>
    Effect.gen(function* () {
      const dir = join(mkdtempSync(join(tmpdir(), "pp-share-")), "out")
      const files = yield* writeReport(yield* sample(), dir)
      expect(files.share).toBe(join(dir, "share.html"))
      expect(statSync(files.share).mode & 0o777).toBe(0o600)
      expect(readFileSync(files.share, "utf8")).toContain("Project A")
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
