# prompt-profile development plan

## The product in one sentence

A CLI tool that reads the user's local Claude Code / Codex prompt history, **borrows the user's already-logged-in `claude` or `codex` CLI as the LLM** (no API key needed), and produces an evidence-backed portrait of how a person collaborates with AI locally (HTML + PNG card).

```bash
npm i -g prompt-profile   # or npx prompt-profile
prompt-profile
```

## Settled product decisions

| Item | Decision |
|---|---|
| Form | A plain CLI tool published to npm; standalone binaries / Homebrew later (no code changes) |
| LLM | No API key. Runs the user's local `claude -p` or `codex exec` in the background |
| Data sources (MVP) | Claude Code, Codex |
| Privacy | Everything is processed locally; sensitive information is redacted before being sent to the LLM; analysis calls are not written to the user's history |
| Output | `profile.json` (the core format) → one HTML report + PNG cards, one per language (plans 14, 18) |
| Customization | As little as possible: render-only looks and card hiding (plan 12), languages (plan 14), report parts left out with `--exclude` and the final output check (plan 18) |
| Not doing (for now) | shipping as a Claude Code skill / plugin, web share links, accounts, API-key mode |

## Tech Stack

| Part | Choice |
|---|---|
| Language / runtime | TypeScript, Node.js ≥ 24 (ESM) |
| Package management | pnpm (with catalogs and supply-chain security settings enabled, modelled on ccusage) |
| Core framework | **Effect 4** (`effect@4.0.x`): `effect/cli`, Schema, Stream, FileSystem, `effect/process` |
| Node platform layer | `@effect/platform-node` |
| Bundling | tsdown |
| Testing | vitest + `@effect/vitest`, fixtures + snapshots (modelled on ccusage) |
| Lint / Format | oxlint + oxfmt |
| Card | satori + @resvg/resvg-wasm |

> `effect/cli` is marked `@stability unstable` in Effect 4: **pin the exact version** and handle upgrades deliberately.
> Before writing Effect code, check the JSDoc examples in `node_modules/effect/dist/**/*.d.ts`; do not write Effect 3 APIs from memory.

## Architecture

```
local data ──► adapters ──► pipeline ──────────► analysis ──────► report
              (claude-code,  (clean → redact →    (chunk → map →   (profile.json →
               codex)         stats)               reduce, cache)    HTML + PNG)
                                                       │
                                                   LlmRunner
                                             (ClaudeCodeRunner | CodexRunner)
```

```
src/
  bin.ts          # the single entry point (tsdown entry); only calls cli/main.ts
  cli/            # effect/cli command definitions and UX (main.ts, commands/, steps.ts, options.ts, render-error.ts)
  domain/         # PromptRecord, Stats, Profile and other Schemas (depends on no other directory)
  adapters/
    common/       # shared: SourceAdapter interface, JSONL streaming reader, dedup
    claude-code/
    codex/
    registry.ts   # the list of all adapters; adding a source only touches this file
  pipeline/       # filter.ts, clean.ts, redact.ts, stats.ts, techniques.ts, audit.ts (final output check)
  llm/            # LlmRunner interface + claude / codex / fake implementations + detect.ts
  analysis/       # chunk.ts, map.ts, reduce.ts, verify.ts, translate.ts, cache.ts, prompts/
  report/         # html.ts, charts.ts, techniques.ts, card.ts, looks.ts, theme.ts, theme-css.ts, visibility.ts, messages.ts, fonts/
  platform/       # Environment service, private file writes, cache folder
test/
  fixtures/       # fake data for each adapter (must not contain real personal data)
  smoke/          # reads real local data / calls the real CLIs; skipped automatically on CI
```

### Module boundaries (the key to long-term maintenance)

Dependencies may only point to the right, never back:

```
cli ──► analysis ──► llm ──► domain
  │        │                   ▲
  ├──► pipeline ───────────────┤
  ├──► adapters ───────────────┤
  └──► report ─────────────────┘
```

