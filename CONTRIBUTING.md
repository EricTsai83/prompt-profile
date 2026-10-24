# Contributing

Start with [AGENTS.md](AGENTS.md) for module boundaries, TDD, private file writes and language
rules. [plans/README.md](plans/README.md) explains the product decisions and cache versions.

## Setup and checks

Use Node.js 22 or 24 and pnpm (the exact pnpm version is in `package.json`).

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm test --project analysis  # choose the module you changed
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
pnpm test:package            # builds, packs, installs in a clean folder, and exercises the CLI
```

Write a failing behavior test before changing code, and verify that it fails without the fix.
Use Conventional Commits. Explain the user-visible behavior and validation in pull requests.
Update `ANALYSIS_VERSION`, `PIPELINE_VERSION` or the profile schema version when applicable.

## Privacy and fixtures

Never attach real prompt histories, reports, dry-run chunks, caches, credentials or full CLI
logs to issues or pull requests. Reproduce problems with short, hand-written fake records.
Keep the real field layout and replace all personal and project-specific values.

`pnpm test:smoke` reads real local data but prints no content. Run it for adapter or pipeline
changes. `pnpm test:smoke:llm` uses subscription quota: run it only for CLI invocation or output
format changes. It includes positive-control hook/MCP sentinels in temporary folders; it does
not change your CLI configuration. The Codex isolation probe requires a file-backed login and
references `auth.json` with a temporary symlink. No credentials are copied into fixtures.

## Analysis quality

```sh
pnpm eval --engine claude --persona curious-learner
pnpm eval --engine codex --model <model>
```

These commands use subscription quota. Each persona has synthetic `prompts.json`, a human
review checklist (`expected.md`) and deterministic gates (`rubric.json`). Results, model and
analysis version are written privately under `eval-output/`. A failed analysis or quality gate
makes the command exit nonzero. Gates check expected concepts in generated claims, forbidden
inferences, quote retention, trait count and dimensions without evidence. Review the report
against `expected.md` too: keyword checks cannot establish that a claim follows from a quote.

## Supported environments

CI covers Linux with Node.js 22 and 24, and macOS with Node.js 24. Windows is currently unverified.
The borrowed CLIs are independently released; tested versions and isolation limitations are in
[src/llm/NOTES.md](src/llm/NOTES.md). Include your OS, Node version and CLI versions in bug reports.
New CLI flags may require a newer version than the minimum Node runtime.

## Report preview

`pnpm dev:report` renders the synthetic sample into `tmp/report/`. The checked-in example in
[docs/sample-report.html](docs/sample-report.html) and [docs/sample-card.png](docs/sample-card.png)
comes only from `test/fixtures/profile.sample.json`. Regenerate it after changing report layout:

```sh
pnpm dev render test/fixtures/profile.sample.json --out tmp/sample-preview
mv tmp/sample-preview/report.html docs/sample-report.html
mv tmp/sample-preview/card.png docs/sample-card.png
mv tmp/sample-preview/profile.json docs/sample-profile.json
pnpm format
```

## Releasing (maintainer)

A pushed `vX.Y.Z` tag releases; pushes to `main` never do.

```sh
npm version patch   # or minor / major / 0.2.0-beta.1; bumps package.json and tags vX.Y.Z
git push --follow-tags
```

[`release.yml`](.github/workflows/release.yml) then checks that the tag equals the
`package.json` version, runs every check, packs and tests the tarball, builds the standalone
binaries, creates the GitHub Release (generated notes, tarball, binaries, `SHA256SUMS`) and
only then publishes to npm through the Trusted Publisher, with provenance. A suffixed version is
a prerelease on the npm dist-tag `next`. If any job fails, nothing is published: fix it on
`main`, move the tag (`git push origin :refs/tags/vX.Y.Z`, `git tag -f vX.Y.Z`, push it again)
as long as neither the GitHub Release nor npm has the version. If only `npm-publish` failed,
use "Re-run failed jobs": it publishes the tarball that was tested.

npm accepts a publish with `202` and may need a few minutes before `npm view` shows it.

## Upstream CLI changes

After a major Claude Code or Codex release, run `pnpm test:smoke` and look for sudden changes in
the filter rules' exclusion counts, then `pnpm test:smoke:llm` (uses subscription quota) to
confirm the CLI invocation and output format still work.
