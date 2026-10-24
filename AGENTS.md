# AGENTS.md

`prompt-profile` is a CLI: it reads the user's local Claude Code / Codex prompt history,
borrows the user's logged-in `claude` / `codex` CLI as the LLM, and writes a personal profile
report locally (`profile.json` → HTML + PNG).

Product decisions, architecture and the development plan: [`plans/README.md`](./plans/README.md).

## Layout

```
src/
  bin.ts          the only entry point; just calls cli/main.ts
  cli/            effect/cli commands and UX: main.ts (flags), commands/ (one flow per command),
                  steps.ts (steps shared by commands), options.ts (flag parsing),
                  messages.ts (every printed line), render-error.ts
  domain/         schemas and pure functions (PromptRecord, Stats, Profile…); imports no other folder
  adapters/       read each source's local data → PromptRecord (common/, claude-code/, codex/, registry.ts)
  pipeline/       filter → clean → redact → truncate, plus stats
  llm/            LlmRunner interface + claude / codex / fake runners + detect.ts (NOTES.md: CLI behaviour)
  analysis/       chunk → map → verify → merge → reduce, the cache and prompts/*.md
  report/         Profile → HTML report + PNG card (messages.ts: every text)
  platform/       environment (Environment service), private file writes, cache folder
test/
  <module>/       unit tests per src/ module
  fixtures/       hand-written fake data (never real personal data)
  smoke/          real local data / real CLIs; skipped when missing
```

Dependencies: `cli → analysis → llm → domain`; `cli → pipeline / adapters / report → domain`.
`domain/` depends on nothing else; `analysis/` only on the `LlmRunner` interface; `report/` only
consumes `Profile`.

## Commands

```bash
pnpm install
pnpm build          # tsdown → dist/bin.js
pnpm dev            # tsx src/bin.ts
pnpm typecheck
pnpm lint           # oxlint; warnings fail too
pnpm format         # oxfmt rewrites; format:check only checks (CI)
pnpm test           # unit tests (CI)
pnpm test:changed   # only tests affected by uncommitted changes
pnpm test:smoke     # real local data (free, seconds; local only)
pnpm test:smoke:llm # calls the real claude / codex (uses subscription quota, minutes;
                    # only when a CLI or its output format changed)
```

### Choosing tests by module

`test/<module>/` mirrors `src/<module>/`; each folder is a vitest project (scanned by
`vitest.config.ts`). While developing run only what is relevant, then everything before a
commit:

| Situation                             | Command                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| Changed one module                    | `pnpm test --project <module>` (e.g. `analysis`)                |
| Changed several modules / unsure      | `pnpm test:changed` (import graph of uncommitted changes)       |
| Before a commit / CI                  | `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` |
| Changed an adapter or a pipeline rule | also `pnpm test:smoke` (real data, prints no content)           |
| Changed how `llm/` calls a CLI        | also `pnpm test:smoke:llm` (uses subscription quota)            |

`domain/` is used by every module: when it changes, run everything. A new module only needs a
folder of the same name in `test/`.

Before finishing any step, `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` must
pass. Judge a test run by its exit code and the `Test Files` count, not only `Tests`: a file
that fails to load is not counted in `Tests`.

## Rules

- **TDD**: write the test first; tests check behaviour, not internal structure. A new test must
  fail without the change it covers — check it.
- **No real personal data in fixtures**: hand-written fake data with the real field layout.
  Smoke tests never print or snapshot real content.
- **Effect 4**: `effect@4.0.x` (exact version). Before writing Effect code, read the JSDoc
  examples in `node_modules/effect/dist/**/*.d.ts`; do not write Effect 3 APIs from memory
  (e.g. `Context.Service`, `effect/cli`, `effect/process`).
- External formats (Claude Code / Codex JSONL, CLI stdout, a user's `profile.json`) are
  untrusted: lenient schemas; bad data is skipped **and counted**.
- Derived data written to the user's disk (cache, report): folders we create `0700`, files
  `0600`, written to a temp file then renamed. Never change permissions of existing folders.
- "Extensible lists" (adapters, redaction rules, correction phrases, injected prefixes, generic
  usernames) are data arrays.
- When the profile format, an analysis prompt or a clean / redact rule changes, bump the
  matching version (see "Versions" in `plans/README.md`).
- **Language**: everything in the repository (code, comments, docs, commits) and the CLI's
  terminal messages are English. The report and card are multilingual (plan 14): their texts
  live in `src/report/messages.ts` per language, generated text is translated by
  `analysis/translate.ts`. Other Chinese appears only as input data: rules that handle Chinese
  prompts and test data built from such prompts. Exception: `.claude/skills/` holds the owner's
  personal workflow files, kept as written.
- Commits use Conventional Commits.
- **Plans**: `plans/` holds only unfinished plans. When a plan is done, delete its file and its
  row in `plans/README.md` in the same change; it stays readable in git history. Fix links that
  pointed to it.
