/** Install the actual tarball outside the checkout and exercise its public CLI, offline rendering and assets. */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { checkCli } from "./cli-checks.mjs"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const root = mkdtempSync(join(tmpdir(), "prompt-profile package "))
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 180_000,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  })
try {
  let tarball = process.argv[2] && resolve(process.argv[2])
  if (!tarball) {
    tarball = join(root, "prompt-profile.tgz")
    run("pnpm", ["pack", "--out", tarball], { cwd: repo })
  }
  writeFileSync(join(root, "package.json"), JSON.stringify({ private: true, type: "module" }), {
    mode: 0o600,
  })
  run("npm", [
    "install",
    tarball,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
  ])
  const installed = join(root, "node_modules", "prompt-profile")
  const bin = join(installed, "dist", "bin.js")
  const pkg = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"))
  if (process.platform !== "win32") {
    // the installed `.bin` shim, as users run it
    const shim = run(join(root, "node_modules", ".bin", "prompt-profile"), ["--version"])
    assert.equal(shim.trim(), `prompt-profile v${pkg.version}`)
  }
  // Every file tsdown copies beside dist/bin.js (tsdown.config.ts), listed from the sources so
  // a new prompt or font is checked without editing this list
  const shipped = (dir, to) =>
    readdirSync(join(repo, dir))
      .filter((f) => !f.startsWith("."))
      .map((f) => `${to}/${f}`)
  const assets = [
    ...shipped("src/analysis/prompts", "prompts"),
    ...shipped("src/report/fonts", "fonts"),
  ]
  assert.ok(assets.some((f) => f === "prompts/map.md") && assets.some((f) => f.endsWith(".woff")))
  for (const file of assets) {
    assert.ok(statSync(join(installed, "dist", file)).size > 0, `Missing package asset: ${file}`)
  }
  checkCli({
    repo,
    root,
    version: pkg.version,
    cli: (args, options = {}) => run(process.execPath, [bin, ...args], options),
  })
  console.log(
    "Installed-package check passed: version, help, prompts, fonts, a dry run, HTML, JSON, 1200x630 PNG and a look.",
  )
} finally {
  rmSync(root, { recursive: true, force: true })
}
