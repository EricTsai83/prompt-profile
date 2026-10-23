import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { writePrivateFile } from "../../src/platform/files.ts"

const write = (file: string, data: string) =>
  Effect.gen(function* () {
    yield* writePrivateFile(yield* FileSystem.FileSystem, yield* Path.Path, file, data)
  }).pipe(Effect.provide(NodeServices.layer))

describe("writePrivateFile", () => {
  it.effect("creates missing folders 0700 and the file 0600", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-files-"))
      const file = join(root, "a", "b", "out.json")
      yield* write(file, "{}")
      expect(readFileSync(file, "utf8")).toBe("{}")
      expect(statSync(file).mode & 0o777).toBe(0o600)
      expect(statSync(join(root, "a")).mode & 0o777).toBe(0o700)
      expect(statSync(join(root, "a", "b")).mode & 0o777).toBe(0o700)
    }),
  )

  it.effect("leaves the permissions of an existing folder alone", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-files-"))
      chmodSync(root, 0o755)
      yield* write(join(root, "stats.json"), "{}")
      expect(statSync(root).mode & 0o777).toBe(0o755)
    }),
  )

  it.effect("a failed write leaves no temp file behind", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-files-"))
      // rename onto a non-empty directory fails
      mkdirSync(join(root, "target", "child"), { recursive: true })
      const exit = yield* Effect.exit(write(join(root, "target"), "x"))
      expect(exit._tag).toBe("Failure")
      expect(readdirSync(root)).toEqual(["target"])
    }),
  )
})
