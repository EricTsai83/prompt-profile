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
| Output | `profile.json` (the core format) → HTML report + PNG share card |
| Customization | As little as possible; only the necessary options |
| Not doing (for now) | skills / plugins, web share links, accounts, API-key mode |

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
  pipeline/       # filter.ts, clean.ts, redact.ts, stats.ts
  llm/            # LlmRunner interface + claude / codex / fake implementations + detect.ts
  analysis/       # chunk.ts, map.ts, reduce.ts, verify.ts, cache.ts, prompts/
  report/         # html.ts, card.tsx, i18n.ts, fonts/
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

| Version | Location | When to bump |
|---|---|---|
| `Profile.schemaVersion` | `domain/Profile.ts` | The `profile.json` format changes (`render` must be able to reject versions it does not understand) |
| `ANALYSIS_VERSION` | `analysis/version.ts` | `map.md` / `reduce.md`, the chunk format or the LLM Schema change (part of the cache key) |
| `PIPELINE_VERSION` | `pipeline/version.ts` | clean / redact rules change (part of the cache key) |

## Execution order

Each plan can be handed to Claude Code / Codex independently, e.g. "Execute `plans/01-project-setup.md` and run the acceptance criteria when done."

| # | Plan | Output | Depends on |
|---|---|---|---|
| 01 | [Project setup](./01-project-setup.md) | An empty project that builds, tests and lints + AGENTS.md | – |
| 02 | [Domain and Schemas](./02-domain-schemas.md) | `PromptRecord`, `Profile` and other formats | 01 |
| 06 | [LlmRunner](./06-llm-runner.md) | Structured JSON via `claude` / `codex` | 02 |
| 03 | [Claude Code adapter](./03-adapter-claude-code.md) | Clean Claude Code prompts | 02 |
| 04 | [Codex adapter](./04-adapter-codex.md) | Clean Codex prompts | 02 |
| 05 | [Pipeline: filter, clean, redact, stats](./05-pipeline.md) | `Stats` + prompts that are safe to send | 03 (hook up 04 once it is done) |
| 07 | [Analysis flow](./07-analysis.md) | `profile.json` | 05, 06 |
| 08 | [Report output](./08-report.md) | HTML report + PNG card | 02 |
| 09 | [CLI integration and UX](./09-cli.md) | The complete `prompt-profile` command | 05, 07, 08 |
| 10 | [Release](./10-release.md) | npm package + CI | 09 |

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


## Follow-up research

- [11 — Profile customization UX](./11-profile-customization-ux.md): explore content directions,
  report layouts and model comparisons; define user choices, fixed product guarantees and
  screenshot-based validation before implementing new customization controls.
