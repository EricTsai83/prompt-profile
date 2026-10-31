import { NodeServices } from "@effect/platform-node"
import { Effect, type FileSystem, type Path } from "effect"
import { expect, it } from "vitest"
import { mkdtemp, lstat, mkdir, symlink, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createExecution, saveExecution, listExecutions } from "../../src/platform/executions.ts"
import { makeExecutionAccounting } from "../../src/llm/accounting.ts"

const run = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
  Effect.runPromise(effect.pipe(Effect.provide(NodeServices.layer)))
const failure = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
  run(Effect.flip(effect))

it("saves private independent records, labels unfinished records as unknown, counts bad entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "pp-executions-"))
  const [a, b] = await Promise.all([run(createExecution(root, 0)), run(createExecution(root, 0))])
  const collector = makeExecutionAccounting(a.id, 10)
  await run(saveExecution(root, collector.record(20)))
  await mkdir(join(root, "executions", "bad"))
  const result = await run(listExecutions(root))
  expect(result.records).toHaveLength(2)
  expect(result.skipped).toBe(1)
  expect(result.records.find((r) => r.id === a.id)?.outcome).toBe("unknown")
  expect(a.id).not.toBe(b.id)
  expect((await lstat(join(root, "executions"))).mode & 0o777).toBe(0o700)
  expect((await lstat(a.file)).mode & 0o777).toBe(0o600)
  expect(JSON.parse(await readFile(a.file, "utf8")).outcome).toBe("running")
})

it("refuses symlink execution directories and path traversal", async () => {
  const root = await mkdtemp(join(tmpdir(), "pp-executions-"))
  const elsewhere = await mkdtemp(join(tmpdir(), "pp-executions-target-"))
  await symlink(elsewhere, join(root, "executions"))
  expect((await failure(createExecution(root, 0))).detail).toBe("Unsafe executions directory")
  expect(
    (await failure(saveExecution(root, makeExecutionAccounting("../escape", 0).record(0)))).detail,
  ).toBe("Invalid execution identity")
})

it("reads the fictional partial checkpoint and recomputes untrusted summary totals", async () => {
  const { parseExecution } = await import("../../src/domain/Execution.ts")
  const fixture = JSON.parse(await readFile("test/fixtures/execution.partial.json", "utf8"))
  fixture.summary.calls = 999
  const record = parseExecution(fixture)!
  expect(record.summary.calls).toBe(2)
  expect(record.summary.cost).toMatchObject({ state: "partial", unknownAttempts: 1, usd: 0.001 })
  expect(record.summary.wallDurationMs).toBe(800)
  expect(record.summary.callDurationMs).toBe(1100)
  expect(parseExecution({ ...fixture, version: 99 })).toBeNull()
})
