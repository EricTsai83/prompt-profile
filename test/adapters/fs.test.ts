import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { findFiles } from "../../src/adapters/common/fs.ts"

const find = (root: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    return yield* findFiles(fs, path, root, (n) => n.endsWith(".jsonl"))
  }).pipe(Effect.provide(NodeServices.layer))

describe("findFiles", () => {
  it.effect("finds matching files recursively, sorted", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-fs-"))
      mkdirSync(join(root, "2026", "09"), { recursive: true })
      writeFileSync(join(root, "2026", "09", "b.jsonl"), "")
      writeFileSync(join(root, "2026", "09", "a.jsonl"), "")
      writeFileSync(join(root, "2026", "skip.txt"), "")
      writeFileSync(join(root, "top.jsonl"), "")
      expect(yield* find(root)).toEqual([
        join(root, "2026", "09", "a.jsonl"),
        join(root, "2026", "09", "b.jsonl"),
        join(root, "top.jsonl"),
      ])
    }),
  )

  it.effect("terminates on symlink loops and visits an aliased folder once", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-fs-"))
      mkdirSync(join(root, "real"))
      writeFileSync(join(root, "real", "a.jsonl"), "")
      symlinkSync(root, join(root, "real", "loop"))
      symlinkSync(join(root, "real"), join(root, "zalias"))
      expect(yield* find(root)).toEqual([join(root, "real", "a.jsonl")])
    }),
  )

  it.effect("missing root → no files", () =>
    Effect.gen(function* () {
      expect(yield* find("/definitely/not/here")).toEqual([])
    }),
  )
})
