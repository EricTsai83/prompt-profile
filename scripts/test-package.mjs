/** Install the actual tarball outside the checkout and exercise its public CLI, offline rendering and assets. */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

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
  const version =
    process.platform === "win32"
      ? run(process.execPath, [bin, "--version"])
      : run(join(root, "node_modules", ".bin", "prompt-profile"), ["--version"])
  assert.equal(version.trim(), `prompt-profile v${pkg.version}`)
  assert.match(run(process.execPath, [bin, "--help"]), /--max-calls/)
  for (const file of [
    "prompts/map.md",
    "prompts/merge.md",
    "prompts/reduce.md",
    "fonts/Inter-Regular.woff",
    "fonts/Inter-Bold.woff",
    "fonts/Inter-OFL.txt",
    "fonts/BricolageGrotesque-ExtraBold.woff",
    "fonts/BricolageGrotesque-OFL.txt",
  ]) {
    assert.ok(statSync(join(installed, "dist", file)).size > 0, `Missing package asset: ${file}`)
  }
  const input = join(root, "sample profile.json")
  const output = join(root, "rendered report")
  // English only: a zh-TW card would download the CJK font, which this check must not need.
  const sample = JSON.parse(readFileSync(join(repo, "test", "fixtures", "profile.sample.json")))
  writeFileSync(input, JSON.stringify({ ...sample, languages: ["en"], translations: {} }), {
    mode: 0o600,
  })
  run(process.execPath, [bin, "render", input, "--out", output], {
    env: { ...process.env, XDG_CACHE_HOME: join(root, "cache") },
  })
  const html = readFileSync(join(output, "report.html"), "utf8")
  assert.match(html, /Content-Security-Policy/)
  const png = readFileSync(join(output, "card.png"))
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
  assert.equal(png.readUInt32BE(16), 1200)
  assert.equal(png.readUInt32BE(20), 630)
  assert.deepEqual(
    JSON.parse(readFileSync(join(output, "profile.json"), "utf8")).languages,
    JSON.parse(readFileSync(input, "utf8")).languages,
  )
  for (const file of ["report.html", "profile.json", "card.png"]) {
    assert.ok(existsSync(join(output, file)))
    if (process.platform !== "win32") assert.equal(statSync(join(output, file)).mode & 0o777, 0o600)
  }
  // A non-default look reads the display font from the installed package.
  run(process.execPath, [bin, "render", input, "--look", "signal", "--out", join(root, "signal")])
  const signalCard = readFileSync(join(root, "signal", "card.png"))
  assert.equal(signalCard.readUInt32BE(16), 1200)
  assert.match(readFileSync(join(root, "signal", "report.html"), "utf8"), /data-look="signal"/)
  assert.ok(existsSync(join(root, "signal", "render.json")))
  console.log(
    "Installed-package check passed: version, help, prompts, fonts, HTML, JSON, 1200x630 PNG and a look.",
  )
} finally {
  rmSync(root, { recursive: true, force: true })
}
