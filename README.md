# prompt-profile

Analyze your past prompts from AI coding agents (Claude Code, Codex) locally and generate a
personal profile.

![Synthetic sample share card](docs/sample-card.png)

[Sample HTML report](https://erictsai83.github.io/prompt-profile/sample-report.html)
· [Sample profile JSON](docs/sample-profile.json) (all sample data is hand-written and fictional).

### A real report

The author's own report, from about 1,700 real prompts over six months, published as written:

- [Full report](https://erictsai83.github.io/prompt-profile/demo/full/report.html): what you see on your own machine, with quotes from
  real prompts, suggested rewrites, project names, exact dates and fun facts.
- [Shareable report](https://erictsai83.github.io/prompt-profile/demo/without-personal/report.html): the same profile rendered with
  `--exclude personal`: no quotes, rewrites or fun facts, projects shown as "Project A, B…",
  dates by month. This is what you would post publicly.

The share card is the same for both: it never contains quotes or project names. The full report
in every look (`--look`; render only, no new analysis):

| [Classic](https://erictsai83.github.io/prompt-profile/demo/full/report.html) (default) | [Signal](https://erictsai83.github.io/prompt-profile/demo/signal/report.html) |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ![Classic card](docs/demo/card.png)                                                    | ![Signal card](docs/demo/signal/card.png)                                     |
| [Afterhours](https://erictsai83.github.io/prompt-profile/demo/afterhours/report.html)  | [Studio](https://erictsai83.github.io/prompt-profile/demo/studio/report.html) |
| ![Afterhours card](docs/demo/afterhours/card.png)                                      | ![Studio card](docs/demo/studio/card.png)                                     |

## Quick start

1. Install [Claude Code](https://claude.com/claude-code) or [Codex](https://github.com/openai/codex)
   and log in once (`claude`, or `codex login`). prompt-profile uses it to analyse your prompts;
   **no API key needed**.
2. Run it (Node.js ≥ 22):

   ```bash
   npx prompt-profile@latest
   ```

   `@latest` makes npx fetch the newest version instead of reusing one it cached earlier.

3. It reads your local history, shows how many prompts it found and how many CLI calls the
   analysis will take, and asks `Continue?`. The calls use your Claude / ChatGPT subscription
   quota. To see what would be sent first, run `npx prompt-profile@latest --dry-run` (calls nothing).
4. When it is done, the report opens in your browser. Everything is written to
   `./prompt-profile-report/`.

Want to look around for free first? `npx prompt-profile@latest stats` shows statistics without any LLM
call.

## Install

```bash
npx prompt-profile@latest       # run without installing (always the newest version)
npm i -g prompt-profile         # or install the `prompt-profile` command
prompt-profile --help
npm i -g prompt-profile@latest  # update the installed command
```

No Node.js? Every [GitHub Release](https://github.com/EricTsai83/prompt-profile/releases) has a
standalone executable for macOS (`darwin-arm64` for Apple silicon, `darwin-x64`), Linux
(`linux-x64`, `linux-arm64`) and Windows (`windows-x64`), with a `SHA256SUMS` file. Download the
archive for your platform from the release page, then:

```bash
tar -xzf prompt-profile-<version>-darwin-arm64.tar.gz
./prompt-profile-<version>-darwin-arm64/prompt-profile
# macOS, if the archive was downloaded with a browser (the binary is not notarised):
xattr -d com.apple.quarantine ./prompt-profile-<version>-darwin-arm64/prompt-profile
```

On Windows, `tar -xzf` works in PowerShell too; run `prompt-profile.exe` from the extracted
folder. Move the executable to a folder on your `PATH` to run it as `prompt-profile`.

## Requirements

- Node.js ≥ 22, or the standalone executable (no Node.js needed)
- [Claude Code](https://claude.com/claude-code) (`claude`) or [Codex](https://github.com/openai/codex)
  (`codex`) installed and logged in
- **No API key needed**: the analysis runs your own logged-in `claude -p` or `codex exec` in the
  background and **uses your subscription quota**. The base call estimate is shown
  before confirmation. Intermediate merges and up to two retries per call can add calls;
  use `--max-calls` to set a hard limit on CLI invocations, including retries.

## What you get

Written to `./prompt-profile-report/` (change it with `--out`):

- `report.html`: your private, single-file report that works offline:
  - who you are: archetype, a 24-hour clock of your busiest hours, four measured habits with
    their definitions, your top traits with a quote each and how widely they are supported
  - **how to improve your prompts**: 2–4 suggestions, each with a real prompt of yours and a
    suggested rewrite, plus signals such as frequent corrections or very short follow-ups
  - **how you work with AI**: a capability map (plan, delegate, extend, verify, ship) with the
    skills you used and what each does, subagent types, MCP servers, models, pull requests,
    parallel sessions and prompt-writing habits; counted from tool metadata and the skill
    descriptions recorded in your transcripts, never tool inputs, outputs or skill arguments
  - what changed since your last report, a daily calendar and a weekday × hour heatmap (hover
    or tap for the count and main projects), project chapters, the five dimensions, and how it
    was measured
  - a language switch when there is more than one language

  It shows everything by default, quotes and project folder names included. To share it, leave
  parts out with `--exclude` (below).

- `card.png`: a 1200 × 630 share card in the default language, plus `card.<lang>.png` for each
  other language (**omits evidence quotes**)
- `profile.json`: the raw profile data (re-create the report with `prompt-profile render`)

### Leaving parts out

`--exclude` (on the main command and on `render`) takes a comma list:

| Part           | Left out                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `quotes`       | Evidence quotes and the before / after rewrites                                                      |
| `projects`     | Project names, shown as "Project A, B…", also inside the generated text and on the card              |
| `dates`        | Exact dates: no daily calendar, the data period by month                                             |
| `coaching`     | "Improve your prompts" and "since your last report"                                                  |
| `funfacts`     | Fun facts                                                                                            |
| `custom-names` | Names and descriptions of your own skills, custom agent types and private MCP servers (only counted) |
| `personal`     | All of the above                                                                                     |

```bash
prompt-profile render prompt-profile-report/profile.json --exclude personal
# → prompt-profile-report/variants/classic-without-personal/report.html; the full report is kept
```

### The final check

Before anything is written, every displayed text of the profile (generated text, quotes,
rewrites, names, skill descriptions) is checked with the same rules that redact prompts before
the LLM sees them. The terminal says where and which rule — never the matched text:

```
  Contains  34 quotes · 8 project names · exact dates · 4 improvements · 3 fun facts
  Check  2 masked: email (Traits › 2), home-path (Fun facts › 1)
  Before sharing, skim the quotes yourself: the check is rule-based.
```

|               | Rules                                                                                                   | `--check mask` (default) | `--check warn` | `--check strict`         |
| ------------- | ------------------------------------------------------------------------------------------------------- | ------------------------ | -------------- | ------------------------ |
| Secrets       | private keys, API tokens, JWTs, bearer tokens, connection strings, `password=`… , random-looking tokens | masked                   | masked         | nothing written (exit 1) |
| Personal data | email, home path, username, internal URL, phone, Taiwan ID, credit card                                 | masked                   | kept, listed   | nothing written (exit 1) |

`--allow email,phone` skips personal rules (e.g. a public address you want shown); secrets can
never be allowed. The masked profile is what is written: `profile.json`, the report and the
cards agree.

## Usage

```bash
prompt-profile                 # analyse the last 6 months and write the report
prompt-profile --since 3m      # 1m / 3m / 6m / 1y / all (also <n>d, <n>w)
prompt-profile --engine codex  # which CLI analyses your prompts (default: auto, Claude Code first)
prompt-profile --model <name>  # model passed to claude / codex
prompt-profile --out <dir>     # output folder
prompt-profile --max-calls 40  # cap CLI invocations, including merges and retries
prompt-profile --full          # no sampling, analyse everything (slower, uses more quota)
prompt-profile --no-cache      # do not read the analysis cache
prompt-profile --yes           # skip the confirmation (required in non-interactive sessions)
prompt-profile --dry-run       # write what would be sent to the LLM into --out, call nothing
prompt-profile --verbose       # full errors and LLM call timings
prompt-profile --lang zh-TW,en # report languages, the first is the default (en, zh-TW)
prompt-profile --look signal   # classic (default) / signal / afterhours / studio
prompt-profile --card-hide stats,graphic  # leave traits / stats / graphic out of card.png

prompt-profile stats                  # statistics only, no LLM (free and fast)
prompt-profile render profile.json    # re-create the report from an existing profile.json
prompt-profile cache clear            # delete the analysis cache

prompt-profile render profile.json --look studio --card-hide stats
                                      # a new look, written to variants/studio-no-stats/
```

Looks and `--card-hide` only change how the report and card are drawn: no new analysis and no
LLM calls, and the original report is kept. `--card-hide` changes the share card only; the
private report and `profile.json` still contain everything, including quotes. The card never
contains quotes or project names in any look.

Languages: without `--lang`, a Chinese system locale gives a Traditional Chinese report with an
English switch (`zh-TW,en`); any other locale gives English. The profile is written in English
and then translated, one extra CLI call per extra language; quotes stay as you wrote them.

Exit codes: `0` success · `1` error · `2` usage / needs `--yes` · `3` no data · `4` no usable LLM
CLI · `5` rate limited · `130` interrupted (a re-run resumes from the cache).

## Privacy

**Files read** (read-only):

| Source      | Paths (override with an environment variable)                                   |
| ----------- | ------------------------------------------------------------------------------- |
| Claude Code | `~/.claude/projects/*/*.jsonl`, `~/.claude/history.jsonl` (`CLAUDE_CONFIG_DIR`) |
| Codex       | `~/.codex/sessions/**/rollout-*.jsonl`, `~/.codex/history.jsonl` (`CODEX_HOME`) |

**Prompt selection and preprocessing**: adapters select user prompts, excluding recognized system
messages, tool output and sub-agent conversations, then:

- pasted code / logs are collapsed into `[pasted code: N lines]`
- API keys, tokens, passwords, private keys, connection strings, emails, phone numbers, national
  IDs, credit card numbers, internal URLs, UUIDs / hashes, home-folder paths and usernames that
  match the supported rules are redacted **before** anything is sent (and before long
  prompts are shortened); this is best-effort, not a guarantee that every secret is found
- projects are reduced to their folder name, never the full path
- `prompt-profile --dry-run` previews selected map chunks; generated observations, statistics
  used by the final step, system instructions and retry messages are not a complete network dump

Selected, cleaned and redacted prompt text is sent **off your machine** through your logged-in
CLI to its model service, along with project basenames. Intermediate observations, supporting
quotes and usage statistics are sent during merge/final analysis. Text that does not match a
redaction rule can remain unchanged, including names and confidential prose.

Reports, `profile.json`, dry-run exports and analysis caches are written locally and are not
uploaded by prompt-profile. They can contain personal information. Created folders use `0700`
and files use `0600`; existing folder permissions are not changed. `cache clear` removes analysis
entries only, and reports deletion errors rather than claiming success. Delete reports and dry-run
exports separately when no longer needed.

Claude runs with safe mode, tools disabled, strict MCP configuration and disabled hooks. Codex
runs with `--ignore-user-config`, disabled hooks/notifications, a read-only sandbox and an ephemeral
session. Codex still uses your existing login, but user-configured providers and model defaults
are ignored; specify the model with `--model`. Both use fresh temporary working folders.
Administrator policy, environment settings and CLI/provider diagnostics can still apply. These
controls are tested on specific versions, and do not promise zero CLI/provider logs or traffic.
See [runner notes](src/llm/NOTES.md) and the [security policy](SECURITY.md).

prompt-profile has no telemetry. The report makes no network requests and its fonts ship with
the package. The one exception is the Chinese share card: on first use it downloads Noto Sans TC
(about 11 MB, from a pinned GitHub commit), checks its SHA-256 and caches it; no prompt data is
sent. The borrowed CLI manages its own network requests and provider data retention.

## FAQ

**How much quota does it use?** By default at most 30 chunks (about 40,000 characters each) are
analysed, plus intermediate merges for large histories and one final call. Each call may retry
twice. The displayed count is a base estimate, not an upper bound; `--max-calls` limits total CLI
invocations rather than tokens, provider requests or money.
Chunks analysed before are read from the cache on the next run.

**Can I use an API key?** Not at the moment: by design it only borrows your logged-in CLI.

**Is the report accurate?** Every trait and dimension cites quotes from your prompts, and the
program checks that each quote really exists in them. Invalid and duplicate quotes are removed;
multiple excerpts of one prompt do not count as independent support, and high-confidence traits
require support from multiple sessions. Quote matching does not prove the interpretation is correct.
Dimensions without verified quotes are marked as insufficiently supported.

**Why are some prompts not counted?** Short acknowledgements ("ok", "continue"), resent duplicates,
notifications sent by the tools themselves, long templates repeated across sessions, and slash
commands of sessions that contain nothing else (scripts and tools) are excluded. Each run shows
how many were excluded.

**My prompts are not in English.** That is fine: prompts in any language are analysed (Chinese
gets extra handling for acknowledgements and corrections). The report comes in English and
Traditional Chinese (`--lang`, see [Usage](#usage)); quotes stay in their original language.

prompt-profile is not affiliated with or endorsed by Anthropic or OpenAI.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md) and [plans/](plans/README.md).
CI covers Linux (Node.js 22/24) and macOS (Node.js 24); Windows is unverified.
CLI behavior was checked with Claude Code 2.1.309 and codex-cli 0.164.0; upgrade the CLI if an
isolation flag is not recognized. `pnpm test:package` checks the installed npm tarball, including
bundled prompts, fonts, WASM rendering and file permissions.

## License

MIT
