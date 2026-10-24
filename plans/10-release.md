# 10 · Release

**Status: pending.** The owner deferred the release on 2026-10-24 until the product work is done
(see [plan 13](./13-product-quality.md)); it is the last plan in the execution order. Nothing is
pushed or published. The checklist below is unchanged from the original plan; this section
records where things stand.

### Already in the repository

- README with privacy notes, requirements, FAQ, sample card/report; MIT `LICENSE`;
  `docs/terms-check.md` (first pass, 2026-10-24); `SECURITY.md`; `RISKS.md`.
- release-please config and manifest (first version `0.1.0`); `.github/workflows/ci.yml` and
  `release.yml` (pack with `pnpm pack`, publish with provenance through Trusted Publishing).
- `pnpm test:package` installs the packed tarball and checks version, help, prompts, fonts,
  HTML, JSON, the 1200 × 630 PNG and a look. Tarball 159 KB; `--version` cold start ~0.9 s.
- `prompt-profile` is unclaimed on npm (404 on 2026-10-24).

### Still to do when the release resumes

1. Re-read the Anthropic and OpenAI terms and update `docs/terms-check.md` (RISKS 1).
2. Regenerate the README sample card/report if the product changed since (plan 13).
3. Push to GitHub; confirm CI passes there for the first time (RISKS 4).
4. Owner: set up npm Trusted Publishing (OIDC) and release-please permissions.
5. Merge the release PR; confirm the npm page shows provenance.
6. Clean-environment check: new container, logged-in `claude`, `npx prompt-profile` end to end.
7. Check the npm name again just before publishing.

## Goal

Publish to npm so users can run `npm i -g prompt-profile` or `npx prompt-profile`, and lay the groundwork for adding standalone binaries and Homebrew later.

## Pre-release checks

- [ ] **Re-check the terms of service**: read the latest Anthropic (Claude Code / Claude consumer terms) and OpenAI (Codex / ChatGPT terms) versions, confirm that "a third-party CLI calling the user's own logged-in `claude` / `codex` on the user's machine" is allowed, and record the conclusion in `docs/terms-check.md`.
- [ ] Confirm the name `prompt-profile` is available on npm (`npm view prompt-profile`); if not, use a scope (e.g. `@erictsai83/prompt-profile`) and keep the `bin` name `prompt-profile`.
- [ ] README: one-sentence description, screenshots (report and card), installation, **privacy notes** (which files are read, what is sent to the LLM, what never leaves the machine), requirements (Node ≥ 22, logged in to Claude Code or Codex), FAQ.
- [ ] LICENSE (MIT).
- [ ] `npm pack --dry-run` confirms the package contains only `dist/` and necessary files (including `map.md` / `reduce.md`, the embedded Latin font, the resvg wasm), and no fixtures, plans or tests.
- [ ] Record the package size and the cold-start time of `npx prompt-profile --version` in the PR (`npx` users download it every time).
- [ ] Confirmed that `prompt-profile` is currently unused on npm (404 as of 2026-10); check again before publishing.

## Versioning and changelog

- Use Changesets or release-please (pick one; release-please is recommended, as it generates the changelog automatically from Conventional Commits).
- First version: `0.1.0`.

## GitHub Actions: `.github/workflows/release.yml`

- When the release PR is merged: build → test → `npm publish --provenance --access public`.
- Use npm Trusted Publishing (OIDC); do not store an npm token in the repo.

## Later (out of scope this time; direction only)

- **Standalone binaries**: `bun build --compile`, one each for darwin-arm64 / darwin-x64 / linux-x64 / linux-arm64 / win-x64, published to GitHub Releases. First confirm that the satori / resvg native modules can be bundled.
- **Homebrew**: create `EricTsai83/homebrew-tap` with a formula pointing to the GitHub Releases binaries.
- **install.sh**: `curl -fsSL …/install.sh | sh`.
- New adapters: Gemini CLI, Cursor, opencode… (see the list in ccusage's `rust/adapters/`). Only requires implementing `SourceAdapter` and registering it in the registry.
- Watching for upstream format changes: after every major Claude Code / Codex release, run `pnpm test:smoke` locally and check whether the exclusion counts of the filter rules suddenly change; then run `pnpm test:smoke:llm` (uses subscription quota) to confirm the CLI invocation and output format have not changed.

## Acceptance criteria

- [ ] In a clean environment (e.g. a new Docker container + a logged-in claude), `npx prompt-profile` runs from start to finish
- [ ] The npm package page shows provenance
