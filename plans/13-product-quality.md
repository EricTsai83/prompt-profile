# 13 · Product quality before release

Status: done except item 8, which waits for the owner (2026-10-24). The release ([plan 10](./10-release.md)) waits for it.

## Goal

Make the default profile trustworthy and the evaluation harder to fool before anyone outside
the owner sees it. Every item comes from a finding in plans 11–12 or an open entry in
[RISKS.md](../RISKS.md); nothing here adds a new feature.

## Work items

| # | Item | Source | Needs | Status |
| --- | --- | --- | --- | --- |
| 1 | Persona fixes: correct curious-learner's "late nights" expectation; add a fourth, larger bilingual persona (≥80 prompts) | Stage 3 review; RISKS 15 | – | Done: expectation corrected; `weekend-data-engineer` added (82 prompts) |
| 2 | Rubric check for over-generalisation: universal quantifiers ("every", "always", "never", "all of your") in generated claims | Stage 3 review | – | Done: `overgeneralisations` in the score, optional `maxOvergeneralisations`. Baseline on the stage-3 runs: Claude 1–4 per profile (14 total), Codex 0 |
| 3 | Reduce rule against unsupported universal claims and stat misreadings; bump `ANALYSIS_VERSION` | Stage 3 review | Quota for a budgeted before/after run | Done: `ANALYSIS_VERSION` 6; 16 persona runs (56 of 70 calls), all rubrics pass; 8 of 10 reviewed overreaches gone ([results](../docs/ux/model-comparison/README.md#follow-up-analysis-version-6-plan-13)) |
| 4 | Smoke test prints the slash-command count; correct the stale RISKS 2 note (the CLI already counts them) | RISKS 2 | – | Done: smoke prints 5; RISKS 2 corrected |
| 5 | Report and looks checked in WebKit (Safari engine), light and dark | RISKS 16 | – | Done: WebKit 26.5, every look, light/dark, 1440/390 px |
| 6 | Share-card rule for long text: keep word-boundary clipping (archetype 56, trait 32 characters); document it | Plan 11 stage 2, finding 4 | – | Done: recorded in plan 12 |
| 7 | README: show the looks (sample cards regenerated from the synthetic fixture) | Plan 12 | – | Done: `docs/sample-card-{signal,afterhours,studio}.png` |
| 8 | Real-data review: the owner reads a real report and judges accuracy | RISKS 3 | Owner, quota | Runs done (v6, v9; latest render `tmp/p18/report.html`, not committed). Waiting for the owner's read. The all-`high` flag was fixed by item 10 |
| 9 | Delegated-prompt check: the owner confirms whether the repeated session openings are AI delegation | RISKS 2 | Owner | Done 2026-10-24: of 10 repeated openings the owner marked one as automated (`codex_exec dd4ff67f`, Codex acceptance runs started by a skill; 8 sessions excluded). The others are the owner's own reused requests and stay in |
| 10 | Confidence calibration: decide whether `high` should require support from several chunks, computed in `verify` rather than trusted from the model | Real-data run (all traits `high`); stage-3 review (one `high` on a single example) | Owner's read of item 8 | Done in plan 15: high needs 3 sessions across 2 weeks, medium 2 sessions; support shown per trait |

## Rules

- Items 2 and 3 change how quality is measured or produced: run the new rubric check against
  the stage-3 outputs first, so the baseline is known before the prompt changes.
- Item 3 is judged on the personas (deterministic rubric plus a blind review), with a hard call
  budget approved by the owner. Record the before/after counts of over-generalised claims.
- Items 8 and 9 involve the owner's real prompts. Nothing derived from them is committed. The
  tool may print counts and hashes, never content.

## Acceptance

- All rubric checks pass on every persona for both engines, including the new one.
- The over-generalisation count drops after item 3 without losing required concepts.
- `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` and `pnpm test:package` pass.
- RISKS.md reflects the current state of each item it mentions.
