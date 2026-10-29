# prompt-profile

Read your past prompts from AI coding agents (Claude Code, Codex) on your computer, analyse them
with the `claude` or `codex` CLI you are already logged in to, and get a personal profile report.
Reading, cleaning, redaction and the report happen locally; the selected, redacted prompts are sent
through that CLI to its model service and use your subscription quota (no API key).

![Synthetic sample share card](https://erictsai83.github.io/prompt-profile/sample-card.png)

[Sample HTML report](https://erictsai83.github.io/prompt-profile/sample-report.html)
· [Sample profile JSON](https://erictsai83.github.io/prompt-profile/sample-profile.json) (all sample data is hand-written and fictional;
every example is rendered by the current code on each change to `main`).

### Example reports

The same fictional profile, rendered two ways:

- [Full report](https://erictsai83.github.io/prompt-profile/demo/full/report.html): what you see on your own machine, with prompt
  quotes, suggested rewrites, project names, exact dates and fun facts.
- [Shareable report](https://erictsai83.github.io/prompt-profile/demo/without-personal/report.html): the same profile rendered with
  `--exclude personal`: no quotes, rewrites or fun facts, projects shown as "Project A, B…",
  dates by month. This is what you would post publicly.

The card never contains prompt quotes. Project names may appear in normal mode;
`--exclude projects` (also included in `--exclude personal`) anonymizes known project names
in both the report and card, including generated identity text. The full report
in every look (`--look`; render only, no new analysis):

<table>
  <tr>
    <td width="50%" align="center">
      <a href="https://erictsai83.github.io/prompt-profile/demo/full/report.html"><img src="https://erictsai83.github.io/prompt-profile/demo/full/card.png" width="420" alt="Classic card"></a><br>
      <a href="https://erictsai83.github.io/prompt-profile/demo/full/report.html">Classic</a> (default)
    </td>
    <td width="50%" align="center">
      <a href="https://erictsai83.github.io/prompt-profile/demo/signal/report.html"><img src="https://erictsai83.github.io/prompt-profile/demo/signal/card.png" width="420" alt="Signal card"></a><br>
      <a href="https://erictsai83.github.io/prompt-profile/demo/signal/report.html">Signal</a>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <a href="https://erictsai83.github.io/prompt-profile/demo/afterhours/report.html"><img src="https://erictsai83.github.io/prompt-profile/demo/afterhours/card.png" width="420" alt="Afterhours card"></a><br>
      <a href="https://erictsai83.github.io/prompt-profile/demo/afterhours/report.html">Afterhours</a>
    </td>
    <td width="50%" align="center">
      <a href="https://erictsai83.github.io/prompt-profile/demo/studio/report.html"><img src="https://erictsai83.github.io/prompt-profile/demo/studio/card.png" width="420" alt="Studio card"></a><br>
      <a href="https://erictsai83.github.io/prompt-profile/demo/studio/report.html">Studio</a>
    </td>
  </tr>
</table>

## Quick start

1. Install [Claude Code](https://claude.com/claude-code) or [Codex](https://github.com/openai/codex)
   and log in once (`claude`, or `codex login`). prompt-profile uses it to analyse your prompts;
   **no API key needed**.
2. Run it (Node.js ≥ 24):

   ```bash
   npx prompt-profile@latest
   ```

   `@latest` makes npx fetch the newest version instead of reusing one it cached earlier.

3. Before anything is sent it shows a summary and asks `Continue?`:

   ```
   ● Range: last 3m · 2026-07-28 → 2026-10-28
     In range: Claude Code 1,204 · Codex 311 prompts
     1,515 prompts in 182 sessions after cleaning → 1,515 selected in 24 chunks
     No sampling: every chunk is analysed
     Read, cleaned and redacted on this computer; the report and analysis cache are written only here.
   ● Sent off this computer: the selected, redacted prompts go through your logged-in Claude Code CLI (claude -p) to its model service
     No API key: uses your subscription quota, base estimate 25 calls (24 chunks + 1 final profile)
     Intermediate merges and retries (up to 2 per call) can add calls.
     No hard limit: add --max-calls <n> to stop after n CLI calls.
     Free first: --dry-run writes what would be sent without calling any LLM; `prompt-profile stats` shows statistics.
   ```

   (Illustrative numbers.) The calls use your Claude / ChatGPT subscription quota.

4. When it is done, the report opens in your browser. Everything is written to
   `./prompt-profile-report/`.

### Look first, for free

- `npx prompt-profile@latest --dry-run` prints the same summary, then writes the exact chunks that
  would be sent to `--out` (`chunks/*.txt`, `plan.json`) and calls no LLM. The chunks are your
  redacted prompt text: keep them private and delete them when done.
- `npx prompt-profile@latest stats` shows statistics; nothing leaves your computer.

Both work without a logged-in CLI.

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

- Node.js ≥ 24, or the standalone executable (no Node.js needed)
- [Claude Code](https://claude.com/claude-code) (`claude`) or [Codex](https://github.com/openai/codex)
  (`codex`) installed and logged in
- **No API key needed**: the analysis runs your own logged-in `claude -p` or `codex exec` in the
  background and **uses your subscription quota**. The base call estimate is shown
  before confirmation. Intermediate merges and up to two retries per call can add calls;
  use `--max-calls` to set a hard limit on CLI invocations, including retries.

## What you get

The CLI writes HTML, `profile.json`, and `card*.png`; it does not automatically export PDF.
For a static PDF, open `report.html`, select a language, then use your browser’s Print → Save
as PDF. Printing includes both report views in that language. The offline HTML stays interactive;
both formats use the same profile without another analysis call. Files in `output/pdf/` are
fictional development review exports, not automatic CLI outputs.

Written to `./prompt-profile-report/` (change it with `--out`):

- `report.html`: your private, single-file report that works offline, with two pages:
  - **Who they are** (opens first): archetype, up to three observations with medium or high
    confidence each with one of your own prompts, observed collaboration preferences, the portrait story with its quotes,
    and fun facts
  - **Facts & evidence**: every measurement with its source and denominator: four measured
    habits with their definitions, tool and prompt-wording shares, a daily calendar and a
    weekday × hour heatmap (hover or tap for the count and main projects), project chapters,
    all traits with their quotes and how widely they are supported, the evidence for and
    against each preference, the five dimensions and how it was measured
  - **how you work with AI** (facts page): a capability map (plan, delegate, extend, verify,
    ship) with the skills you used and what each does, subagent types, MCP servers, models,
    pull requests, parallel sessions and prompt-writing habits; counted from tool metadata and
    the skill descriptions recorded in your transcripts, never tool inputs, outputs or skill
    arguments
  - **how you steer the AI** (facts page): in how many of the analysed conversations with
    follow-ups you redirected the AI's approach, and separately how often you asked it to fix a
    broken result, with examples; one-shot requests are not counted against you
  - **how to improve your prompts** (facts page): 2–4 suggestions, each with a real prompt of
    yours and a suggested rewrite, plus signals such as very short
    follow-ups, and what changed since your last report
  - **usage during this period** (facts page only): Claude Code and Codex side by side with
    the plan each runs on, tokens by kind, the share of each tool, months and models, and the
    **API list-price equivalent** in USD. Detailed breakdowns stay here; the card can show a
    compact token total and API estimate. The "Who they are" page does not show usage
  - a language switch when there is more than one language

  It shows everything by default, quotes and project folder names included. To share it, leave
  parts out with `--exclude` (below).

- `card.png`: a 1200 × 630 share card in the default language, plus `card.<lang>.png` for each
  other language (**omits evidence quotes**). Includes the introduction, up to two supported
  behaviors, prompt/conversation counts, token usage and an API estimate in USD. Missing and
  partial pricing are labeled; `--exclude usage` removes usage from HTML and PNG.
  `--card-hide stats` hides the card’s measured summary
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
| `usage`        | Plans, token counts and API list-price equivalents                                                   |
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
prompt-profile --look signal   # classic (default) / signal / afterhours / studio / prism / slate / folio
prompt-profile --card-hide stats,graphic  # leave traits / stats / graphic out of card.png
prompt-profile --name Eric     # title the report "Eric’s prompt profile" (not stored in profile.json)

prompt-profile stats                  # statistics only, no LLM (free and fast)
prompt-profile render profile.json    # re-create the report from an existing profile.json
prompt-profile cache clear            # delete the analysis cache

prompt-profile render profile.json --look studio --card-hide stats
                                      # a new look, written to variants/studio-no-stats/
```

Looks and `--card-hide` only change how the report and card are drawn: no new analysis and no
LLM calls, and the original report is kept. `--card-hide` changes the share card only; the
private report and `profile.json` still contain everything, including quotes. The card never
contains prompt quotes in any look. Project names follow the same `--exclude projects` choice
as the report.

Languages: without `--lang`, a Chinese system locale gives a Traditional Chinese report with an
English switch (`zh-TW,en`); any other locale gives English. The profile is written in English
and then translated, one extra CLI call per extra language; quotes stay as you wrote them.

Exit codes: `0` success · `1` error · `2` usage / needs `--yes` · `3` no data · `4` no usable LLM
CLI · `5` rate limited · `130` interrupted (a re-run resumes from the cache).

## Small histories and stopped runs

**Small histories.** A role, featured observations and prompt coaching each need verified quotes
from at least two sessions (the same rule that sets trait confidence and preference axes). When
nothing in a profile reaches that, the report is titled "Early observations": it states how many
prompts and sessions it is based on, keeps the observations, five dimensions and measurements,
and leaves out the generated role and the "Improve your prompts" section. The card does the same.
The terminal says so after the run; a longer `--since` range or more history adds evidence.

**If a run stops.** Progress is shown by phase (chunks, merges, the final profile, verification,
translations, writing files); there is no time estimate. When a run stops early, the error says
what was saved and prints the exact command to run again:

| What happened                                                         | What is saved                                           | What a re-run does                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Ctrl-C, rate limit, timeout, malformed output, too many failed chunks | Finished chunk results in the analysis cache; no report | Reuses cached chunks and merges; the final profile and translations run again |
| `--max-calls` reached                                                 | Same; cached results do not use the budget again        | Same; raise `--max-calls` if it stops again                                   |
| The final profile step failed                                         | Chunk results                                           | Repeats only the final profile and translation calls                          |
| An intermediate merge failed (large histories)                        | Chunk results and finished merges                       | Repeats the unfinished merges, then the final profile and translations        |
| A translation failed                                                  | The report, without that language                       | The printed command adds it (final profile + translation)                     |
| A card was not created (e.g. the Chinese font download failed)        | The report and `profile.json`                           | `prompt-profile render <profile.json>` retries the cards, no analysis         |

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
list-price equivalent**: what the usage would cost on the public API, not what you paid. Neither
provider offers a way to read a subscription's usage as a bill, so this is how every local usage
tool works (Claude Code's own session cost does the same); responses in fast mode (Claude
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

### Collaboration portraits

Reports have two locally switchable views: a chart-led overview of collaboration preferences,
workflow techniques and activity; and a detailed third-person portrait for readers who may not
know the person, with interactions, supporting quotes, skill descriptions and suggestions.
Evidence is expanded by default. Language and view switches work offline without JavaScript;
printing includes both views.
Quotes are verified against redacted prompts. Only the user's side of an interaction is
available; requests do not prove successful outcomes. Statistics and contextual observations
remain available alongside the narrative in their respective views. Older profiles remain renderable.

Four original preference axes describe how the person starts (define/explore), paces work
(stepwise/whole task), assigns decisions (direct/delegate), and converges (criteria/refinement).
A complete combination receives a stable role name. Each preference needs verified evidence
from at least two sessions; contradictory or insufficient evidence stays unresolved, and no
complete role is assigned. These are contextual observations, not psychological assessments,
ability scores or a validated personality instrument. The system is independent of MBTI.

Re-analyse to generate the new portrait; rendering an older profile does not create new
analysis. `pnpm dev:report` renders an entirely fictional portrait for local inspection.

### Choose a report template

- **Prism** puts supported signature behaviors above a clear visual overview.
- **Slate** combines a compact identity workspace with precise activity charts.
- **Folio** gives the portrait and evidence a quieter, connected reading rhythm.

Each includes a matching 1200 × 630 card. [Browse fictional examples](https://erictsai83.github.io/prompt-profile/demo/templates/index.html).
Existing looks and the classic default remain available. Change presentation without reanalysis:

```bash
prompt-profile render profile.json --look prism
prompt-profile render profile.json --look slate
prompt-profile render profile.json --look folio --card-hide stats
```

The card hiding options affect only the card; report exclusions remain available through `--exclude`.
