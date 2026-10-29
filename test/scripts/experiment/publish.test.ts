import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { mkdtempSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runExperiment } from "../../../scripts/experiment/execute.ts"
import { publish } from "../../../scripts/experiment/publish.ts"
import { readManifest } from "../../../scripts/experiment/render.ts"
import { ProcessFailed } from "../../../src/llm/LlmRunner.ts"
import { FontUnavailable } from "../../../src/report/fonts.ts"
import { configOf, fakeDeps, prepareAll, provenance } from "./helpers.ts"
import { respond } from "../../cli/harness.ts"

const noCjk = Effect.fail(new FontUnavailable({ reason: "no CJK font in tests" }))
const HOSTILE = `</script><img src=x onerror="alert(1)"> & 'quoted'`

/** Bilingual run: codex's generated headline is hostile markup; the "broken" model fails. */
const setup = () => {
  const root = mkdtempSync(join(tmpdir(), "pp-pub-"))
  const config = configOf({
    personas: ["curious-learner"],
    repeats: 1,
    baseline: "claude-default",
    shared: { languages: ["en", "zh-TW"], looks: ["classic", "prism"] },
    variants: [
      { id: "claude-default", engine: "claude", model: null },
      { id: "codex-default", engine: "codex", model: null },
      { id: "claude-broken", engine: "claude", model: "broken" },
    ],
  })
  const failing = new ProcessFailed({
    runner: "claude-code",
    exitCode: 1,
    detail: "x",
    stderrTail: "",
  })
  const fake = fakeDeps({
    fake: (engine, model) =>
      model === "broken"
        ? { failures: new Map(Array.from({ length: 50 }, (_, i) => [i + 1, failing])) }
        : {
            respond: (input) => {
              const out = respond!(input) as Record<string, unknown>
              return engine === "codex" && input.schemaName === "LlmProfileDraft"
                ? { ...out, headline: HOSTILE }
                : out
            },
          },
  })
  return { root, config, fake }
}

const runAndPublish = () => {
  const { root, config, fake } = setup()
  return runExperiment(
    {
      id: "exp",
      root,
      config,
      configSha256: "c",
      prepared: prepareAll(config),
      budget: 100,
      provenance,
    },
    fake.deps,
  ).pipe(
    Effect.flatMap((m) => publish(root, m, { cjkFonts: noCjk })),
    Effect.map((r) => ({ ...r, root, fake })),
  )
}

const read = (f: string) => readFileSync(f, "utf8")

