# 01 · Project setup

## Goal

Create an empty project that builds, tests and lints, and write the `AGENTS.md` for AI agents.

## Steps

1. **package.json**
   - `"name": "prompt-profile"`, `"type": "module"`, `"bin": { "prompt-profile": "./dist/bin.js" }`
   - `"engines": { "node": ">=22" }`, `"packageManager": "pnpm@10.x"` (use the local version)
   - `"files": ["dist"]`
   - scripts: `build` (tsdown), `dev` (`tsx src/bin.ts`; always use tsx to avoid strip-types differences between Node 22 / 24), `typecheck` (`tsc --noEmit`), `lint` (oxlint), `format` (oxfmt), `test` (vitest run), `test:smoke`
2. **pnpm-workspace.yaml** (used for settings even though this is a single package, modelled on ccusage)
   ```yaml
   catalogMode: strict
   minimumReleaseAge: 2880   # only install packages published at least 2 days ago
   strictDepBuilds: true
   blockExoticSubdeps: true
   trustPolicy: no-downgrade
   allowBuilds: {}   # no dependency currently needs to run an install script; justify any addition in the PR
   ```
   > If the local pnpm version does not support a field, remove it and note this in the commit message.
3. **Install dependencies** (`effect` and `@effect/platform-node` pinned to exact versions, no `^`)
   - dependencies: `effect@4.0.6`, `@effect/platform-node@4.0.6`
   - devDependencies: `typescript`, `tsdown`, `vitest`, `@effect/vitest`, `oxlint`, `oxfmt`, `@types/node`
   - Card-related packages (satori, resvg) wait until plan 08.
4. **tsconfig.json**: `strict: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2023"`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax: true`
5. **tsdown.config.ts**: entry `src/bin.ts`, output ESM to `dist/`, add the shebang `#!/usr/bin/env node`.
6. **Minimal CLI**: `src/bin.ts` only calls `src/cli/main.ts`; `main.ts` uses `effect/cli`'s `Command.make("prompt-profile")` + `Command.run` with the `@effect/platform-node` runtime and layer, and only prints the version.
   - Before writing it, read the JSDoc examples for `make` and `run` in `node_modules/effect/dist/cli/Command.d.ts`.
   - Read the version from `package.json` (tsdown injects a constant at build time); do not hard-code it.
7. **Test skeleton**: `test/cli.test.ts`, passing arguments via `Command.runWith`, verifying that `--version` prints the version.
8. **AGENTS.md** (repository root, for AI agents), containing:
   - The project's purpose (linking to `plans/README.md`)
   - The directory structure and each directory's responsibility
   - Commands: `pnpm build / test / lint / typecheck`
   - Rules: TDD, no real personal data in fixtures, check `.d.ts` for Effect 4 APIs, Conventional Commits
   - Also create `CLAUDE.md` containing the single line `@AGENTS.md`
9. **.gitignore**: `node_modules`, `dist`, `.prompt-profile/`, `coverage`
10. **GitHub Actions**: `.github/workflows/ci.yml`, running `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build` on `ubuntu-latest` × Node 22 / 24 and `macos-latest` × Node 24.

## Acceptance criteria

- [ ] `pnpm build` succeeds and `node dist/bin.js --version` prints the version
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all pass
- [ ] `AGENTS.md`, `CLAUDE.md` and the CI workflow exist
- [ ] GitHub Actions passes after push
