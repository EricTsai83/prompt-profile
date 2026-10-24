/**
 * CLI checks shared by the npm package check (test-package.mjs) and the standalone binary
 * check (test-binary.mjs): version, help, offline render of HTML + JSON + 1200x630 PNG, a look.
 * `cli(args, options)` runs the program under test and returns stdout.
 */
import assert from "node:assert/strict"
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const checkCli = ({ repo, root, version, cli }) => {
  assert.equal(cli(["--version"]).trim(), `prompt-profile v${version}`)
  assert.match(cli(["--help"]), /--max-calls/)
  const input = join(root, "sample profile.json")
  const output = join(root, "rendered report")
  // English only: a zh-TW card would download the CJK font, which this check must not need.
  const sample = JSON.parse(readFileSync(join(repo, "test", "fixtures", "profile.sample.json")))
  writeFileSync(input, JSON.stringify({ ...sample, languages: ["en"], translations: {} }), {
    mode: 0o600,
  })
  cli(["render", input, "--out", output], {
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
  // A non-default look reads the display font shipped with the program.
  cli(["render", input, "--look", "signal", "--out", join(root, "signal")])
  const signalCard = readFileSync(join(root, "signal", "card.png"))
  assert.equal(signalCard.readUInt32BE(16), 1200)
  assert.match(readFileSync(join(root, "signal", "report.html"), "utf8"), /data-look="signal"/)
  assert.ok(existsSync(join(root, "signal", "render.json")))
}
