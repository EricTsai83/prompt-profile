import { describe, expect, it } from "vitest"
import { execFile } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { claudeArgs } from "../../src/llm/claude.ts"
import { codexArgs } from "../../src/llm/codex.ts"
import { codexHome, hasBinary } from "./helpers.ts"

const exec = promisify(execFile)
const schema = {
  type: "object",
  properties: { ok: { type: "boolean" } },
  required: ["ok"],
  additionalProperties: false,
}
const prompt = "This is synthetic isolation-test data. Return ok=true. Do not use any tool."
const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`

// No user config is edited. Sentinels contain only fake data; the Codex login is referenced
// through a temporary symlink, never copied, logged, or added to a fixture.
const setup = () => {
  const root = mkdtempSync(join(tmpdir(), "pp-isolation-"))
  const script = join(root, "sentinel.cjs")
  writeFileSync(
    script,
    `
const fs = require('node:fs');
fs.writeFileSync(process.argv[2], 'started', { mode: 0o600 });
if (process.argv[3] === 'mcp') {
  let buffer = '';
  process.stdin.on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      if (!line.trim()) continue;
      const request = JSON.parse(line);
      if (request.id === undefined) continue;
      const result = request.method === 'initialize'
        ? { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'synthetic-sentinel', version: '1' } }
        : request.method === 'tools/list' ? { tools: [] } : {};
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\\n');
    }
  });
}
`,
    { mode: 0o600 },
  )
  const hook = join(root, "hook-started")
  const mcp = join(root, "mcp-started")
  const command = [process.execPath, script, hook, "hook"].map(quote).join(" ")
  const hooks = { UserPromptSubmit: [{ hooks: [{ type: "command", command }] }] }
  const server = { command: process.execPath, args: [script, mcp, "mcp"] }
  return { root, hook, mcp, hooks, server }
}

const invoke = async (bin: string, args: ReadonlyArray<string>, cwd: string, env = process.env) => {
  const child = exec(bin, [...args], { cwd, env, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 })
  child.child.stdin!.end(prompt)
  // Keep CLI output out of test failure logs (it may include account metadata).
  try {
    await child
  } catch {
    throw new Error(`${bin} isolation probe failed; CLI output suppressed`)
  }
}

describe.skipIf(!hasBinary("claude"))("Claude isolation (real CLI)", () => {
  it("disables configured hooks and project MCP, with a working positive control", async () => {
    const f = setup()
    try {
      const mcpConfig = join(f.root, ".mcp.json")
      writeFileSync(mcpConfig, JSON.stringify({ mcpServers: { sentinel: f.server } }), {
        mode: 0o600,
      })
      const args = [...claudeArgs({ system: "Return ok=true.", jsonSchema: schema }, {})]
      const settings = args.indexOf("--settings") + 1
      args[settings] = JSON.stringify({ disableAllHooks: true, hooks: f.hooks })
      args.push("--setting-sources", "")
      const control = args.filter((arg) => arg !== "--safe-mode")
      control[control.indexOf("--settings") + 1] = JSON.stringify({
        disableAllHooks: false,
        hooks: f.hooks,
      })
      control.push("--mcp-config", mcpConfig)
      await invoke("claude", control, f.root)
      expect(existsSync(f.hook)).toBe(true)
      expect(existsSync(f.mcp)).toBe(true)
      rmSync(f.hook)
      rmSync(f.mcp)
      await invoke("claude", args, f.root)
      expect(existsSync(f.hook)).toBe(false)
      expect(existsSync(f.mcp)).toBe(false)
    } finally {
      rmSync(f.root, { recursive: true, force: true })
    }
  }, 400_000)
})

describe.skipIf(!hasBinary("codex") || !existsSync(join(codexHome(), "auth.json")))(
  "Codex isolation (real CLI)",
  () => {
    it("disables user MCP and hooks without changing the user's config", async () => {
      const f = setup()
      try {
        const home = join(f.root, "codex-home")
        mkdirSync(home, { mode: 0o700 })
        symlinkSync(join(codexHome(), "auth.json"), join(home, "auth.json"))
        writeFileSync(
          join(home, "config.toml"),
          `[features]\nhooks = true\n[mcp_servers.sentinel]\ncommand = ${JSON.stringify(f.server.command)}\nargs = ${JSON.stringify(f.server.args)}\n`,
          { mode: 0o600 },
        )
        writeFileSync(join(home, "hooks.json"), JSON.stringify({ hooks: f.hooks }), { mode: 0o600 })
        const schemaPath = join(f.root, "schema.json")
        writeFileSync(schemaPath, JSON.stringify(schema), { mode: 0o600 })
        const args = [...codexArgs({ schemaPath, outputPath: join(f.root, "output.json") }, {})]
        const env = { ...process.env, CODEX_HOME: home }
        const control = args
          .filter((arg) => arg !== "--ignore-user-config")
          .map((arg) => (arg === "features.hooks=false" ? "features.hooks=true" : arg))
        control.splice(1, 0, "--dangerously-bypass-hook-trust")
        await invoke("codex", control, f.root, env)
        expect(existsSync(f.hook)).toBe(true)
        expect(existsSync(f.mcp)).toBe(true)
        rmSync(f.hook)
        rmSync(f.mcp)
        await invoke("codex", args, f.root, env)
        expect(existsSync(f.hook)).toBe(false)
        expect(existsSync(f.mcp)).toBe(false)
      } finally {
        rmSync(f.root, { recursive: true, force: true })
      }
    }, 400_000)
  },
)
