# User guide

Installation and the first run are covered in the [README](../README.md).
This guide covers options, sharing, recovery and privacy.

## Standalone installation

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

## Usage

```bash
prompt-profile                 # analyse the last 3 months and write the report
prompt-profile --since 3m      # 1m / 3m / 6m / 1y / all (also <n>d, <n>w)
prompt-profile --engine codex  # which CLI analyses your prompts (default: auto, Claude Code first)
prompt-profile --model <name>  # model passed to claude / codex
prompt-profile --effort medium # reasoning effort: low / medium / high / xhigh / max (default: the CLI's)
prompt-profile --out <dir>     # output folder
prompt-profile --max-calls 40  # cap CLI invocations, including merges and retries
prompt-profile --full          # no sampling, analyse everything (slower, uses more quota)
prompt-profile --no-cache      # do not read the analysis cache
prompt-profile --yes           # skip the confirmation (required in non-interactive sessions)
prompt-profile --dry-run       # free: the summary, plus what would be sent written into --out
prompt-profile --verbose       # full errors and LLM call timings
prompt-profile --lang zh-TW,en # report languages, the first is the default (en, zh-TW)
prompt-profile --avatar explorer # auto / planner / explorer / coordinator / verifier / neutral / none
prompt-profile --look signal   # classic (default) / signal / afterhours / studio / prism / slate / folio
prompt-profile --card-hide stats,graphic  # leave traits / stats / graphic out of card.png
prompt-profile --name Eric     # title the report "Eric’s prompt profile" (not stored in profile.json)

prompt-profile stats                  # statistics only, no LLM (free and fast)
prompt-profile render profile.json    # re-create the report from an existing profile.json
prompt-profile cache clear            # delete the analysis cache

prompt-profile render profile.json --look studio --card-hide stats
                                      # a new look, written to variants/studio-no-stats/
```

Looks, `--avatar` and `--card-hide` only change how the report and card are drawn: no new analysis and no
LLM calls, and the original report is kept. `--card-hide` changes the share card only; the
private report and `profile.json` still contain everything, including quotes. The card never
contains prompt quotes in any look. Project names follow the same `--exclude projects` choice
as the report.

Languages: without `--lang`, a Chinese system locale gives a Traditional Chinese report with an
English switch (`zh-TW,en`); any other locale gives English. The profile is written in English,
reviewed once against its source evidence, and then translated, one extra CLI call per extra language; quotes stay as you wrote them.

Each analysis includes one evidence-review call after drafting the profile. It checks for
omitted contextual preferences and unsupported outcome or cost claims before translation.
Bounded excerpts of already-redacted cited prompts supply context omitted by shorter quotes.
The CLI call estimate includes it, and `--max-calls` counts it. If review fails or the budget
runs out, no unreviewed report is published. Model review reduces risk; it does not certify
semantic truth. Rendering an existing profile does not run this review or spend quota.

Exit codes: `0` success · `1` error · `2` usage / needs `--yes` · `3` no data · `4` no usable LLM
CLI · `5` rate limited · `130` interrupted (a re-run resumes from the cache).

Each successful analysis is retained beneath `reports/` in a [local report library](history-library.md).
Open the output root's `index.html` for history. The CLI prints the current profile path;
archived renders go to appearance variants. `prompt-profile history --out prompt-profile-report`
repairs the index without analysis. Standalone profiles remain supported.
See the [collaboration guide](collaboration-experience.md) for original artwork, evidence
limits, narrative planning and when historical windows can be compared.

## Sharing and output checks

`--exclude` (on the main command and on `render`) takes a comma list:

| Part           | Left out                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `quotes`       | Evidence quotes and the before / after rewrites                                                      |
| `projects`     | Project names, shown as "Project A, B…", also inside the generated text and on the card              |
| `dates`        | Exact dates: no daily calendar, the data period by month                                             |
| `coaching`     | "Improve your prompts" and "since your last report"                                                  |
| `funfacts`     | Fun facts                                                                                            |
| `custom-names` | Names and descriptions of your own skills, custom agent types and private MCP servers (only counted) |
| `usage`        | Plans, token counts and API list-price equivalents                                                   |
| `personal`     | All of the above                                                                                     |

```bash
prompt-profile render prompt-profile-report/profile.json --exclude personal
# → prompt-profile-report/variants/classic-without-personal/report.html; the full report is kept
```