- `domain/` holds only Schemas and pure functions and imports no other directory.
- `adapters/` does not know the LLM exists; `analysis/` depends only on the `LlmRunner` **interface** and does not know whether it is claude or codex.
- `report/` only consumes `Profile`, so the `render` subcommand can run without any analysis.
- "Extensible lists" (adapters, runners, redaction rules, correction phrases, injected-content prefixes) are all **data** (arrays); adding an item does not require changing flow code.

### Version numbers

These version numbers are independent. Bump them whenever the corresponding thing changes; the cache and `render` depend on them:

| Version | Location | Now | When to bump |
|---|---|---|---|
| `Profile.schemaVersion` | `domain/Profile.ts` | 18 | The `profile.json` format changes (`render` must be able to reject versions it does not understand; older versions are migrated) |
| `ANALYSIS_VERSION` | `analysis/version.ts` | 24 | `map.md` / `merge.md` / `reduce.md` / `review.md` / `translate.md`, the chunk format or the LLM Schema change (part of the cache key) |
| `PIPELINE_VERSION` | `pipeline/version.ts` | 5 | clean / redact rules change (part of the cache key; chunk content is hashed too, so a filter change alone needs no bump) |
| `Theme.version` / `RENDER_MANIFEST_VERSION` | `report/theme.ts` / `report/looks.ts` | classic 19, others 25 / 3 | A look's design (its theme entry) or the `render.json` format changes (render only; not part of any cache key) |
| `PRICING_VERSION` | `pipeline/pricing.ts` | 2026-10-29 | A list price is added or changed (stored with the costs in `profile.json`; not part of any cache key) |

## Open plans

`plans/` holds only unfinished plans. A finished plan is deleted, together with its row here,
in the change that finishes it; it stays in git history. Plans 01–21 and 23–27 are done
and deleted. To read one: `git log --oneline -- 'plans/<file>'`, then
`git show <commit>^:plans/<file>` on the commit that deleted it (`git log --diff-filter=D
--name-only -- plans/` lists every deleted plan).

Each plan can be handed to Claude Code / Codex independently, e.g. "Execute
`plans/27-<name>.md` and run the acceptance criteria when done."

| # | Plan | Output | Depends on | Status |
|---|---|---|---|---|
| 22 | [Profile experiment comparison](22-profile-experiment-comparison.md) | Repeatable local experiments comparing engines, models and analysis options, with rendered outputs, structured differences and provenance | `scripts/eval.ts`; coordinates with plans 20 and 21 | Tool implemented and run against real CLIs ([usage](../docs/experiments.md)); local-history snapshots pending |
| 33 | [Command experience and run accounting](33-command-experience-and-run-accounting.md) | Deepsec-inspired command lifecycle, per-execution usage/cost summaries, recovery records and an optional cost stop threshold | Existing Effect runners, progress, pricing and report library; coordinates with plan 22 | Planned; source review complete |
| 34 | [Report interactions](34-report-interactions.md) | Clear, accessible optional interactions with distinct open/closed states | Existing offline report | Planned |

## Shared rules for every plan

