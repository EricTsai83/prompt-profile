/**
 * Release check (plan 10): `node scripts/release-version.ts <tag>`.
 * The tag without `v` must equal `package.json` `version`; otherwise exit 1 before anything is
 * published. A suffixed version (`0.2.0-beta.1`) is a prerelease on the npm dist-tag `next`,
 * a plain `X.Y.Z` goes to `latest`. Writes `version`, `dist-tag` and `prerelease` to
 * `$GITHUB_OUTPUT` when set. Runs on plain Node (type stripping), before `pnpm install`.
 */
import { appendFileSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

export interface ReleaseInfo {
  readonly version: string
  readonly distTag: "latest" | "next"
  readonly prerelease: boolean
}

const TAG = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/

export const releaseInfo = (tag: string, packageVersion: string): ReleaseInfo => {
  const version = TAG.exec(tag)?.[1]
  if (version === undefined) {
    throw new Error(`Tag "${tag}" is not vX.Y.Z or vX.Y.Z-suffix`)
  }
  if (version !== packageVersion) {
    throw new Error(`Tag "${tag}" does not match package.json version "${packageVersion}"`)
  }
  const prerelease = version.includes("-")
  return { version, distTag: prerelease ? "next" : "latest", prerelease }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const tag = process.argv[2] ?? ""
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version?: unknown
    }
    const info = releaseInfo(tag, String(pkg.version))
    const lines = `version=${info.version}\ndist-tag=${info.distTag}\nprerelease=${info.prerelease}\n`
    if (process.env["GITHUB_OUTPUT"]) appendFileSync(process.env["GITHUB_OUTPUT"], lines)
    process.stdout.write(lines)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
