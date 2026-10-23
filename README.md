# prompt-profile

Analyze your past prompts from AI coding agents (Claude Code, Codex) locally and generate a
personal profile.

```bash
npx prompt-profile
# or
npm i -g prompt-profile && prompt-profile
```

Output (in `./prompt-profile-report/` by default):

- `report.html`: a single-file report that works offline — traits, five dimensions, an activity
  heatmap and fun facts, each conclusion backed by quotes from your own prompts
- `card.png`: a 1200 × 630 share card (**contains no prompt text**)
- `profile.json`: the raw profile data (re-create the report with `prompt-profile render`)

## Requirements

- Node.js ≥ 22
- [Claude Code](https://claude.com/claude-code) (`claude`) or [Codex](https://github.com/openai/codex)
  (`codex`) installed and logged in
- **No API key needed**: the analysis runs your own logged-in `claude -p` or `codex exec` in the
  background and **uses your subscription quota**. A run makes about 10–35 calls; the expected
  number is shown and you are asked to confirm before anything is sent.

## Usage

```bash
prompt-profile                 # analyse the last 6 months and write the report
prompt-profile --since 3m      # 1m / 3m / 6m / 1y / all (also <n>d, <n>w)
prompt-profile --engine codex  # which CLI analyses your prompts (default: auto, Claude Code first)
prompt-profile --model <name>  # model passed to claude / codex
prompt-profile --out <dir>     # output folder
prompt-profile --full          # no sampling, analyse everything (slower, uses more quota)
prompt-profile --no-cache      # do not read the analysis cache
prompt-profile --yes           # skip the confirmation (required in non-interactive sessions)
prompt-profile --dry-run       # write what would be sent to the LLM into --out, call nothing
prompt-profile --verbose       # full errors and LLM call timings

prompt-profile stats                  # statistics only, no LLM (free and fast)
prompt-profile render profile.json    # re-create the report from an existing profile.json
prompt-profile cache clear            # delete the analysis cache
```

Exit codes: `0` success · `1` error · `2` usage / needs `--yes` · `3` no data · `4` no usable LLM
CLI · `5` rate limited · `130` interrupted (a re-run resumes from the cache).

## Privacy

**Files read** (read-only):

| Source      | Paths (override with an environment variable)                                   |
| ----------- | ------------------------------------------------------------------------------- |
| Claude Code | `~/.claude/projects/*/*.jsonl`, `~/.claude/history.jsonl` (`CLAUDE_CONFIG_DIR`) |
| Codex       | `~/.codex/sessions/**/rollout-*.jsonl`, `~/.codex/history.jsonl` (`CODEX_HOME`) |

**What is sent to the LLM**: only prompts you typed yourself (no system messages, tool output or
sub-agent conversations), and:

- pasted code / logs are collapsed into `[pasted code: N lines]`
- API keys, tokens, passwords, private keys, connection strings, emails, phone numbers, national
  IDs, credit card numbers, internal URLs, UUIDs / hashes, home-folder paths and your username are
  redacted **before** anything is sent (and before long prompts are shortened)
- projects are reduced to their folder name, never the full path
- to see exactly what would be sent: `prompt-profile --dry-run`

It is sent to **your own** Claude Code / Codex account (`claude -p --no-session-persistence` /
`codex exec --ephemeral`): the analysis calls are not written to your session history and do not
trigger your hooks or MCP servers.

**What never leaves your machine**: your raw prompts, the report, `profile.json` and the analysis
cache (`~/.cache/prompt-profile/`, folder mode `0700`).

prompt-profile makes **no other network request**: the card's font ships with the package.

## FAQ

**How much quota does it use?** By default at most 30 chunks (about 40,000 characters each) are
analysed, plus a few merge calls for large histories and one final call: about 10–35 calls.
Chunks analysed before are read from the cache on the next run.

**Can I use an API key?** Not at the moment: by design it only borrows your logged-in CLI.

**Is the report accurate?** Every trait and dimension cites quotes from your prompts, and the
program checks that each quote really exists in them; unverifiable quotes are removed (the report
footer shows the result).

**Why are some prompts not counted?** Short acknowledgements ("ok", "continue"), resent duplicates,
notifications sent by the tools themselves, long templates repeated across sessions, and slash
commands of sessions that contain nothing else (scripts and tools) are excluded. Each run shows
how many were excluded.

**My prompts are not in English.** That is fine: prompts in any language are analysed (Chinese
gets extra handling for acknowledgements and corrections). The report is written in English;
quotes stay in their original language.

prompt-profile is not affiliated with or endorsed by Anthropic or OpenAI.

## Development

See [`AGENTS.md`](./AGENTS.md) and [`plans/`](./plans/README.md).

## License

MIT
