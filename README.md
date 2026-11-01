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
sending anything. By default it analyses the last two months and opens the finished report
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
  `index.html` to browse them. Generated output includes a `README.md` explaining each file,
  backups, deletion and index repair; an existing user README is preserved. New report folders use readable local timestamps, for example
  `2026-11-01_03-12-04+0800-<id>` (`+0800` is the UTC offset). Older report folders remain readable.

Reports support English and Traditional Chinese; quotes stay in their original language.
The default is English, or both languages on a Chinese system locale. Each extra language
normally uses one translation call, with one retry for an incomplete or failed translation.
A Chinese-only request stops if translation still fails; it does not substitute an English report. To export a PDF, use your browser's Print → Save as PDF.

Observations cite verified prompt quotes, but quote matching and model review do not prove an
interpretation is correct. Small histories may show “Early observations” instead of a role.
The [radar](docs/ability-scores.md) assesses six AI collaboration abilities from verified quotes in these conversations. Scores describe supported practice, not psychological traits or population ranks; “not assessed” is not a low score.

New analyses also retain [reusable instruction provenance](docs/instruction-provenance.md): what a skill is documented to do, who selected it for the task, and which historical requirements were supplied.

## Usage

```bash
prompt-profile --since 6m            # 1m / 2m (default) / 3m / 6m / 1y / all
prompt-profile --engine codex        # default: auto, Claude Code first
prompt-profile --model <name>        # choose the analysis model
prompt-profile --max-calls 60        # cap CLI calls, including retries
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

## How much a run uses

A run reads everything locally, then analyses a **sample** of the selected history: about
20–26 chunks of redacted prompts (roughly 700k characters) once the history is larger than
that. Time, tokens and cost therefore stop growing with history size; `--full` analyses every
chunk and scales with the history instead. `--dry-run` prints your own estimate for free.

### Measured runs

One real history, default settings (last 2 months, sampled, report in Traditional Chinese
and English), measured on 2026-11-01 with both engines on the same input:

| Input              |                                                                       |
| ------------------ | --------------------------------------------------------------------- |
| History in range   | 4,374 prompts in 613 conversations (Claude Code and Codex)            |
| Analysed (sampled) | 1,499 prompts in 252 conversations: 21 of 68 chunks, ~665k characters |

|                           | Claude Code                        | Codex                          |
| ------------------------- | ---------------------------------- | ------------------------------ |
| Model                     | `claude-opus-5-5` (default effort) | `gpt-6.1-sol` (default effort) |
| CLI calls                 | 48 (no retries)                    | 48 (no retries)                |
| Wall time                 | 25 min                             | 20.5 min                       |
| Tokens in / out           | 1.46M / 0.38M                      | 1.73M / 0.29M                  |
| API list-price equivalent | **US$13.8** (reported by the CLI)  | **≈ US$6.1** (estimated¹)      |

¹ Codex does not report which model answered, so prompt-profile leaves its cost unpriced; the
estimate applies `gpt-6.1-sol` list prices to the measured tokens and leaves out cache writes,
which the Codex log does not report.

With a subscription these calls use your plan's quota; the dollar figures are what the same
tokens would cost on the API, not a bill. Another model, `--effort` level or history mix will
change them.

The measured costs above include 21 label calls that new runs no longer make. New costs have not yet been measured.

Historical breakdown (before ability scoring; the label stage below has now been removed):

| Stage          | Calls                | What it does                                             | Share of cost (Claude / Codex) |
| -------------- | -------------------- | -------------------------------------------------------- | ------------------------------ |
| map            | 1 per chunk          | reads the redacted prompts and writes cited observations | 52% / 57%                      |
| merge          | 0–3                  | condenses observations when there are too many           | 10% / 9%                       |
| draft + review | 2                    | writes the profile, then checks it against the evidence  | 13% / 10%                      |
| label          | 1 per chunk          | counts how often each trait shows (the trait radar)      | 24% / 24%                      |
| translation    | 1 per extra language | translates the generated text                            | 1% / 1%                        |

### Scale reference

Current base call estimates for the same history at different `--since` ranges (from `--dry-run`, so
merges and retries come on top):

| Range              | Prompts after cleaning | Conversations | Chunks analysed / total | Base calls |
| ------------------ | ---------------------- | ------------- | ----------------------- | ---------- |
| 2 days             | 392                    | 29            | 10 / 10 (no sampling)   | 13         |
| 1 week             | 1,278                  | 195           | 16 / 34                 | 19         |
| 2 weeks            | 1,690                  | 241           | 18 / 40                 | 21         |
| 1 month            | 3,132                  | 448           | 23 / 60                 | 26         |
| 2 months (default) | 4,038                  | 611           | 21 / 68                 | 24         |
| 6 months           | 7,605                  | 1,629         | 26 / 111                | 29         |
| All (7 months)     | 7,884                  | 1,686         | 25 / 115                | 28         |

As a rule of thumb, a sampled run costs about one call per analysed chunk plus a handful, and
time and cost follow the number of analysed chunks: a history of a few hundred prompts takes
about half of the measured run above, and anything past ~1,300 prompts costs about the same.
`--full` on the 6-month history would analyse 111 chunks, about five times the measured run.

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
