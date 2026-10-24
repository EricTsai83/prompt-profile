# prompt-profile development plan

## The product in one sentence

A CLI tool that reads the user's local Claude Code / Codex prompt history, **borrows the user's already-logged-in `claude` or `codex` CLI as the LLM** (no API key needed), and produces a "what kind of person are you" profile report locally (HTML + PNG card).

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
| Language / runtime | TypeScript, Node.js ≥ 22 (ESM) |
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
  report/         # html.ts, charts.ts, techniques.ts, card.ts, looks.ts, visibility.ts, messages.ts, fonts/
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

There are three independent version numbers. Bump them whenever the corresponding thing changes; the cache and `render` depend on them:

| Version | Location | Now | When to bump |
|---|---|---|---|
| `Profile.schemaVersion` | `domain/Profile.ts` | 8 | The `profile.json` format changes (`render` must be able to reject versions it does not understand; older versions are migrated) |
| `ANALYSIS_VERSION` | `analysis/version.ts` | 9 | `map.md` / `reduce.md` / `translate.md`, the chunk format or the LLM Schema change (part of the cache key) |
| `PIPELINE_VERSION` | `pipeline/version.ts` | 4 | clean / redact rules change (part of the cache key; chunk content is hashed too, so a filter change alone needs no bump) |
| `Look.version` / `RENDER_MANIFEST_VERSION` | `report/looks.ts` | 1 / 2 | A look's design or the `render.json` format changes (render only; not part of any cache key) |

## Execution order

Each plan can be handed to Claude Code / Codex independently, e.g. "Execute `plans/01-project-setup.md` and run the acceptance criteria when done."

| # | Plan | Output | Depends on | Status |
|---|---|---|---|---|
| 01 | [Project setup](./01-project-setup.md) | An empty project that builds, tests and lints + AGENTS.md | – | Done |
| 02 | [Domain and Schemas](./02-domain-schemas.md) | `PromptRecord`, `Profile` and other formats | 01 | Done |
| 06 | [LlmRunner](./06-llm-runner.md) | Structured JSON via `claude` / `codex` | 02 | Done |
| 03 | [Claude Code adapter](./03-adapter-claude-code.md) | Clean Claude Code prompts | 02 | Done |
| 04 | [Codex adapter](./04-adapter-codex.md) | Clean Codex prompts | 02 | Done |
| 05 | [Pipeline: filter, clean, redact, stats](./05-pipeline.md) | `Stats` + prompts that are safe to send | 03 (hook up 04 once it is done) | Done |
| 07 | [Analysis flow](./07-analysis.md) | `profile.json` | 05, 06 | Done (owner's read → 13 item 8) |
| 08 | [Report output](./08-report.md) | HTML report + PNG card | 02 | Done |
| 09 | [CLI integration and UX](./09-cli.md) | The complete `prompt-profile` command | 05, 07, 08 | Done (built-binary run → 10) |
| 11 | [Profile customization UX](./11-profile-customization-ux.md) | Research: looks, stories, model comparison | 09 | Done (stage 4 skipped by the owner) |
| 12 | [Looks and share-card privacy](./12-looks-and-share-card.md) | `--look`, `--card-hide`, `render` variants | 11 | Done |
| 13 | [Product quality](./13-product-quality.md) | Grounded profiles, real-data checks, polish | 12 | Done except item 8 (**owner**) |
| 14 | [Report redesign and languages](./14-report-redesign-and-languages.md) | Charts, en / zh-TW switch, activity by project | 13 | Done |
| 15 | [Profile storytelling](./15-profile-storytelling.md) | Identity-first report (share page later replaced by 18) | 14 | Done |
| 16 | [Prompt coaching](./16-prompt-coaching.md) | Verified improvements and signals | 15 | Done |
| 17 | [AI technique profile](./17-ai-technique-profile.md) | How I work with AI, progress since last report | 16 | Done |
| 18 | [One report and output check](./18-unified-report-and-output-check.md) | `--exclude` parts, final secret / personal-data check | 17 | Done |
| 10 | [Release](./10-release.md) | npm package on tag pushes + CI | 13 item 8, 18 | **Pending** (owner decides when) |

**06 goes first**: "borrowing the user's `claude` / `codex` to produce structured JSON" is the biggest technical risk of the whole product (Schema compatibility, hooks / MCP interference, history pollution). Finish the 06 smoke test first and confirm both CLIs accept the JSON Schema produced by plan 02 before investing in other plans. If 06 shows that one of the CLIs is not viable, go back and adjust the LLM Schema in 02.

After 02, plans 03 / 04 / 06 / 08 are independent of each other and can proceed in parallel.

### First milestone: walking skeleton

When 03 + 05 + 07 are done (before 04 and 08), first run `pnpm dev --out tmp` on real Claude Code data to produce a `profile.json` and read it yourself. **If the profile quality is poor, tune `map.md` / `reduce.md` first; do not rush into the report layout.**

## Shared rules for every plan

- Write tests first (TDD); tests verify behaviour only, not internal structure.
- **Fixtures must not contain real prompt content**: always use hand-written fake data, but follow the real format's field structure.
- Smoke tests that read real local data go in `test/smoke/` and skip automatically when no data is found (they always skip on CI).
- When each plan is done: `pnpm typecheck && pnpm lint && pnpm test` must all pass.
- External data formats (Claude Code / Codex JSONL, CLI stdout) are always treated as **untrusted and subject to change**: parse them with lenient Schemas, skip and count failures, and never let the whole flow fail.
- Any derived data written to the user's disk (cache, reports) contains personal information: directories `0700`, files `0600`; write to a temporary file first and then rename (to avoid leaving a broken file if interrupted).
- Commits use Conventional Commits; a plan can be split into several small commits.


## What is left, in order

1. **Owner: read a real report** (plan 13 item 8): `prompt-profile-report/report.html` from a
   fresh run, or `tmp/p18/report.html`. Findings become a new plan (prompt or rule changes bump
   `ANALYSIS_VERSION` / `PIPELINE_VERSION`).
2. **Owner: decide the product is ready to publish.** Until then nothing in plan 10 is done.
3. **Plan 10, Release**, in its listed order: terms re-check, samples, the tag-triggered
   workflow (replacing release-please), first manual publish + Trusted Publisher, then a
   release through the workflow and the clean-environment check (which also covers plan 09's
   built-binary run).

New work gets the next plan number, a `Status:` line at the top, and acceptance boxes that are
ticked (with where the evidence lives) when the plan is done.
