import { Effect, FileSystem, Path } from "effect"
import type { SKILL_ORIGINS } from "../../domain/Techniques.ts"

export type SkillOrigin = (typeof SKILL_ORIGINS)[number]

export interface SkillInfo {
  readonly description: string | null
  readonly origin: SkillOrigin
}

/**
 * Skills that ship with Claude Code (no SKILL.md on disk). Public names: the share page may
 * show them. An extensible data list.
 */
export const BUILTIN_SKILLS: Readonly<Record<string, string>> = {
  "code-review":
    "Review a diff, PR or branch for correctness bugs, optionally posting or fixing findings",
  simplify: "Review changed code for reuse, simplification and efficiency, then apply the fixes",
  "security-review": "Run a security review of the pending changes on the current branch",
  init: "Create a CLAUDE.md file that documents the codebase",
  review: "Review a pull request",
  "fewer-permission-prompts": "Allowlist common read-only commands to reduce permission prompts",
  loop: "Run a prompt or command on a recurring interval",
  schedule: "Create and manage scheduled cloud agents (routines)",
  "claude-api": "Reference for building with the Claude API and SDKs",
  "update-config": "Configure Claude Code settings, permissions and hooks",
  "keybindings-help": "Customise Claude Code keyboard shortcuts",
  run: "Launch and drive the project's app to see a change working",
  "workflow-authoring": "Write multi-agent workflow scripts",
  "plugin-authoring": "Build or change a Claude Code plugin (mods, hooks, commands)",
}

const MAX_DESCRIPTION = 220

/** The `description` of a SKILL.md front matter (plain, quoted or folded); null if none. */
export const frontMatterDescription = (text: string): string | null => {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1]
  if (fm === undefined) return null
  const lines = fm.split(/\r?\n/)
  const i = lines.findIndex((l) => l.startsWith("description:"))
  if (i === -1) return null
  let value = lines[i]!.replace(/^description:\s*/, "")
  if (value === "" || /^[>|][-+]?$/.test(value)) {
    const block: Array<string> = []
    for (const l of lines.slice(i + 1)) {
      if (!/^\s+\S/.test(l)) break
      block.push(l.trim())
    }
    value = block.join(" ")
  }
  value = value.replace(/^["']|["']$/g, "").trim()
  if (value === "") return null
  return value.length > MAX_DESCRIPTION
    ? `${value.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`
    : value
}

/**
 * Describe the skills a user ran: their own (`<claudeRoot>/skills`), plugin skills
 * (`<claudeRoot>/plugins/**`), project skills (`<project>/.claude/skills`) and built-ins.
 * Only the front matter description is kept; the skill body is never stored.
 * `names` may be plugin-scoped ("plugin:skill"); the part after the last ":" is the folder.
 */
export const readSkillCatalog = (input: {
  readonly claudeRoot: string
  readonly projectDirs: ReadonlyArray<string>
  readonly names: ReadonlyArray<string>
}): Effect.Effect<ReadonlyMap<string, SkillInfo>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const describe = (file: string) =>
      fs.readFileString(file).pipe(
        Effect.map((text) => frontMatterDescription(text.slice(0, 8192))),
        Effect.orElseSucceed(() => null),
      )
    const exists = (file: string) => fs.exists(file).pipe(Effect.orElseSucceed(() => false))
    // plugin skills can sit at any depth under plugins/: index their folders once
    const pluginFiles = yield* fs
      .readDirectory(path.join(input.claudeRoot, "plugins"), { recursive: true })
      .pipe(
        Effect.map((entries) =>
          entries.filter((e) => e.endsWith(`${path.sep}SKILL.md`) && !e.includes("node_modules")),
        ),
        Effect.orElseSucceed(() => [] as ReadonlyArray<string>),
      )
    const catalog = new Map<string, SkillInfo>()
    for (const name of input.names) {
      const folder = name.split(":").at(-1)!
      const personal = path.join(input.claudeRoot, "skills", folder, "SKILL.md")
      const plugin = pluginFiles.find((f) => path.basename(path.dirname(f)) === folder)
      let info: SkillInfo | undefined
      if (yield* exists(personal))
        info = { description: yield* describe(personal), origin: "personal" }
      else if (plugin !== undefined)
        info = {
          description: yield* describe(path.join(input.claudeRoot, "plugins", plugin)),
          origin: "plugin",
        }
      else {
        for (const dir of input.projectDirs) {
          const file = path.join(dir, ".claude", "skills", folder, "SKILL.md")
          if (yield* exists(file)) {
            info = { description: yield* describe(file), origin: "project" }
            break
          }
        }
      }
      if (info === undefined && BUILTIN_SKILLS[folder] !== undefined)
        info = { description: BUILTIN_SKILLS[folder]!, origin: "builtin" }
      catalog.set(name, info ?? { description: null, origin: "unknown" })
    }
    return catalog
  })
