import { Effect, FileSystem, Path } from "effect"
import type { SkillOrigin } from "../../domain/index.ts"
import { clipDescription } from "../common/skills.ts"

export interface SkillInfo {
  readonly description: string | null
  readonly origin: SkillOrigin
}

/**
 * Skills that ship with Claude Code (no SKILL.md on disk). Public names: shown even with
 * `--exclude custom-names`. An extensible data list.
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

/** `- name: description` lines of a Claude Code skill listing. */
export const parseSkillListing = (content: string): Array<[name: string, description: string]> =>
  [...content.matchAll(/^- ([\w.:@/-]{1,80}):\s*(\S.*)$/gm)].map((m) => [
    m[1]!,
    clipDescription(m[2]!.trim()),
  ])

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
  return clipDescription(value)
}

/**
 * Describe the skills a user ran: their own (`<claudeRoot>/skills`, `<agentsRoot>/skills`),
 * plugin skills (`<claudeRoot>/plugins/**`), project skills (`<project>/.claude/skills` and
 * `<project>/.agents/skills`) and built-ins.
 * Only the front matter description is kept; the skill body is never stored.
 * `names` may be plugin-scoped ("plugin:skill"); the part after the last ":" is the folder.
 */
export const readSkillCatalog = (input: {
  readonly claudeRoot: string
  /** `~/.agents`: the shared, tool-neutral skills folder (also `<project>/.agents/skills`). */
  readonly agentsRoot?: string
  readonly projectDirs: ReadonlyArray<string>
  readonly names: ReadonlyArray<string>
  /** Descriptions recorded in transcripts (preferred over SKILL.md: no file access needed). */
  readonly listed?: Readonly<Record<string, string>>
  /** Origins recorded in transcripts (Codex lists file paths); used when no file is found. */
  readonly listedOrigins?: Readonly<Record<string, SkillOrigin>>
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
    /** The first existing `<dir>/<folder>/SKILL.md`. */
    const firstIn = (dirs: ReadonlyArray<string>, folder: string) =>
      Effect.gen(function* () {
        for (const dir of dirs) {
          const file = path.join(dir, folder, "SKILL.md")
          if (yield* exists(file)) return file
        }
        return undefined
      })
    const personalDirs = [
      path.join(input.claudeRoot, "skills"),
      ...(input.agentsRoot === undefined ? [] : [path.join(input.agentsRoot, "skills")]),
    ]
    const projectDirs = input.projectDirs.flatMap((dir) => [
      path.join(dir, ".claude", "skills"),
      path.join(dir, ".agents", "skills"),
    ])
    for (const name of input.names) {
      const folder = name.split(":").at(-1)!
      const personal = yield* firstIn(personalDirs, folder)
      const plugin = pluginFiles.find((f) => path.basename(path.dirname(f)) === folder)
      const project = personal || plugin ? undefined : yield* firstIn(projectDirs, folder)
      const info: SkillInfo | undefined =
        personal !== undefined
          ? { description: yield* describe(personal), origin: "personal" }
          : plugin !== undefined
            ? {
                description: yield* describe(path.join(input.claudeRoot, "plugins", plugin)),
                origin: "plugin",
              }
            : project !== undefined
              ? { description: yield* describe(project), origin: "project" }
              : BUILTIN_SKILLS[folder] !== undefined
                ? { description: BUILTIN_SKILLS[folder]!, origin: "builtin" }
                : undefined
      const listed = input.listed?.[name] ?? input.listed?.[folder]
      const listedOrigin = input.listedOrigins?.[name] ?? input.listedOrigins?.[folder]
      const found: SkillInfo = info ?? { description: null, origin: listedOrigin ?? "unknown" }
      catalog.set(name, listed === undefined ? found : { ...found, description: listed })
    }
    return catalog
  })
