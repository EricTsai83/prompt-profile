import { describe, expect, it } from "vitest"
import { releaseInfo } from "../../scripts/release-version.ts"

describe("releaseInfo", () => {
  it("publishes a plain version as latest", () => {
    expect(releaseInfo("v0.1.1", "0.1.1")).toEqual({
      version: "0.1.1",
      distTag: "latest",
      prerelease: false,
    })
  })

  it("publishes a suffixed version as a prerelease on next", () => {
    expect(releaseInfo("v0.2.0-beta.1", "0.2.0-beta.1")).toEqual({
      version: "0.2.0-beta.1",
      distTag: "next",
      prerelease: true,
    })
  })

  it("rejects a tag that differs from package.json", () => {
    expect(() => releaseInfo("v0.1.2", "0.1.1")).toThrow(/v0\.1\.2.*0\.1\.1/)
  })

  it("rejects a tag without the v prefix or a full version", () => {
    expect(() => releaseInfo("0.1.1", "0.1.1")).toThrow(/not vX.Y.Z/)
    expect(() => releaseInfo("v0.1", "0.1")).toThrow(/not vX.Y.Z/)
    expect(() => releaseInfo("refs/tags/v0.1.1", "0.1.1")).toThrow(/not vX.Y.Z/)
  })
})