describe("publish", () => {
  it.effect("renders full reports and cards per look and builds an offline, escaped index", () =>
    Effect.gen(function* () {
      const { manifest, root } = yield* runAndPublish()
      const ok = manifest.cases.find((c) => c.status === "ok")!
      for (const look of ["classic", "prism"]) {
        expect(existsSync(join(root, ok.dir, "render", look, "report.html"))).toBe(true)
        expect(existsSync(join(root, ok.dir, "render", look, "card.png"))).toBe(true)
      }
      // a card that cannot be drawn is recorded, never silently dropped
      const zh = manifest.renders[0]!.cards.find((c) => c.language === "zh-TW")!
      expect(zh.file).toBeNull()
      expect(zh.error).toMatch(/CJK/)

      const index = read(join(root, "index.html"))
      expect(statSync(join(root, "index.html")).mode & 0o777).toBe(0o600)
      expect(index).not.toContain(HOSTILE)
      expect(index).not.toContain("<img src=x")
      expect(index).toContain("&lt;/script&gt;&lt;img src=x")
      // exactly one closing tag per real script element: data cannot break out
      expect(index.match(/<\/script>/g)).toHaveLength(2)
      expect(index).not.toMatch(/https?:\/\//)
      expect(index).toMatch(/Content-Security-Policy[^>]*script-src 'sha256-/)
      // a failed candidate is shown, not hidden
      expect(index).toContain("Cannot compare: candidate has no usable profile")
      const review = read(join(root, "review.md"))
      expect(review).toContain(ok.dir)
      expect(review).toContain("claude-broken — failed")
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("--from rebuilds with zero LLM calls and keeps saved profiles and reviews", () =>
    Effect.gen(function* () {
      const { root, fake, manifest } = yield* runAndPublish()
      const ok = manifest.cases.find((c) => c.status === "ok")!
      const profileFile = join(root, ok.dir, "profile.json")
      const before = read(profileFile)
      writeFileSync(join(root, "review.md"), "my notes")
      const calls = fake.calls()

      const saved = yield* readManifest(root)
      const rebuilt = yield* publish(root, saved, { cjkFonts: noCjk, looks: ["folio"] })
      expect(fake.calls()).toBe(calls)
      expect(read(profileFile)).toBe(before)
      expect(read(join(root, "review.md"))).toBe("my notes")
      expect(new Set(rebuilt.manifest.renders.map((r) => r.look))).toEqual(new Set(["folio"]))
      expect(rebuilt.manifest.config.looks).toEqual(["classic", "prism"])
      expect(existsSync(join(root, ok.dir, "render", "folio", "report.html"))).toBe(true)
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("reports an incompatible saved profile without overwriting it", () =>
    Effect.gen(function* () {
      const { root, manifest } = yield* runAndPublish()
      const ok = manifest.cases.find((c) => c.status === "ok")!
      const profileFile = join(root, ok.dir, "profile.json")
      const future = JSON.stringify({ ...JSON.parse(read(profileFile)), schemaVersion: 999 })
      writeFileSync(profileFile, future)
      const rebuilt = yield* publish(root, yield* readManifest(root), { cjkFonts: noCjk })
      expect(rebuilt.manifest.renders[0]!.error).toMatch(/incompatible profile schemaVersion 999/)
      expect(read(profileFile)).toBe(future)
      expect(read(join(root, "index.html"))).toContain("incompatible profile schemaVersion 999")
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("marks a failed card or report render in the outcome and exit code", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-pub-"))
      const config = configOf({
        personas: ["curious-learner"],
        repeats: 1,
        baseline: "a",
        shared: { languages: ["en", "zh-TW"] },
        variants: [{ id: "a", engine: "claude", model: null }],
      })
      const m = yield* runExperiment(
        {
          id: "e",
          root,
          config,
          configSha256: "c",
          prepared: prepareAll(config),
          budget: 100,
          provenance,
        },
        fakeDeps().deps,
      )
      expect(m.outcome).toBe("passed")
      // zh-TW cards cannot be drawn without CJK fonts in this test
      const { manifest } = yield* publish(root, m, { cjkFonts: noCjk })
      expect(manifest.outcome).toBe("render-failed")
      expect(manifest.exitCode).toBe(7)
      expect(JSON.parse(read(join(root, "manifest.json"))).exitCode).toBe(7)
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect.each([
    [
      "a case folder outside the experiment",
      (c: Record<string, unknown>) => ({ ...c, dir: "../../escape" }),
    ],
    [
      "an unsafe variant id",
      (c: Record<string, unknown>) => ({
        ...c,
        variant: "../x",
        dir: "cases/curious-learner/../x/r1",
      }),
    ],
    ["a non-integer repeat", (c: Record<string, unknown>) => ({ ...c, repeat: "1/../../x" })],
  ])("refuses a saved manifest with %s", ([, tamper]) =>
    Effect.gen(function* () {
      const { root } = yield* runAndPublish()
      const file = join(root, "manifest.json")
      const saved = JSON.parse(read(file))
      saved.cases[0] = (tamper as (c: Record<string, unknown>) => unknown)(saved.cases[0])
      writeFileSync(file, JSON.stringify(saved))
      const error = yield* Effect.flip(readManifest(root))
      expect(String(error)).toMatch(/manifest/i)
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("refuses a saved manifest with an unknown look", () =>
    Effect.gen(function* () {
      const { root } = yield* runAndPublish()
      const file = join(root, "manifest.json")
      const saved = JSON.parse(read(file))
      saved.config.looks = ["../../x"]
      writeFileSync(file, JSON.stringify(saved))
      expect(String(yield* Effect.flip(readManifest(root)))).toMatch(/look/)
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("escapes saved manifest values in the rebuilt page", () =>
    Effect.gen(function* () {
      const { root } = yield* runAndPublish()
      const file = join(root, "manifest.json")
      const saved = JSON.parse(read(file))
      const evil = `<iframe src="file:///etc/passwd">`
      saved.budget.used = evil
      saved.provenance.versions.analysis = evil
      writeFileSync(file, JSON.stringify(saved))
      yield* publish(root, yield* readManifest(root), { cjkFonts: noCjk })
      const index = read(join(root, "index.html"))
      expect(index).not.toContain(evil)
      expect(index).toContain("&lt;iframe src=&quot;file:///etc/passwd&quot;&gt;")
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("refuses a manifest format it does not understand", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-pub-"))
      writeFileSync(join(root, "manifest.json"), JSON.stringify({ manifestVersion: 99 }))
      const error = yield* Effect.flip(readManifest(root))
      expect(String(error)).toMatch(/manifest version 99/)
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
