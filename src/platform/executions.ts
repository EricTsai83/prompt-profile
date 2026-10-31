import { randomUUID } from "node:crypto"
import { mkdir, lstat, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import {
  parseExecution,
  summarizeExecution,
  EXECUTION_VERSION,
  type ExecutionRecord,
} from "../domain/Execution.ts"
import { writeLibraryFile } from "./library.ts"

const ID = /^[0-9a-f-]{36}$/u
const directory = async (root: string, create: boolean) => {
  if (create) await mkdir(root, { recursive: true, mode: 0o700 })
  const folder = join(root, "executions")
  if (create)
    await mkdir(folder, { mode: 0o700 }).catch((e: unknown) => {
      if ((e as { code?: string }).code !== "EEXIST") throw e
    })
  const info = await lstat(folder)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Unsafe executions directory")
  return folder
}
const recordDirectory = async (root: string, id: string) => {
  if (!ID.test(id)) throw new Error("Invalid execution identity")
  const folder = join(await directory(root, false), id)
  const info = await lstat(folder)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Unsafe execution directory")
  return folder
}
export const saveExecution = async (root: string, record: ExecutionRecord): Promise<void> => {
  const folder = await recordDirectory(root, record.id)
  await writeLibraryFile(join(folder, "summary.json"), `${JSON.stringify(record, null, 2)}\n`)
}
export const createExecution = async (root: string, startedAtMs = Date.now()) => {
  const folder = await directory(root, true)
  const id = randomUUID()
  await mkdir(join(folder, id), { mode: 0o700 })
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
  await saveExecution(root, initial)
  return { id, file: join(folder, id, "summary.json") }
}
/** Unfinished checkpoints cannot establish whether a process is still alive. Never mark them successful. */
export const listExecutions = async (root: string) => {
  const records: ExecutionRecord[] = []
  let skipped = 0
  let folder: string
  try {
    folder = await directory(root, false)
  } catch (e) {
    if ((e as { code?: string }).code === "ENOENT") return { records, skipped }
    throw e
  }
  for (const id of await readdir(folder)) {
    try {
      const dir = await recordDirectory(root, id)
      const file = join(dir, "summary.json")
      const info = await lstat(file)
      if (!info.isFile() || info.isSymbolicLink() || info.size > 10_000_000)
        throw new Error("Unsafe execution record")
      const record = parseExecution(JSON.parse(await readFile(file, "utf8")))
      if (!record || record.id !== id) throw new Error("Invalid execution record")
      records.push(record.outcome === "running" ? { ...record, outcome: "unknown" } : record)
    } catch {
      skipped++
    }
  }
  return {
    records: records.toSorted((a, b) => b.startedAtMs - a.startedAtMs || a.id.localeCompare(b.id)),
    skipped,
  }
}