- Write tests first (TDD); tests verify behaviour only, not internal structure.
- **Fixtures must not contain real prompt content**: always use hand-written fake data, but follow the real format's field structure.
- Smoke tests that read real local data go in `test/smoke/` and skip automatically when no data is found (they always skip on CI).
- When each plan is done: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` must all pass.
- External data formats (Claude Code / Codex JSONL, CLI stdout) are always treated as **untrusted and subject to change**: parse them with lenient Schemas, skip and count failures, and never let the whole flow fail.
- Any derived data written to the user's disk (cache, reports) contains personal information: directories `0700`, files `0600`; write to a temporary file first and then rename (to avoid leaving a broken file if interrupted).
- Commits use Conventional Commits; a plan can be split into several small commits.


## What is left, in order

The remaining product exploration is listed below. These are planned tasks, not claims that
features have shipped. Each remaining plan can be executed separately; explicit dependencies and acceptance criteria
define its handoff. Plan 20 is complete; its usage, owner amendments and limitations are in the
[collaboration guide](../docs/collaboration-experience.md). Plan 21 is closed by owner decision
(see the [closeout](../docs/ux/report-redesign/output-roles.md#owner-closeout--2026-10-29)),
and plan 22 remains the experiment tooling owner.

### Recommended execution batches

1. **Make reports useful after reading:** plan 27 is complete ([usage](../docs/collaboration-experiments.md)); the completed library and evidence foundation are available. A dedicated sharing workflow was removed by owner decision (see below).
2. **Support recurring reflection:** project/context retrospectives are implemented
   ([usage and limits](../docs/context-retrospectives.md)); comparable-window history is reused.
3. **Evaluate with local snapshots:** plan 22's optional local-history snapshots remain separate
   from the completed fictional collaboration calibration. Owner use can refine priorities.
4. **Explain each execution:** plan 33 extends the command lifecycle and run accounting using
   reviewed Deepsec patterns. Deliver summaries and recovery before the optional cost threshold.

### Ownership at shared boundaries

- The completed episode foundation owns schemas/provenance; the completed [claim calibration](../docs/ux/model-comparison/claim-support.md) owns semantic-support evaluation, not a
  duplicate episode pipeline. The completed collaboration foundation owns roles; the calibration record provides authored cases.
- The completed plan 25 established the [identity/factual content contract](../docs/ux/report-redesign/purpose-contract.md); the durable report design records guide visual iteration. Both use one production renderer and the existing looks.
- Completed plan 27 delivers [optional report experiments](../docs/collaboration-experiments.md).
- The completed library and comparison foundation owns history and longitudinal comparability; the completed [context retrospectives](../docs/context-retrospectives.md) add scoped selection only.
- The owner is the current reader. Iterate together through owner use and feedback, supported
  by fictional cases and automated checks. External participants and reader studies are not
  prerequisites; automated checks do not establish human comprehension.

Plan 28 (reviewed collaboration preference export) was removed by owner decision on
2026-10-31, rather than completed. Collaboration suggestions and prompt rewrites belong in
the report; do not add acceptance/rejection, preference export or configuration installation
workflows. See the [report scope decision](../docs/collaboration-experiments.md#owner-scope-decision--2026-10-31).

Plan 29 (shareable identity export workflow) was removed by owner decision on
2026-10-31, rather than completed. Users can adapt the existing HTML report with AI;
a dedicated selection, preview and export workflow does not currently justify its complexity.
Do not reintroduce that workflow without an explicit owner request. Existing rendering,
exclusions and output audit remain available.

Plan 30 (reader annotations and disagreement) was removed by owner decision on
2026-10-31, rather than completed. The product should quickly turn local prompt history into
an evidence-backed report; users can use AI to edit its content themselves. Do not add a
dedicated annotation editor, persistent feedback artifacts or cross-analysis comment tracking
without an explicit owner request. Focus on the accuracy, evidence and clarity of the generated
report.

Plan 32 (external reader research) was removed by owner decision on 2026-10-29, rather than
completed. Its protocol and fictional rehearsal were discarded. Do not reintroduce participant
recruitment, interviews or follow-up requirements without an explicit owner request.

Mark progress in the owning plan and cross-reference evidence in dependent plans; do not implement
competing systems for the completed collaboration foundation.
All existing privacy, evidence, language and module-boundary rules apply to every batch.

Released: `0.1.1` on npm (Trusted Publisher, provenance) and GitHub Releases
with standalone binaries, 2026-10-24; how to release is in [CONTRIBUTING.md](../CONTRIBUTING.md).

Ideas, not planned yet:

- Homebrew: `EricTsai83/homebrew-tap` with a formula pointing to the GitHub Releases binaries.
- `install.sh`: `curl -fsSL …/install.sh | sh`.
- Experiments (plan 22) could show the API list-price equivalent per case, reusing
  `pipeline/pricing.ts` with its `PRICING_VERSION`; `render` could offer an explicit re-price.
- New adapters: Gemini CLI, Cursor, opencode… (see ccusage's `rust/adapters/`); implement
  `SourceAdapter` and register it in `adapters/registry.ts`.

New work gets the next plan number (never reuse a deleted plan's number), a `Status:` line at
the top, and acceptance boxes. When every box is ticked, delete the plan file and its row in the
same change, and fix links that pointed to it.
