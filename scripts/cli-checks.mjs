/**
 * CLI checks shared by the npm package check (test-package.mjs) and the standalone binary
 * check (test-binary.mjs): version, help, a dry run over the fixture history, offline render of
 * HTML + JSON + 1200x630 PNG, a look.
 * `cli(args, options)` runs the program under test and returns stdout.
 */
import assert from "node:assert/strict"
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const checkCli = ({ repo, root, version, cli }) => {
  assert.equal(cli(["--version"]).trim(), `prompt-profile v${version}`)
  assert.match(cli(["--help"]), /--max-calls/)
  assert.match(cli(["--help"]), /--max-cost-usd/)
  checkDryRun({ repo, root, cli })
  const input = join(root, "sample profile.json")
  const output = join(root, "rendered report")
  // English only: a zh-TW card would download the CJK font, which this check must not need.
  const sample = JSON.parse(readFileSync(join(repo, "test", "fixtures", "profile.sample.json")))
  const execution = JSON.parse(
    readFileSync(join(repo, "test", "fixtures", "execution.partial.json")),
  )
  const generation = {
    executionId: execution.id,
    outcome: execution.outcome,
    languages: [{ language: "en", available: true }],
    models: execution.attempts.map((a) => ({
      engine: a.engine,
      model: a.model,
      source: a.modelSource,
    })),
    // The fixture is a version 1 record without the `label` stage; a profile's generation
    // carries every stage, so a missing one would come back filled in.
    summary: {
      ...execution.summary,
      stages: { label: { calls: 0, failed: 0, cancelled: 0 }, ...execution.summary.stages },
    },
  }
  writeFileSync(
    input,
    JSON.stringify({ ...sample, generation, languages: ["en"], translations: {} }),
    {
      mode: 0o600,
    },
  )
  cli(["render", input, "--out", output], {
    env: { ...process.env, XDG_CACHE_HOME: join(root, "cache") },
  })
  assert.match(readFileSync(join(output, "README.md"), "utf8"), /render.json/)
  const html = readFileSync(join(output, "report.html"), "utf8")
  assert.match(html, /Content-Security-Policy/)
  assert.match(html, /Report generation/)
  assert.ok(html.includes(generation.executionId))
  assert.deepEqual(
    JSON.parse(readFileSync(join(output, "profile.json"), "utf8")).generation,
    generation,
  )
  assert.match(cli(["history", "--executions", "--out", output]), /Execution records/)
  const png = readFileSync(join(output, "card.png"))
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
  assert.equal(png.readUInt32BE(16), 1200)
  assert.equal(png.readUInt32BE(20), 630)
  assert.deepEqual(
    JSON.parse(readFileSync(join(output, "profile.json"), "utf8")).languages,
    JSON.parse(readFileSync(input, "utf8")).languages,
  )
  for (const file of ["report.html", "profile.json", "card.png", "README.md"]) {
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

/**
 * The main command up to the first LLM call: read the fictional Claude Code and Codex history,
 * filter, redact, chunk and write the preview. `--dry-run` sends nothing; a `claude` / `codex`
 * on PATH is only asked for its version and login state.
 */
const checkDryRun = ({ repo, root, cli }) => {
  const home = join(root, "home")
  const out = join(root, "dry run")
  // Copies: a real `claude` on PATH writes its own config into CLAUDE_CONFIG_DIR when asked
  const history = join(root, "history")
  cpSync(join(repo, "test", "fixtures", "claude-code"), join(history, "claude-code"), {
    recursive: true,
  })
  cpSync(join(repo, "test", "fixtures", "codex"), join(history, "codex"), { recursive: true })
  cli(["--dry-run", "--since", "all", "--out", out], {
    env: {
      ...process.env,
      // never the real history of the machine running the check
      HOME: home,
      USERPROFILE: home,
      CLAUDE_CONFIG_DIR: join(history, "claude-code"),
      CODEX_HOME: join(history, "codex"),
      XDG_CACHE_HOME: join(root, "cache"),
    },
  })
  assert.match(readFileSync(join(out, "README.md"), "utf8"), /chunks\//)
  const plan = JSON.parse(readFileSync(join(out, "plan.json"), "utf8"))
  assert.ok(plan.chunksSelected > 0, "The dry run selected no chunk from the fixture history")
  const chunks = readdirSync(join(out, "chunks"))
  assert.equal(chunks.length, plan.chunksSelected)
  assert.match(readFileSync(join(out, "chunks", chunks[0]), "utf8"), /^<prompt id="/)
  if (process.platform !== "win32") {
    for (const file of ["plan.json", "README.md", join("chunks", chunks[0])]) {
      assert.equal(statSync(join(out, file)).mode & 0o777, 0o600)
    }
  }
}
