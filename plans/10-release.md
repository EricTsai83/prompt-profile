# 10 · Release

**Status: pending.** The owner deferred the release on 2026-10-24 until the product work is done;
it is the last open plan. Plan 13 (product quality) is done: the owner read a real report on
2026-10-24 and accepted it for now. Publishing resumes only when the owner decides to publish. On 2026-10-24 the owner had the code part done ahead
of time (item 4: the tag-triggered workflow); nothing is published or tagged, and the owner's
npm / GitHub setup is not done. This section records where things stand.

### Already in the repository

- README with privacy notes, requirements, FAQ, sample card/report; MIT `LICENSE`;
  `docs/terms-check.md` (first pass, 2026-10-24); `SECURITY.md`; `RISKS.md`.
- `.github/workflows/ci.yml`, and `release.yml` triggered by a pushed `v*.*.*` tag (see
  "GitHub Actions" below), with `scripts/release-version.ts` checking the tag against
  `package.json` (tested in `test/scripts/`). release-please and its config are removed, so
  pushes to `main` run no release job. The workflow has not run yet: the first tag is its test.
- `pnpm test:package` installs the packed tarball and checks version, help, prompts, fonts,
  HTML, JSON, the 1200 × 630 PNG and a look. Tarball 159 KB; `--version` cold start ~0.9 s.
- `prompt-profile` is unclaimed on npm (404 on 2026-10-24).

### Still to do when the release resumes

1. Re-read the Anthropic and OpenAI terms and update `docs/terms-check.md` (RISKS 1).
2. Regenerate the README sample card/report if the product changed since (plans 13–18).
3. ~~Confirm CI passes on GitHub~~ — done: CI is green on `main` since 2026-10-24.
4. ~~Replace release-please with the tag-triggered workflow below~~ — done 2026-10-24
   (`release.yml`, `scripts/release-version.ts`, `test/scripts/release-version.test.ts`).
5. Owner: publish `0.1.0` by hand once, then register the Trusted Publisher (steps below).
6. Release `0.1.1` (or the next version) through the workflow; confirm the npm page shows
   provenance.
7. Clean-environment check: new container, logged-in `claude`, `npx prompt-profile` end to end.
8. Check the npm name again just before publishing.

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

Decided 2026-10-24: **a tag push releases**, modelled on T3 Code (`pingdotgg/t3code`,
`.github/workflows/release.yml` and `docs/operations/release.md`). This replaces release-please.

- Why: release-please opens a release PR, so it needs "Allow GitHub Actions to create and
  approve pull requests" (a repository-wide switch) or a PAT / GitHub App token. A tag push
  needs neither, and pushes to `main` no longer run a release job.
- The owner bumps the version locally: `npm version patch|minor|major` (or
  `npm version 0.2.0-beta.1`) changes `package.json` and creates the `vX.Y.Z` tag, then
  `git push --follow-tags`.
- Release notes: GitHub generates them when the release is created (Conventional Commit
  subjects since the previous tag). No `CHANGELOG.md` is kept.
- First version: `0.1.0`, published by hand (npm cannot register a Trusted Publisher for a
  package that does not exist yet).
- ~~Remove `release-please-config.json` and `.release-please-manifest.json`.~~ Done.

## GitHub Actions: `.github/workflows/release.yml`

Trigger: `push` of tags `v*.*.*`. Top-level `permissions: contents: read`; each job asks for
what it needs.

1. **Check** (read-only): the tag without `v` must equal `package.json` `version`, otherwise
   fail. A version with a suffix (`-beta.1`) is a prerelease with npm dist-tag `next`; a plain
   `X.Y.Z` uses `latest`.
2. **Verify**: `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `format:check`, `test`,
   `build`, `pnpm pack`, `scripts/test-package.mjs` on the tarball. Upload the tarball as an
   artifact so the publish step ships exactly what was tested.
3. **GitHub Release** (`contents: write`): create the release for the tag with generated notes,
   marked prerelease for suffixed versions, the tarball attached.
4. **npm publish** (`id-token: write`, only this job): download the tarball and run
   `npm publish <tgz> --provenance --access public --tag <latest|next>`. On failure, print a
   hint to check the Trusted Publisher registration.

Order matters, as in T3 Code: nothing is published unless every check passed, and npm comes
after the GitHub Release.

Not taken from T3 Code: nightly and preview channels and a scheduled run (one small package
does not need them), and committing version bumps back to `main` with a GitHub App (the version
is bumped locally before tagging, so there is nothing to write back).

### npm and GitHub setup (owner, once, when the release resumes)

1. Create an npm account with 2FA.
2. First publish by hand from a clean checkout: `npm login`, `pnpm build`,
   `pnpm pack --out prompt-profile.tgz`, `node scripts/test-package.mjs prompt-profile.tgz`,
   `npm publish prompt-profile.tgz --access public`.
3. npmjs.com → package `prompt-profile` → Settings → Trusted Publisher → GitHub Actions:
   user `EricTsai83`, repository `prompt-profile`, workflow file `release.yml`.
4. On the same page, require 2FA and disallow tokens, so only the workflow can publish.
5. GitHub: Workflow permissions stay at "Read repository contents and packages permissions";
   "Allow GitHub Actions to create and approve pull requests" stays off.

## Later (out of scope this time; direction only)

- **Standalone binaries**: `bun build --compile`, one each for darwin-arm64 / darwin-x64 / linux-x64 / linux-arm64 / win-x64, published to GitHub Releases. First confirm that the satori / resvg native modules can be bundled.
- **Homebrew**: create `EricTsai83/homebrew-tap` with a formula pointing to the GitHub Releases binaries.
- **install.sh**: `curl -fsSL …/install.sh | sh`.
- New adapters: Gemini CLI, Cursor, opencode… (see the list in ccusage's `rust/adapters/`). Only requires implementing `SourceAdapter` and registering it in the registry.
- Watching for upstream format changes: after every major Claude Code / Codex release, run `pnpm test:smoke` locally and check whether the exclusion counts of the filter rules suddenly change; then run `pnpm test:smoke:llm` (uses subscription quota) to confirm the CLI invocation and output format have not changed.

## Acceptance criteria

- [ ] In a clean environment (e.g. a new Docker container + a logged-in claude), `npx prompt-profile` runs from start to finish
- [ ] The npm package page shows provenance
- [ ] A pushed `vX.Y.Z` tag whose version differs from `package.json` fails before anything is published
      (the check is unit-tested and is the first job; still to be seen on a real tag push)
- [x] Pushes to `main` no longer run a release job (`release.yml` triggers only on `v*.*.*` tags)
