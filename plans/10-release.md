# 10 · Release

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
