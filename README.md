# prompt-profile

Turn your local Claude Code / Codex prompt history into an evidence-backed report of how you
collaborate with AI. Uses your logged-in `claude` or `codex` CLI: no API key needed.

**Analysis sends selected, redacted prompts to your CLI's model service and uses your
subscription quota.** Reports and analysis caches stay on your computer.

![Fictional sample share card](https://erictsai83.github.io/prompt-profile/sample-card.png)

[Full report](https://erictsai83.github.io/prompt-profile/sample-report.html)
· [Shareable report](https://erictsai83.github.io/prompt-profile/demo/without-personal/report.html)
· [Template gallery](https://erictsai83.github.io/prompt-profile/demo/templates/index.html)

All examples use fictional data.

## Quick start

You need Node.js ≥ 24 and either [Claude Code](https://claude.com/claude-code) or
[Codex](https://github.com/openai/codex) installed and logged in.

```bash
npx prompt-profile@latest
```

The CLI shows the selected history and estimated calls, then asks for confirmation before
sending anything. By default it analyses the last three months and opens the finished report
in your browser. Files are saved under `./prompt-profile-report/`.

To inspect your history without calling an LLM (no login required):

```bash
npx prompt-profile@latest stats      # local statistics only
npx prompt-profile@latest --dry-run  # export the redacted chunks that would be sent
```

Dry-run exports contain your prompt text: keep them private and delete them when done.
The call estimate is not an upper bound; use `--max-calls` to cap CLI invocations, including
merges, evidence review and retries.

## Install

To install or update a global command:

```bash
npm i -g prompt-profile@latest
prompt-profile --help
```

Without Node.js, download a standalone executable for macOS, Linux or Windows from
[GitHub Releases](https://github.com/EricTsai83/prompt-profile/releases).
See the [standalone installation guide](https://github.com/EricTsai83/prompt-profile/blob/main/docs/user-guide.md#standalone-installation)
for extraction and macOS setup.

## What you get

- **HTML report**: an offline portrait of your collaboration preferences, supported observations
  and prompt suggestions, plus activity charts, workflow techniques and source evidence.
- **PNG share cards**: a 1200 × 630 card per language, without prompt quotes.
- **`profile.json`**: the data used to render the report again without another analysis.
- **Local history**: successful analyses are kept in a report library; open the output folder's
  `index.html` to browse them.

Reports support English and Traditional Chinese; quotes stay in their original language.
The default is English, or both languages on a Chinese system locale. Each extra language
normally uses one translation call, with one retry for an incomplete or failed translation.
A Chinese-only request stops if translation still fails; it does not substitute an English report. To export a PDF, use your browser's Print → Save as PDF.

Observations cite verified prompt quotes, but quote matching and model review do not prove an
interpretation is correct. Small histories may show “Early observations” instead of a role.
These are observations about your prompts, not a psychological assessment or an ability score.

## Usage

```bash
prompt-profile --since 6m            # 1m / 3m (default) / 6m / 1y / all
prompt-profile --engine codex        # default: auto, Claude Code first
prompt-profile --model <name>        # choose the analysis model
prompt-profile --max-calls 40        # cap CLI calls, including retries
prompt-profile --engine claude --max-cost-usd 1.50  # local stop threshold; may overshoot
prompt-profile --lang zh-TW,en       # first language is the default
prompt-profile --voice first         # I/我; second (you/你) is the default
prompt-profile --out <dir>           # choose the output folder

prompt-profile render profile.json --look prism  # change the look without LLM calls
prompt-profile cache clear                      # delete analysis cache entries
prompt-profile history --executions             # list saved execution records (free)
```

Seven looks are available: classic (default), signal, afterhours, studio, prism, slate and folio.
Rendering a new look keeps the original report. Use `--card-hide stats` to hide the card's
measured summary, or `--avatar` to choose its illustration.

See the [user guide](https://github.com/EricTsai83/prompt-profile/blob/main/docs/user-guide.md)
for all documented options, language behavior, history and recovery. If a run stops, follow the
printed retry command: completed chunks and merges are cached; later steps may use quota again.

Each analysis saves calls, retries, cache reuse, token coverage and cost provenance, including
failed executions. The report shows generation usage separately from historical activity.
See [execution accounting](docs/execution-accounting.md) for recovery, unknown measurements
and cost-threshold limits.

## Sharing and privacy

**Reports include quotes, project names and exact dates by default.** Cards omit quotes, but
can still include project names and usage. Create a version with personal sections left out:

```bash
prompt-profile render prompt-profile-report/profile.json --exclude personal
```

For a profile in the report library, use the current profile path printed by the CLI.
The full report is kept; review the exported files before sharing them. Individual exclusions
such as `quotes`, `projects` and `usage` are also available.

- Source histories are read only. Recognized system messages and tool output are excluded;
  pasted code and logs are collapsed before analysis.
- Supported secrets and personal information are redacted before sending, and report text is
  checked again before writing. These rules can miss confidential prose or unrecognized secrets.
- Selected prompts, project folder names, intermediate observations and prompt statistics go to
  the model service through your CLI. Token usage, plans and API price estimates stay local;
  price estimates are not your subscription bill.
- Reports, dry-run exports and caches are local files that can contain personal information.
  Clearing the cache does not delete reports or dry-run exports.
- prompt-profile has no telemetry. Reports work offline. The Chinese PNG card downloads a
  verified font on first use; the borrowed CLI manages its own network traffic and retention.

See [privacy details and output checks](https://github.com/EricTsai83/prompt-profile/blob/main/docs/user-guide.md#privacy)
for source paths, permissions, CLI isolation and redaction controls.

## FAQ

**Can I use an API key?** No; analysis uses your logged-in Claude Code or Codex CLI.

**Why are some prompts excluded?** Short acknowledgements, resent duplicates, recognized tool
notifications, repeated templates and command-only sessions are filtered. Each run shows counts.

**Can it analyse other languages?** Yes. Report text supports English and Traditional Chinese;
source prompts can be in any language.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks and releases, and
[AGENTS.md](AGENTS.md) for architecture and repository rules.

## License

MIT. Not affiliated with or endorsed by Anthropic or OpenAI.

### Narration voice

`--voice first|second` controls generated descriptive prose in every report language
and card. It is independent of `--look`. Second person (`you` / `你`) is the default; first
person uses `I` / `我`.
Quotes retain their original wording, and suggested sample prompts keep their intended speaker.

The selected voice is stored as `profile.voice` and shown in the report. First-person text is
an AI-authored draft; review it before presenting its claims as your own. Rerun the analysis
with another `--voice` to generate a coherent version; source-evidence map caches can be reused.
Changing voice does not add analysis stages or subscription calls beyond the normal run.
`render` preserves stored prose and voice without calling an LLM; it does not offer a voice
override or replace pronouns. Legacy profiles without voice metadata retain their original text
and do not receive an inferred voice label. Interface instructions still address the reader.
