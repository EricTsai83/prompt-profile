import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { makeHarness, fixture } from "./harness.ts"

const library = (root: string) =>
  JSON.parse(readFileSync(join(root, "library.json"), "utf8")) as {
    latest: string
    runs: Array<{ id: string }>
  }
describe("report library CLI", () => {
  it.effect(
    "keeps distinct analyses and attaches renders without changing the latest analysis",
    () =>
      Effect.gen(function* () {
        const h = makeHarness()
        const out = join(h.root, "library")
        expect((yield* h.run(["--yes", "--since", "all", "--out", out])).code).toBe(0)
        const first = library(out)
        expect((yield* h.run(["--yes", "--since", "all", "--out", out])).code).toBe(0)
        const second = library(out)
        expect(second.runs).toHaveLength(2)
        const source = join(out, "reports", first.latest, "profile.json")
        const before = readFileSync(source, "utf8")
        expect((yield* h.run(["render", source, "--look", "signal"])).code).toBe(0)
        expect(readFileSync(source, "utf8")).toBe(before)
        expect((yield* h.run(["render", source])).code).toBe(0)
        expect(readFileSync(source, "utf8")).toBe(before)
        expect(
          existsSync(join(out, "reports", first.latest, "variants", "classic", "render.json")),
        ).toBe(true)
        expect(
          (yield* h.run(["render", source, "--out", join(out, "reports", first.latest)])).code,
        ).toBe(1)
        expect(library(out).latest).toBe(second.latest)
        expect(
          existsSync(join(out, "reports", first.latest, "variants", "signal", "report.html")),
        ).toBe(true)
      }),
  )
  it.effect("preserves a readable root-level report before upgrading the output root", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = h.root
      const original = readFileSync(fixture("profile.sample.json"), "utf8")
      writeFileSync(join(out, "profile.json"), original, { mode: 0o600 })
      writeFileSync(join(out, "report.html"), "legacy HTML", { mode: 0o600 })
      expect((yield* h.run(["--yes", "--since", "all", "--out", out])).code).toBe(0)
      const saved = library(out)
      expect(saved.runs).toHaveLength(2)
      expect(saved.runs.some((r) => r.id.startsWith("legacy-"))).toBe(true)
      expect(readFileSync(join(out, "profile.json"), "utf8")).toBe(original)
      expect(readFileSync(join(out, "report.html"), "utf8")).toBe("legacy HTML")
      expect((yield* h.run(["render", join(out, "profile.json")])).code).toBe(0)
      expect(readFileSync(join(out, "profile.json"), "utf8")).toBe(original)
    }),
  )
  it.effect("repairs an index without analysis and keeps relative offline navigation", () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const out = join(h.root, "library")
      yield* h.run(["--yes", "--since", "all", "--out", out])
      const before = library(out)
      const calls = h.fakes.reduce((n, f) => n + f.calls(), 0)
      writeFileSync(join(out, "library.json"), "broken")
      expect((yield* h.run(["history", "--out", out])).code).toBe(0)
      expect(library(out).latest).toBe(before.latest)
      expect(h.fakes.reduce((n, f) => n + f.calls(), 0)).toBe(calls)
      expect(readFileSync(join(out, "index.html"), "utf8")).toContain(
        `reports/${before.latest}/report.html`,
      )
    }),
  )
})

it.effect("records render-only avatar choices without changing the source analysis", () =>
  Effect.gen(function* () {
    const h = makeHarness()
    const input = fixture("profile.sample.json")
    const before = readFileSync(input, "utf8")
    const out = join(h.root, "avatar")
    const result = yield* h.run(["render", input, "--out", out, "--avatar", "explorer"])
    expect(result.code).toBe(0)
    expect(readFileSync(input, "utf8")).toBe(before)
    const manifest = JSON.parse(readFileSync(join(out, "render.json"), "utf8"))
    expect(manifest.avatar).toMatchObject({
      choice: "explorer",
      artVersion: 1,
      id: "geometric-v1-explorer-0",
    })
    expect(readFileSync(join(out, "report.html"), "utf8")).toContain(
      'data-avatar="geometric-v1-explorer-0"',
    )
    expect(h.fakes).toHaveLength(0)
  }),
)
