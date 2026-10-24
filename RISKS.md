# Concerns and risks from implementation

This list records the places where, while implementing `plans/01`–`10`, I made a decision on my own judgement but you should know about it (or need to confirm it yourself later).
Sorted by severity.

## 🔴 High: must be handled before release

1. **The terms of service still have grey areas** (see [`docs/terms-check.md`](./docs/terms-check.md))
   - Anthropic's official terms explicitly allow "a user signing in to the **unmodified** Claude Code binary with their own subscription", which is exactly how this tool uses it;
     but they also say subscription OAuth is meant for "ordinary use", and since 2026 several third-party harnesses have been blocked from using subscription quota.
     One analysis run makes about 10–30 automated calls; whether that counts as ordinary use is not clearly defined, and **it may be restricted later**.
   - No OpenAI terms were found that explicitly forbid or allow it.
   - I only read the official terms pages and a few news articles. **This is not legal advice**; please read the originals yourself before release.

2. **Delegated subtasks (AI-written prompts) are excluded by an owner-confirmed list** (`DELEGATION_OPENINGS` in `src/pipeline/filter.ts`)
   - On 2026-10-24 the owner reviewed the 10 repeated session openings with `pnpm inspect:openings` and marked one as automated (`codex_exec dd4ff67f`, 8 sessions); the others are the owner's own reused requests. Only the key is stored, never the text.
   - Other users' orchestrators may write different openings; `DELEGATION_PATTERNS` stays empty until such a pattern is known.
   - `topSlashCommands` works in the CLI (5 commands on the owner's data, 2026-10-24).

3. **Profile quality needs your own assessment** (plan 07's manual acceptance, plan 13 item 8)
   - Full 6-month runs on your real data with Claude (v6, v9 bilingual): every chunk succeeded and every quote passed verification; persona evals ran on both engines.
     The latest render is `tmp/p18/report.html` (git-ignored). **Please read it and judge whether it is accurate**; prompt changes go into
     `src/analysis/prompts/map.md` / `reduce.md` with an `ANALYSIS_VERSION` bump.

4. **The release has not been exercised yet**
   - CI (`.github/workflows/ci.yml`) is green on `main`. `release.yml` now runs only on a pushed `vX.Y.Z` tag (plan 10) and has never run: the first tag will be its first real test.
   - Publishing first requires a manual first publish and npm Trusted Publishing (plan 10).
   - Publishing must use `pnpm pack`: `npm pack` / `npm publish` do not understand `catalog:` versions and produce a broken package
     (the release workflow handles this; be careful when publishing manually).

## 🟠 Medium: functional trade-offs

5. **Exceptions in dependency versions and supply-chain settings**
   - The `effect@4.0.6` family was published only the day before the build, violating `minimumReleaseAge: 2880` (2 days); I used
     `minimumReleaseAgeExclude` to make an exception for these **exact versions** only.
   - `@types/node@22` pulls in an `undici-types` with a trust downgrade, which `trustPolicy: no-downgrade` blocks, so `@types/node@24` is used instead.
   - `esbuild`'s install script is explicitly disabled (`allowBuilds: esbuild: false`), and everything currently works.
   - `effect/cli` and `effect/process` are marked unstable; check them whenever Effect is upgraded.

6. **Large install size**: the tarball is only 159 KB (111 KB before the 41 KB display font for the looks in plan 12), but `node_modules` after install is about **117 MB** (effect, satori, resvg wasm),
   so the first `npx prompt-profile` download takes a while. `--version` cold start is about 0.9 seconds.

7. **CLAUDE.md / AGENTS.md may influence the analysis**: testing showed that `claude -p` loads `CLAUDE.md` from the cwd.
   We run in an empty temporary directory and ask the system prompt to ignore other instructions, but the user's **global**
   `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` may still affect the output style (best effort).

8. **Rate-limit detection is speculative**: rate limits cannot be reproduced locally; `classify.ts` decides by HTTP 429/529 and keywords,
   and the Codex rate-limit fixture was hand-written from the error format rather than captured for real. A misclassification becomes `ProcessFailed` (exit 1) instead of exit 5.

9. **Codex does not report the actual model name**: `codex exec --json` does not report the model, so the Codex model in the report is `null` (unless `--model` is used).

10. **Redaction rules "prefer over-redacting"**, so both false positives and misses are possible:
    - UUIDs (`[UUID]`) and 32+ digit hex strings (`[HASH]`, including git commit hashes) are redacted deliberately. Your data has about 800 UUIDs.
    - The phone rule may mistake some digit strings for phone numbers; the national ID rule does not validate the check digit.
    - The high-entropy string rule already excludes kebab-case names (branches / worktrees), but may still miss keys with unusual formats.
    - Suggestion: before release, use `--dry-run` once to look at what is actually sent.

11. **Sampling and chunking details**
    - A week's "month" is determined by the Thursday of its ISO week (weeks spanning two months belong to the month containing the Thursday); the plan did not specify this.
    - After sampling, the actual number of chunks may be **fewer** than 30 (at most one chunk is picked per time interval).

## 🟡 Low: deviations from the plans, or small unfinished items

12. **Schema tweaks**: `Stats` gained `activityGrid` (7×24; the heatmap needs the joint weekday × hour distribution, and there were only two independent histograms);
    `Stats.dateRange` became nullable (when there is no data in the window). Since nothing has been released yet, `schemaVersion` is still 1.
13. **The analysis marker is only matched at the start**: the plan says "skip if the text contains `[prompt-profile:analysis]`"; I changed it to "skip only if it starts with it",
    otherwise real prompts in which you mention this string while developing this tool would be dropped by mistake.
14. **Extra Claude Code filter rules** (not listed in the plan, but found in real data): `isMeta`, `isCompactSummary` (AI-generated conversation summaries),
    `origin.kind: task-notification`, `turnOrigin: scheduled / peer`; files under `subagents/` are also not read.
15. **The eval personas are mostly smaller than specified**: 4 personas, three with 31–45 prompts and `weekend-data-engineer` with 82 (the plan asks for 50–150).
16. **The report's light / dark modes were checked in Chrome and in WebKit 26.5** (Safari's engine, through Playwright) for every look at 1440 and 390 px on 2026-10-24: no overflow, no requests, display font loaded. Not yet opened in the Safari app itself.
17. **"Clean environment (Docker) + `npx prompt-profile` from start to finish" and npm provenance** have not been verified (they require publishing first).
18. **Font source**: Noto Sans TC is downloaded from GitHub raw (pinned commit `165c01b`) and its SHA-256 is verified; if GitHub changes its raw URL policy,
    the Chinese card can no longer be generated (the report is unaffected). The Inter font is embedded in the package under the OFL licence. (Removed when the product became English-only, and restored with the same pinned URL and SHA-256 for the zh-TW card in plan 14.)
19. **oxfmt rewrites `html\`\``templates**:`embeddedLanguageFormatting`is disabled in`.oxfmtrc.json`; keep an eye on this when updating oxfmt.
20. **Standalone binaries (bun compile) are not yet considered**: `map.md`, the fonts and the resvg wasm are all read from the file system at runtime, which needs separate handling when bundling into a single executable.
