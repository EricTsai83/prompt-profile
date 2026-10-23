import { readdirSync } from "node:fs"
import { defineConfig } from "vitest/config"

/** Not unit-test modules: data, real-data smoke tests (vitest.smoke.config.ts), LLM evals. */
const NOT_MODULES = new Set(["fixtures", "smoke", "eval"])

/**
 * One vitest project per module folder in `test/` (mirrors `src/`), so a change can be
 * tested by module: `pnpm test --project analysis`. New folders become projects by
 * themselves.
 */
const MODULES = readdirSync(new URL("./test", import.meta.url), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !NOT_MODULES.has(d.name))
  .map((d) => d.name)
  .toSorted()

export default defineConfig({
  test: {
    projects: MODULES.map((name) => ({
      test: { name, include: [`test/${name}/**/*.test.ts`] },
    })),
  },
})
