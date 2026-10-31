import { randomUUID } from "node:crypto"
import { Effect, FileSystem, Path } from "effect"
import {
  parseExecution,
  summarizeExecution,
  EXECUTION_VERSION,
  type ExecutionRecord,
} from "../domain/index.ts"
import { FileError, isNotFound, toFileError, writePrivateFile } from "./files.ts"

const ID = /^[0-9a-f-]{36}$/u

/** `<root>/executions`, never a symlink. */
const directory = (root: string, create: boolean) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const folder = (yield* Path.Path).join(root, "executions")
    if (create) {
      yield* fs.makeDirectory(root, { recursive: true, mode: 0o700 })
      yield* fs.makeDirectory(folder, { mode: 0o700 }).pipe(
        Effect.catchIf(
          (e) => e.reason._tag === "AlreadyExists",
          () => Effect.void,
        ),
      )
    }
    if ((yield* fs.lstat(folder)).type !== "Directory")
      return yield* new FileError({ path: folder, detail: "Unsafe executions directory" })
    return folder
  })

const recordDirectory = (root: string, id: string) =>
  Effect.gen(function* () {
    if (!ID.test(id))
      return yield* new FileError({ path: root, detail: "Invalid execution identity" })
    const folder = (yield* Path.Path).join(yield* directory(root, false), id)
    if ((yield* (yield* FileSystem.FileSystem).lstat(folder)).type !== "Directory")
      return yield* new FileError({ path: folder, detail: "Unsafe execution directory" })
    return folder
  })

/** Replace an execution's `summary.json` (written privately and atomically). */
export const saveExecution = (root: string, record: ExecutionRecord) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const folder = yield* recordDirectory(root, record.id)
    yield* writePrivateFile(
      fs,
      path,
      path.join(folder, "summary.json"),
      `${JSON.stringify(record, null, 2)}\n`,
    )
  }).pipe(Effect.mapError(toFileError(root)))

/** Start a new execution record ("running") and return its identity and summary file. */
export const createExecution = (root: string, startedAtMs: number) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const folder = yield* directory(root, true)
    const id = randomUUID()
    yield* fs.makeDirectory(path.join(folder, id), { mode: 0o700 })
    const initial: ExecutionRecord = {
      version: EXECUTION_VERSION,
      id,
      operation: "analyze",
      stopReason: null,
      engine: null,
      requestedModel: null,
      limits: { maxCalls: null, maxCostUsd: null },
      accountingFinishedAtMs: null,
      startedAtMs,
      finishedAtMs: null,
      outcome: "running",
      reportId: null,
      analysis: "pending",
      languages: [],
      artifacts: [],
      attempts: [],
      summary: summarizeExecution([], 0, startedAtMs, startedAtMs),
    }
    yield* saveExecution(root, initial)
    return { id, file: path.join(folder, id, "summary.json") }
  }).pipe(Effect.mapError(toFileError(root)))

const readRecord = (root: string, id: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const file = (yield* Path.Path).join(yield* recordDirectory(root, id), "summary.json")
    const info = yield* fs.lstat(file)
    if (info.type !== "File" || info.size > 10_000_000n) return null
    const text = yield* fs.readFileString(file)
    const record = parseExecution(yield* Effect.try(() => JSON.parse(text) as unknown))
    return record && record.id === id ? record : null
  }).pipe(Effect.orElseSucceed(() => null))

/** Unfinished checkpoints cannot establish whether a process is still alive. Never mark them successful. */
export const listExecutions = (root: string) =>
  Effect.gen(function* () {
    const records: ExecutionRecord[] = []
    let skipped = 0
    const folder = yield* directory(root, false).pipe(
      Effect.catchIf(isNotFound, () => Effect.succeed(null)),
    )
    if (folder === null) return { records, skipped }
    for (const id of yield* (yield* FileSystem.FileSystem).readDirectory(folder)) {
      const record = yield* readRecord(root, id)
      if (record === null) skipped++
      else records.push(record.outcome === "running" ? { ...record, outcome: "unknown" } : record)
    }
    return {
      records: records.toSorted(
        (a, b) => b.startedAtMs - a.startedAtMs || a.id.localeCompare(b.id),
      ),
      skipped,
    }
  }).pipe(Effect.mapError(toFileError(root)))
