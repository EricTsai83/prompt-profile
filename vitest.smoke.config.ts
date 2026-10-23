import { defineConfig } from "vitest/config"

// Smoke tests use real local data / real CLIs. Each test skips itself when the data or
// binary is missing, so this is always safe to run (CI will skip everything).
//  - data: reads your Claude Code / Codex history (free, seconds) — `pnpm test:smoke`
//  - llm:  calls the real claude / codex CLIs (uses your subscription quota, minutes) —
//          `pnpm test:smoke:llm`, only when a CLI or its output format changed
export default defineConfig({
  test: {
    testTimeout: 15 * 60_000,
    hookTimeout: 60_000,
    projects: [
      {
        test: {
          name: "data",
          include: ["test/smoke/**/*.test.ts"],
          exclude: ["test/smoke/llm-runner.test.ts"],
        },
      },
      { test: { name: "llm", include: ["test/smoke/llm-runner.test.ts"] } },
    ],
  },
})