### Final output check

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

## Small histories and stopped runs

**Small histories.** A role, featured observations and prompt coaching each need verified quotes
from at least two sessions (the same rule that sets trait confidence and preference axes). When
nothing in a profile reaches that, the report is titled "Early observations": it states how many
prompts and sessions it is based on, keeps the observations, five dimensions and measurements,
and leaves out the generated role and the "Improve your prompts" section. The card does the same.
The terminal says so after the run; a longer `--since` range or more history adds evidence.

**If a run stops.** Progress is shown by phase (chunks, merges, the final profile including review,
verification, translations, writing files); there is no time estimate. When a run stops early, the error says
what was saved and prints the exact command to run again:

| What happened                                                         | What is saved                                           | What a re-run does                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Ctrl-C, rate limit, timeout, malformed output, too many failed chunks | Finished chunk results in the analysis cache; no report | Reuses cached chunks and merges; drafting, evidence review and translations run again |
| `--max-calls` reached                                                 | Same; cached results do not use the budget again        | Same; raise `--max-calls` if it stops again                                           |
| The final profile step failed                                         | Chunk results                                           | Repeats drafting, evidence review and translation calls                               |
| An intermediate merge failed (large histories)                        | Chunk results and finished merges                       | Repeats the unfinished merges, then drafting, evidence review and translations        |
| A translation failed                                                  | The report, without that language                       | The printed command adds it (final profile + evidence review + translation)           |
| A card was not created (e.g. the Chinese font download failed)        | The report and `profile.json`                           | `prompt-profile render <profile.json>` retries the cards, no analysis                 |

The re-run command keeps your flags and leaves out `--no-cache`, so it reads the cache. When
prompt-profile was started with npx, the printed commands start with `npx prompt-profile@<version>`
(the same version, so the cache matches); otherwise with the installed `prompt-profile`.
A CLI's own error message can quote what it was sent, so it is shown only with `--verbose`.

## Privacy

**Files read** (read-only):

| Source      | Paths (override with an environment variable)                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Claude Code | `~/.claude/projects/*/*.jsonl`, `~/.claude/history.jsonl` (`CLAUDE_CONFIG_DIR`)                                    |
| Codex       | `~/.codex/sessions/**/rollout-*.jsonl` (and zstd-compressed `.jsonl.zst`), `~/.codex/history.jsonl` (`CODEX_HOME`) |

**Usage and plan** (the "Usage during this period" section): token counts and model names from
the same logs (Claude Code subagent transcripts in `projects/*/*/subagents/` included), the plan
from `claude auth status --json` (`subscriptionType` only), an undocumented rate-limit hint from
`~/.claude.json` (`oauthAccount.userRateLimitTier` only), and the ChatGPT plan type from
`~/.codex/auth.json`, decoded locally from the id token's payload. No token, API key, email,
account or organization id is stored, cached, logged or sent; a missing or unreadable file gives
"unknown", never an error. Usage, plans and amounts stay on your machine: they are not sent to
the LLM. Amounts are computed from an embedded list-price table (no download) and are an **API
list-price equivalent**: what the usage would cost on the public API, not what you paid. Responses in fast mode (Claude
`speed: "fast"`, Codex priority) use the fast-mode list prices, and a model or tier without a
listed price stays "unknown" rather than being estimated.

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
quotes and prompt statistics are sent during merge/final analysis. Text that does not match a
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
See [runner notes](../src/llm/NOTES.md) and the [security policy](../SECURITY.md).

prompt-profile has no telemetry. The report makes no network requests and its fonts ship with
the package. The one exception is the Chinese share card: on first use it downloads Noto Sans TC
(about 11 MB, from a pinned GitHub commit), checks its SHA-256 and caches it; no prompt data is
sent. The borrowed CLI manages its own network requests and provider data retention.

## Execution summaries and cost stops

Each analysis now saves a private execution record, including failures without a report.
Use `prompt-profile history --executions --out <directory>` to find its JSON path.
`--max-calls` caps admitted CLI invocations, including retries. Claude Code also supports
`--max-cost-usd <amount>` as a local measured-cost stop threshold; concurrent work may overshoot,
and unknown cost stops further work. Codex rejects this monetary setting before model calls.
See [execution accounting and recovery](execution-accounting.md) for the versioned record,
coverage states, free operations, privacy exclusions and restart behavior.
