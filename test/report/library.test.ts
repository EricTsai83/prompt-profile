import { expect, it } from "vitest"
import { renderLibrary } from "../../src/report/library.ts"
import type { RunManifest } from "../../src/domain/Library.ts"
const id = `20261031T000000Z-${"a".repeat(32)}`
const run: RunManifest = {
  version: 1,
  id,
  createdAt: "2026-10-31T00:00:00.000Z",
  window: { from: "2026-09-04T00:00:00.000Z", to: "2026-10-31T00:00:00.000Z" },
  sampling: { sampled: true, prompts: 2, sessions: 2 },
  role: null,
  languages: ["zh-TW", "en"],
  engine: { runner: "fake", model: "<script>alert(1)</script>", analysisVersion: "20" },
  schemaVersion: 15,
  pipelineVersion: "4",
  excluded: ["dates"],
  cards: [],
}
it("renders escaped bilingual offline relative links and honors date precision", () => {
  const page = renderLibrary({ version: 1, latest: id, runs: [run], skipped: 1 })
  expect(page).toContain(`href="reports/${id}/report.html"`)
  expect(page).toContain("Your collaboration reports")
  expect(page).toContain("你的協作報告")
  expect(page).not.toContain("<script>")
  expect(page).toContain("&lt;script&gt;")
  expect(page).not.toContain("2026-09-04")
  expect(page).toContain("2026-09")
  expect(page).not.toMatch(/(?:src|href)="(?:https?:|\/)/u)
  expect(
    renderLibrary({
      version: 1,
      latest: "../../outside",
      runs: [{ ...run, id: "../../outside" }],
      skipped: 0,
    }),
  ).not.toContain("../../outside")
})
