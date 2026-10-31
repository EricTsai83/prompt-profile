import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  stat,
  symlink,
  chmod,
  realpath,
} from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { NodeServices } from "@effect/platform-node"
import { Effect, type FileSystem, type Path } from "effect"
import { expect, it } from "vitest"
import {
  createRunStage,
  publishRun,
  scanLibrary,
  repairLibrary,
  preserveLegacy,
  protectsAnalysisDirectory,
  archivedSource,
} from "../../src/platform/library.ts"
import type { RunManifest } from "../../src/domain/Library.ts"

const run = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
  Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)))
const root = () => mkdtemp(join(tmpdir(), "profile-library-"))
const metadata = (id: string): RunManifest => ({
  version: 1,
  id,
  createdAt: "2026-10-31T00:00:00.000Z",
  window: { from: null, to: null },
  sampling: { sampled: false, prompts: 2, sessions: 2 },
  role: null,
  languages: ["en"],
  engine: { runner: "fake", model: null, analysisVersion: "20" },
  schemaVersion: 15,
  pipelineVersion: "4",
  excluded: [],
  cards: [{ language: "en", file: null, error: "font unavailable" }],
})
const fill = async (dir: string) => {
  await writeFile(join(dir, "profile.json"), "{}", { mode: 0o600 })
  await writeFile(join(dir, "report.html"), "<p>fictional</p>", { mode: 0o600 })
}
const render = (index: { latest: string | null }) => `<p>${index.latest}</p>`

it("publishes unique completed runs and records nonfatal card failures", async () => {
  const dir = await root()
  const stages = await Promise.all(Array.from({ length: 8 }, () => run(createRunStage(dir))))
  expect(new Set(stages.map((s) => s.id)).size).toBe(8)
  await Promise.all(
    stages.map(async (s) => {
      await fill(s.directory)
      await run(publishRun(dir, s, metadata(s.id), render))
    }),
  )
  const index = await run(scanLibrary(dir))
  expect(index.runs).toHaveLength(8)
  const saved = JSON.parse(await readFile(join(dir, "library.json"), "utf8"))
  expect(saved.runs).toHaveLength(8)
  expect(index.runs.every((r) => r.cards[0]?.file === null)).toBe(true)
  expect((await stat(join(dir, "reports"))).mode & 0o777).toBe(0o700)
  expect((await stat(join(dir, "library.json"))).mode & 0o777).toBe(0o600)
})

it("ignores unfinished stages and repairs a lost index without executing HTML", async () => {
  const dir = await root()
  const unfinished = await run(createRunStage(dir))
  await fill(unfinished.directory)
  expect((await run(scanLibrary(dir))).latest).toBeNull()
  const stage = await run(createRunStage(dir))
  await fill(stage.directory)
  await run(publishRun(dir, stage, metadata(stage.id), render))
  await writeFile(join(dir, "library.json"), "broken")
  const fixed = await run(repairLibrary(dir, render))
  expect(fixed.runs).toHaveLength(1)
  expect(fixed.latest).toBe(stage.id)
})

it("skips malformed manifests and symlink runs without following arbitrary files", async () => {
  const dir = await root()
  const outside = await root()
  await mkdir(join(dir, "reports"))
  const id = `20261031T000000Z-${"a".repeat(32)}`
  await symlink(outside, join(dir, "reports", id))
  await mkdir(join(dir, "reports", `20261031T000000Z-${"b".repeat(32)}`))
  await writeFile(
    join(dir, "reports", `20261031T000000Z-${"b".repeat(32)}`, "run.json"),
    JSON.stringify({ ...metadata(id), id: "../../outside" }),
  )
  const scanned = await run(scanLibrary(dir))
  expect(scanned.runs).toEqual([])
  expect(scanned.skipped).toBe(2)
})

it("retains a completed run after index publication fails, then repairs it", async () => {
  const dir = await root()
  await mkdir(join(dir, "index.html"))
  const s = await run(createRunStage(dir))
  await fill(s.directory)
  const error = await run(Effect.flip(publishRun(dir, s, metadata(s.id), render)))
  expect(error.detail).toContain("Completed report retained")
  expect((await run(scanLibrary(dir))).latest).toBe(s.id)
})

it("archives legacy artifacts once and keeps existing folders and originals unchanged", async () => {
  const dir = await root()
  await chmod(dir, 0o755)
  await fill(dir)
  await mkdir(join(dir, "variants"), { mode: 0o755 })
  await mkdir(join(dir, "variants", "old"), { mode: 0o755 })
  await writeFile(join(dir, "variants", "old", "report.html"), "legacy variant", { mode: 0o600 })
  const base = metadata(`20261031T000000Z-${"c".repeat(32)}`)
  const archived = await run(preserveLegacy(dir, base, "fallback", render))
  expect(archived).toContain("legacy-")
  expect(await readFile(join(archived!, "profile.json"), "utf8")).toBe("{}")
  expect(await readFile(join(archived!, "variants", "old", "report.html"), "utf8")).toBe(
    "legacy variant",
  )
  expect(await readFile(join(dir, "profile.json"), "utf8")).toBe("{}")
  expect((await stat(dir)).mode & 0o777).toBe(0o755)
  expect(await run(preserveLegacy(dir, base, "fallback", render))).toBe(archived)
  expect((await run(scanLibrary(dir))).runs).toHaveLength(1)
})

it("recognizes symlink aliases of archived data before allowing a render target", async () => {
  const dir = await root()
  const s = await run(createRunStage(dir))
  await fill(s.directory)
  const published = await run(publishRun(dir, s, metadata(s.id), render))
  const alias = join(dir, "alias")
  await symlink(published.directory, alias)
  expect(await run(protectsAnalysisDirectory(alias))).toBe(true)
  expect(await run(archivedSource(join(alias, "profile.json")))).toBe(
    join(await realpath(published.directory), "profile.json"),
  )
})
