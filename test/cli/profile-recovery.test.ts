import { expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { VERSION } from "../../src/version.ts"
import { renderCommand } from "../../src/cli/options.ts"
import { makeHarness, fixture } from "./harness.ts"

it.effect(
  "offers a free latest-version render command with the same paths and privacy options",
  () =>
    Effect.gen(function* () {
      const h = makeHarness()
      const file = join(h.root, "future profile.json")
      const out = join(h.root, "my report")
      const original = JSON.stringify({
        ...JSON.parse(readFileSync(fixture("profile.sample.json"), "utf8")),
        schemaVersion: 21,
      })
      writeFileSync(file, original)
      const result = yield* h.run([
        "render",
        file,
        "--out",
        out,
        "--look",
        "signal",
        "--exclude",
        "personal",
        "--card-hide",
        "stats",
        "--name",
        "Private report",
        "--check",
        "strict",
      ])
      expect(result.code).toBe(1)
      expect(result.stderr).toContain(
        `npx prompt-profile@latest render '${file}' --out '${out}' --look signal --card-hide stats --exclude personal --name 'Private report' --check strict`,
      )
      expect(result.stderr).toContain("no model calls")
      expect(h.fakes).toHaveLength(0)
      expect(readFileSync(file, "utf8")).toBe(original)
      expect(existsSync(out)).toBe(false)
    }),
)

it.effect("uses the npx launcher for regeneration guidance without starting paid work", () =>
  Effect.gen(function* () {
    const h = makeHarness({ env: { env: { npm_command: "exec" } } })
    const file = join(h.root, "old.json")
    const html = join(h.root, "report.html")
    writeFileSync(file, JSON.stringify({ schemaVersion: 19 }))
    writeFileSync(html, "saved HTML")
    const result = yield* h.run(["render", file])
    expect(result.code).toBe(1)
    expect(result.stderr).toContain(`npx prompt-profile@${VERSION} --dry-run`)
    expect(result.stderr).toContain("subscription quota after confirmation")
    expect(result.stderr).not.toContain("npm i -g")
    expect(h.fakes).toHaveLength(0)
    expect(readFileSync(html, "utf8")).toBe("saved HTML")
  }),
)

it.effect("does not echo malformed version content or recommend an update for it", () =>
  Effect.gen(function* () {
    const h = makeHarness()
    const file = join(h.root, "invalid.json")
    writeFileSync(file, JSON.stringify({ schemaVersion: "private fake version\nrun-this-command" }))
    const result = yield* h.run(["render", file])
    expect(result.code).toBe(1)
    expect(result.stderr).toContain("missing or invalid")
    expect(result.stderr).not.toContain("private fake version")
    expect(result.stderr).not.toContain("run-this-command")
    expect(result.stderr).not.toContain("npm i -g")
    expect(h.fakes).toHaveLength(0)
  }),
)

it("quotes shell metacharacters in render recovery paths", () => {
  expect(
    renderCommand("saved '$(touch nope)' profile.json", "output;name", {
      launcher: "npx prompt-profile@latest",
      exclude: "usage",
    }),
  ).toBe(
    "npx prompt-profile@latest render 'saved '\\''$(touch nope)'\\'' profile.json' --out 'output;name' --exclude usage",
  )
})
