# 19 · Standalone binaries

Status: in progress (2026-10-24). Asked for by the owner ahead of the release; ships with
[plan 10](./10-release.md)'s tag-triggered workflow.

## Goal

People without Node.js can run `prompt-profile`: a single executable per platform, attached to
the GitHub Release of every `vX.Y.Z` tag next to the npm tarball (T3 Code ships its `t3` CLI
the same way). npm stays the main channel.

## Design

- **Build**: `bun build --compile` of `src/standalone.ts`, cross-compiled from one Linux runner
  for the targets in `scripts/build-binaries.ts` (a data array): darwin-arm64, darwin-x64,
  linux-x64, linux-arm64, windows-x64. Bun is pinned in the workflow; it is not needed for
  development.
- **Assets**: the npm build reads prompts, fonts and the resvg wasm from files next to
  `dist/bin.js`. A binary has no such files, so the build embeds them
  (`Bun.embeddedFiles`) and `src/standalone.ts` registers them before starting the CLI.
  `platform/assets.ts` returns a registered asset, otherwise reads the file as before; the npm
  build does not change.
- **Archive**: `prompt-profile-<version>-<target>.tar.gz` with the executable, `LICENSE`,
  `README.md` and the fonts' OFL licences, plus one `SHA256SUMS`.
- **Workflow**: a `binaries` job, beside `verify`, builds every target, runs the same CLI checks as
  the package check on the native linux-x64 binary, and uploads the archives; the GitHub Release
  attaches them. The release waits for the binaries, so a failed binary build stops the npm
  publish too: nothing ships half-done. CI builds and checks the linux-x64 binary on every push,
  so a runtime file the binary does not embed is caught before a tag.

## Out of scope

- Code signing and notarisation (macOS) or Authenticode (Windows): binaries downloaded with a
  browser get the macOS quarantine flag; the README shows how to clear it. Revisit if users ask.
- Homebrew tap and `install.sh` (they need a published release first).

## Acceptance

- [x] `platform/assets.ts` is tested: a registered asset wins, otherwise the file is read.
- [x] `pnpm build:binaries` builds every target; the native binary passes the CLI checks
      (version, help, offline render of HTML + 1200 × 630 PNG, a look) with no files beside it.
- [x] `pnpm test:package` still passes (npm build unchanged).
- [x] The darwin-arm64 binary, outside the checkout, ran `stats`, `--dry-run` and a real
      `claude` call on the owner's data (one chunk mapped; 2026-10-24; nothing kept).
- [ ] A real tag push attaches five archives and `SHA256SUMS` to the GitHub Release (with plan
      10's first workflow release).
