import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const hasBinary = (name: string): boolean => {
  try {
    execFileSync(name, ["--version"], { stdio: "ignore", timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

export const claudeHome = (): string =>
  process.env["CLAUDE_CONFIG_DIR"] ?? join(homedir(), ".claude")
export const codexHome = (): string => process.env["CODEX_HOME"] ?? join(homedir(), ".codex")

/** Files under `paths` modified at/after `sinceMs` whose content contains `needle`. */
export const filesContaining = (
  paths: ReadonlyArray<string>,
  sinceMs: number,
  needle: string,
): Array<string> => {
  const hits: Array<string> = []
  const visit = (p: string): void => {
    if (!existsSync(p)) return
    const st = statSync(p)
    if (st.isDirectory()) {
      for (const child of readdirSync(p)) visit(join(p, child))
    } else if (st.mtimeMs >= sinceMs - 1000 && readFileSync(p, "utf8").includes(needle)) {
      hits.push(p)
    }
  }
  paths.forEach(visit)
  return hits
}
