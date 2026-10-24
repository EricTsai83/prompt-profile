/**
 * Unpack a standalone binary archive outside the checkout and run the same CLI checks as the
 * npm package check: `node scripts/test-binary.mjs dist-bin/prompt-profile-<v>-<target>.tar.gz`.
 * Only the archive's own files sit beside the executable, so prompts, fonts and the wasm must
 * come from inside the binary. Run it on the platform the archive was built for.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { checkCli } from "./cli-checks.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const archive = process.argv[2] && resolve(process.argv[2])
if (!archive || !existsSync(archive)) {
  console.error("Usage: node scripts/test-binary.mjs <prompt-profile-<version>-<target>.tar.gz>")
  process.exit(1)
}
const root = mkdtempSync(join(tmpdir(), "prompt-profile binary "))
try {
  execFileSync("tar", ["-xzf", archive, "-C", root])
  const folder = join(root, basename(archive, ".tar.gz"))
  const exe = join(folder, process.platform === "win32" ? "prompt-profile.exe" : "prompt-profile")
  const { version } = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"))
  checkCli({
    repo,
    root,
    version,
    cli: (args, options = {}) =>
      execFileSync(exe, args, {
        cwd: root,
        encoding: "utf8",
        timeout: 180_000,
        stdio: ["ignore", "pipe", "pipe"],
        ...options,
      }),
  })
  console.log(`Binary check passed (${basename(archive)}): version, help, HTML, JSON, PNG, a look.`)
} finally {
  rmSync(root, { recursive: true, force: true })
}
