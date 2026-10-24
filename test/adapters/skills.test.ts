import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readSkillCatalog } from "../../src/adapters/claude-code/skills.ts"

const skill = (dir: string, name: string, frontMatter: string, body = "Body text.") => {
  mkdirSync(join(dir, name), { recursive: true })
  writeFileSync(join(dir, name, "SKILL.md"), `---\nname: ${name}\n${frontMatter}\n---\n\n${body}\n`)
}

describe("skill catalog", () => {
  it.effect("also reads the shared .agents/skills folders, personal and per project", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-skills-"))
      skill(
        join(root, ".agents", "skills"),
        "shared-helper",
        "description: A skill shared across agents",
      )
      const project = join(root, "work", "api")
      skill(
        join(project, ".agents", "skills"),
        "db-migrate",
        "description: Plan a database migration",
      )
      const catalog = yield* readSkillCatalog({
        claudeRoot: join(root, ".claude"),
        agentsRoot: join(root, ".agents"),
        projectDirs: [project],
        names: ["shared-helper", "db-migrate"],
      })
      expect(catalog.get("shared-helper")).toEqual({
        description: "A skill shared across agents",
        origin: "personal",
      })
      expect(catalog.get("db-migrate")).toEqual({
        description: "Plan a database migration",
        origin: "project",
      })
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("reads descriptions and origins; the body is never read", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-skills-"))
      const claude = join(root, ".claude")
      skill(
        join(claude, "skills"),
        "my-review",
        "description: Review my diff with two models",
        "SECRET BODY",
      )
      skill(
        join(claude, "plugins", "marketplaces", "acme", "plugins", "deploy", "skills"),
        "deploy",
        'description: "Deploy the current project"',
      )
      const project = join(root, "work", "app")
      skill(
        join(project, ".claude", "skills"),
        "release-notes",
        "description: >\n  Write release notes\n  from merged PRs",
      )
      const catalog = yield* readSkillCatalog({
        claudeRoot: claude,
        projectDirs: [project, join(root, "missing")],
        names: ["my-review", "acme:deploy", "release-notes", "code-review", "who-knows"],
      })
      expect(catalog.get("my-review")).toEqual({
        description: "Review my diff with two models",
        origin: "personal",
      })
      expect(catalog.get("acme:deploy")).toEqual({
        description: "Deploy the current project",
        origin: "plugin",
      })
      expect(catalog.get("release-notes")).toEqual({
        description: "Write release notes from merged PRs",
        origin: "project",
      })
      expect(catalog.get("code-review")?.origin).toBe("builtin")
      expect(catalog.get("who-knows")).toEqual({ description: null, origin: "unknown" })
      expect(JSON.stringify([...catalog])).not.toContain("SECRET")
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("descriptions recorded in transcripts win; files still decide the origin", () =>
    Effect.gen(function* () {
      const root = mkdtempSync(join(tmpdir(), "pp-skills-"))
      const claude = join(root, ".claude")
      skill(join(claude, "skills"), "my-review", "description: From the file")
      const catalog = yield* readSkillCatalog({
        claudeRoot: claude,
        projectDirs: [],
        names: ["my-review", "gone-skill"],
        listed: { "my-review": "From the transcript", "gone-skill": "A skill whose repo is gone" },
      })
      expect(catalog.get("my-review")).toEqual({
        description: "From the transcript",
        origin: "personal",
      })
      // no file anywhere: described, but its origin is unknown (so `--exclude custom-names` only counts it)
      expect(catalog.get("gone-skill")).toEqual({
        description: "A skill whose repo is gone",
        origin: "unknown",
      })
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
