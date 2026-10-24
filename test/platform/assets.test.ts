import { afterEach, describe, expect, it } from "vitest"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { readAsset, registerAssets } from "../../src/platform/assets.ts"

const fileOnDisk = (name: string, content: string) => {
  const file = join(mkdtempSync(join(tmpdir(), "pp-assets-")), name)
  writeFileSync(file, content)
  return file
}

afterEach(() => registerAssets(undefined))

describe("readAsset", () => {
  it("reads the file when nothing is registered", () => {
    const file = fileOnDisk("map.md", "from disk")
    expect(new TextDecoder().decode(readAsset("map.md", () => pathToFileURL(file)))).toBe(
      "from disk",
    )
    expect(new TextDecoder().decode(readAsset("map.md", () => file))).toBe("from disk")
  })

  it("returns a registered asset without touching the file system", () => {
    registerAssets(new Map([["map.md", new TextEncoder().encode("embedded")]]))
    const locate = () => {
      throw new Error("must not locate a registered asset")
    }
    expect(new TextDecoder().decode(readAsset("map.md", locate))).toBe("embedded")
  })

  it("falls back to the file for a name that was not registered", () => {
    registerAssets(new Map([["other.md", new Uint8Array([1])]]))
    const file = fileOnDisk("reduce.md", "still on disk")
    expect(new TextDecoder().decode(readAsset("reduce.md", () => file))).toBe("still on disk")
  })
})
