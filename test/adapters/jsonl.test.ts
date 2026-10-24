import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, Stream } from "effect"
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readJsonl } from "../../src/adapters/common/jsonl.ts"

const collect = (file: string, counts = { bad: 0, unreadable: 0 }) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const stream = readJsonl(fs, file, {
      onBadLine: () => void counts.bad++,
      onUnreadable: () => void counts.unreadable++,
    })
    // run twice: line numbers must restart
    yield* Stream.runCollect(stream)
    return { lines: yield* Stream.runCollect(stream), counts }
  }).pipe(Effect.provide(NodeServices.layer))

describe("readJsonl", () => {
  it.effect("numbers lines per run, counts bad lines", () =>
    Effect.gen(function* () {
      const file = join(mkdtempSync(join(tmpdir(), "pp-jsonl-")), "a.jsonl")
      writeFileSync(file, '{"a":1}\n\nnot json\n{"a":2}\n')
      const { lines, counts } = yield* collect(file)
      expect(lines).toEqual([
        { value: { a: 1 }, raw: `{"a":1}`, lineNumber: 1 },
        { value: { a: 2 }, raw: `{"a":2}`, lineNumber: 4 },
      ])
      expect(counts).toEqual({ bad: 2, unreadable: 0 })
    }),
  )

  it.effect("an unreadable file yields nothing and is reported", () =>
    Effect.gen(function* () {
      const file = join(mkdtempSync(join(tmpdir(), "pp-jsonl-")), "locked.jsonl")
      writeFileSync(file, '{"a":1}\n')
      chmodSync(file, 0o000)
      const { lines, counts } = yield* collect(file)
      expect(lines).toEqual([])
      expect(counts).toEqual({ bad: 0, unreadable: 2 })
    }),
  )
})
