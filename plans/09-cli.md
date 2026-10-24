# 09 · CLI integration and user experience

Status: implemented; later flags in plans 12, 14 and 18. Acceptance checked 2026-10-24.

## Goal

Wire the earlier modules into the complete `prompt-profile` command. By default it runs to completion **without any arguments or configuration**.

## Command design

```bash
prompt-profile                 # main usage: analyze and produce a report
prompt-profile --since 3m      # analysis window (default 6m; supports 1m / 3m / 6m / 1y / all)
prompt-profile --engine codex  # which CLI to analyze with (default: auto-detect, preferring claude)
prompt-profile --model <name>  # model to use (passed through to claude / codex)
prompt-profile --lang en       # report language (default from system locale: zh-* → zh, otherwise → en)
prompt-profile --out <dir>     # output directory
prompt-profile --full          # no sampling, analyze everything (slower, uses more quota)
prompt-profile --no-cache
prompt-profile --yes           # skip the confirmation step (for automation)
prompt-profile --dry-run       # run only up to chunking, write "what would be sent to the LLM" to --out, no LLM calls
prompt-profile --verbose       # show full errors and the duration of every LLM call
prompt-profile --version / --help

prompt-profile stats           # show statistics only, no LLM calls (fast, free)
prompt-profile render <profile.json>  # regenerate the report from an existing profile.json
prompt-profile cache clear     # delete the analysis cache (it contains prompt excerpts)
```

(Removed later: the product is English-only, so `--lang` and the locale-based language choice no longer exist.)

- `stats` also accepts `--since` and `--out`, and outputs `stats.json`.
- `--dry-run` outputs `chunks/*.txt` and `plan.json`: lets privacy-conscious users check what will be sent, and makes tuning `map.md` easier.
- Options follow the principle of "fewer": before adding one, ask whether the default could simply do the right thing.

## Main flow and screens

```
◆ prompt-profile v0.1.0

● Reading data
  Claude Code   3,412 prompts · 207 sessions
  Codex           812 prompts · 273 sessions
● Cleaning and redaction
  Excluded 2,104 as noise (too short / system messages / duplicates)
  Redacted 37 sensitive items (SECRET 12 · EMAIL 9 · paths 16)
● Analysis window: last 6 months · 1,980 prompts → 18 chunks
  Analyzing with Claude Code (logged in), about 19 calls, using your subscription quota

? Continue? (Y/n)

● Analyzing ████████░░░░ 12/18 chunks (3 from cache)
● Merging profile…
● Verifying evidence: kept 41 / 44

✔ Done!
  Report   ./prompt-profile-report/report.html (opened in browser)
  Card     ./prompt-profile-report/card.png
  Data     ./prompt-profile-report/profile.json
```

- The confirmation step uses `effect/cli`'s `Prompt` (check the `.d.ts` for the API). The confirmation screen shows plan 07's `AnalysisPlan` (chunk count, cache hits, expected number of calls).
- **In a non-TTY environment (e.g. CI, a pipe) without `--yes`, exit immediately and suggest adding `--yes`**. Do not assume consent: this command spends the user's subscription quota and should not run without the user noticing.
- Progress display: in non-TTY mode, switch to plain text with one line per step.
- When done, open the HTML in the system default browser (macOS `open`, Linux `xdg-open`, Windows `start`); failure to open is not an error. Do not open it in non-TTY mode.
- **Ctrl-C**: interrupt all in-flight LLM subprocesses (plan 06), keep finished chunks in the cache, print "Interrupted; a rerun will resume from the cache", exit code 130.

## Error messages (friendly, and telling the user the next step)

| Situation | Key points of the message |
|---|---|
| No prompt data found at all | Explain which paths are searched, and that `CLAUDE_CONFIG_DIR` / `CODEX_HOME` can override them |
| Neither claude nor codex installed | Explain that one of them is required, with install links; mention that `prompt-profile stats` needs no LLM |
| Installed but not logged in | Suggest running `claude` or `codex login` |
| Rate limited | Everything analyzed so far is cached; rerunning later resumes where it stopped |
| Some chunks failed | Still produce the report, and say how many chunks were skipped |

All errors are typed Effect errors, converted to messages at the CLI's outermost layer (`src/cli/render-error.ts`) through an exhaustive mapping; when a new error type is added, TypeScript forces a message to be added. The full error for debugging is shown only with `--verbose`.

Exit codes: `0` success (including partial chunk failures), `1` general error, `2` invalid arguments, `3` no data found, `4` no usable LLM (not installed / not logged in), `5` rate limited, `130` interrupted by the user.

## Implementation requirements

- `src/cli/main.ts`: defines the commands; `src/cli/commands/*.ts`: one file per command, wiring adapters → pipeline → llm → analysis → report; `src/cli/steps.ts`: steps shared by commands; `src/cli/options.ts`: parsing of flag values.
- commands and steps only wire things together and hold no business logic; every decision (whether to sample, whether to retry) belongs to the earlier modules.
- Compose all services with Layers; everything environment-related (home directory, environment variables, timezone, current time, whether stdout is a TTY, `PATH`) is obtained through services so tests can replace it.
- Tests swap in the fixture adapter + `FakeLlmRunner` + an in-memory cache.
- Never show Effect stack traces directly to the user.

## Tests

- E2E: fixture data + `FakeLlmRunner` → run the full `prompt-profile --yes --out <temp dir>` and confirm all three files are produced.
- One test per error situation, with a snapshot of the output message.
- One test each for `stats`, `render`, `cache clear`, `--dry-run`; `render` shows an explicit message when it reads an unrecognized `schemaVersion`.
- Refuses to run in non-TTY mode without `--yes`.
- Interruption (simulate a call that never finishes with `FakeLlmRunner`, then interrupt): exit code 130, finished chunks kept in the cache.

## Acceptance criteria

- [x] All tests pass
- [ ] Manual (with the release, plan 10 step 7): run `pnpm build && node dist/bin.js` locally from start to finish, and check the resulting report yourself
- [x] Run with `claude` removed from PATH and see the correct hint (covered by the CLI test and its snapshot)
