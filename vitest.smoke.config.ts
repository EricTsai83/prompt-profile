import { defineConfig } from "vitest/config"

// Smoke tests read real local data / call real CLIs. Each test skips itself when the
// data or binary is missing, so this is always safe to run (CI will skip everything).
export default defineConfig({
  test: {
    include: ["test/smoke/**/*.test.ts"],
    testTimeout: 15 * 60_000,
    hookTimeout: 60_000,
  },
})
