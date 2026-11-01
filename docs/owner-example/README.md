# Maintainer example

This is the maintainer's approved public snapshot of a personal prompt-profile analysis,
not a fictional fixture or a benchmark of other people.

- Analysis generated: November 1, 2026 at 17:10 (UTC+08:00).
- Prompt activity: September 2 to November 1, 2026.
- Source engine: Codex; analysis version 38; profile schema 26.
- Exports refreshed with the current renderer; the saved analysis was not rerun.
- Public exports: bilingual `report.html`, English `card.en.png`, Traditional Chinese `card.png`.
- Export exclusions: prompt quotes, project names and custom instruction names.
  Conversation timelines and example excerpts are omitted along with their original prompts.
- Activity dates, generated observations, ability scores and usage estimates remain visible.
  Scores describe supported practice in these conversations, not population ranks. API
  estimates are not subscription charges and may be partially priced.

The private profile and render metadata are intentionally not published. These three exports
work offline. The default report language is Traditional Chinese; use its language switch
for English. The README hero uses the English card.

## Refreshing this snapshot

Render an explicitly approved private profile into a temporary output folder:

```sh
pnpm dev render "<private-profile.json>" --out tmp/owner-public-export --exclude quotes,projects,custom-names
```

Review both cards and the report in both languages, then copy only `report.html`,
`card.en.png` and `card.png` into this directory. Update the snapshot date above and in
README.md and scripts/site.ts. Do not copy profile.json, render.json, private source paths,
execution records or caches. Format the exported HTML with `pnpm exec oxfmt
docs/owner-example/report.html`. Real histories must never be added to test fixtures.

GitHub Pages copies these approved files from docs/. The fictional examples remain separately
rendered from hand-written fixtures. Changing the renderer does not automatically refresh
this personal snapshot; regenerate it from the private source when approving a new export.
