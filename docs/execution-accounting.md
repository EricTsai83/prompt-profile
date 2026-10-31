# Execution accounting and recovery

Every analysis receives an execution ID after confirmation and before model work. Its
private record lives at `<out>/executions/<id>/summary.json`, including when no report can
be published. Completed reports retain a compact `generation` snapshot in `profile.json`.
The HTML factual view shows this under **Report generation**; cards omit it.

```bash
prompt-profile --yes --max-calls 40
prompt-profile --engine claude --max-cost-usd 1.50
prompt-profile history --executions --out prompt-profile-report
```

`history --executions` lists saved JSON paths, including failed executions without reports.
Open that path in a local text viewer for per-stage attempts and recovery state. Ordinary
`history` repairs the completed-report index. It does not resume analysis. Neither operation
calls a model. Opening HTML, `render`, `stats` and `--dry-run` also make zero model calls.
A font download for rendering is separate from model usage. There is no terminal `--json`
mode; the versioned saved record is the machine-readable contract. `stats.json` is unchanged.

## What the measurements mean

The terminal, execution record and report share the pure aggregation in
[`Execution.ts`](../src/domain/Execution.ts). Historical `Profile.usage` still describes
activity in the selected prompt-history window. `Profile.generation` describes the new
model work used to produce this report. Rendering an old report does not charge that old
work again, overwrite archived analysis or fabricate missing generation measurements.
Released schemas 8 and 14 decode as profile version 20 with `generation: null`.

The generation snapshot closes after analysis and translations, before artifact rendering.
`accountingFinishedAtMs` records that boundary. `summary.wallDurationMs` measures this
window, including retries and cache operations; `summary.callDurationMs` sums completed
invocation durations. Concurrent calls overlap, so their summed duration can exceed elapsed
time. Execution `startedAtMs` / `finishedAtMs` also cover artifact production. The terminal
labels command elapsed and generation elapsed separately. All are wall-clock measurements,
clamped at zero if the system clock moves backwards.

Attempts distinguish map, merge, draft, evidence review and translation. Retries share a
logical `callId` but have separate attempt IDs. A real runner records an invocation only
after successful process spawn. Local schema/file preparation or a missing executable does
not become a model call. A spawned CLI that rejects authentication still counts as an
invocation, with unknown consumption unless it reports measurements. Test runners without
spawn notifications count their `generate` invocations.

Runners supply measurements before decoding generated JSON. An answer that fails its schema
can still have reported tokens and cost. Failed and cancelled invocations remain in the
record. Metadata never includes prompts, generated answers, reasoning text, credentials or
stderr. A CLI's reported model is distinguished from a requested, unverified model. Codex
CLI defaults are never guessed.

Tokens use the existing domain categories:

- Input excludes provider cache reads and cache writes. Codex cached input is subtracted from
  its inclusive input count, then recorded once as a cache read.
- Output includes reasoning. A reasoning count is an informational subset, never added again.
  Missing reasoning detail does not make the billable token total incomplete.
- Cache creation distinguishes five-minute, one-hour and unknown retention. Claude's known
  duration counts are retained; any remaining creation count has unknown duration.
- Missing or invalid counts remain missing, with unknown categories on the attempt and
  incomplete-attempt coverage in the summary. Available category subtotals are retained.
- Local analysis-cache hits are counted separately. A cached map or merge adds no new
  invocation and does not charge its old usage to the new execution. Draft, review and
  translations may still need new calls.

Tokens and cost independently have four states:

| State         | Meaning                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `known-zero`  | No invocations, or all required measurements explicitly total zero         |
| `complete`    | Every invocation supplied the required measurements                        |
| `partial`     | A measured subtotal exists, but some invocations have missing measurements |
| `unavailable` | No invocation supplied any required measurement                            |

An unavailable amount with a zero **measured subtotal** does not mean the work was free.
Reported and estimated cost counts stay separate. Claude's `total_cost_usd` is reported;
an estimate uses the existing versioned pricing table only with known billable categories,
model basis and reported service tier. Missing or unsupported models/tiers stay unpriced.
These amounts are neither provider invoices nor subscription-quota balances. Requested
models remain unverified even when their list prices can be estimated.

The experiment harness shares complete-coverage amount aggregation and captures measurements
before decoding too. Its older nullable amount fields remain null when any invocation,
including a failed attempt, has unknown consumption; they no longer total only successes.

## Stops, partial results and restart

Analysis completion, requested-language availability and artifact availability are separate
fields in the execution record. Skipped chunks or missing translations produce a partial
analysis snapshot. A nonfatal card failure leaves a usable HTML/profile and makes the overall
execution partial; it does not relabel the analysis as failed. The report's operational
outcome is explicitly labeled **Analysis outcome**. The execution record is authoritative
for final artifact availability and publication status.

A failed execution does not advance the library's latest completed report. A successfully
published report contains its execution ID, while the execution record contains the report
ID and artifact paths. If publication fails after writing files, the execution remains failed;
use `history` to repair the completed-report index if publication had already finished.

Follow the exact printed rerun command. Completed chunks and merges with matching input,
model/configuration and version provenance are reusable. Draft, evidence review and
translations run again. Each rerun gets its own execution ID and accounts only for its new
calls. The rerun command retains both limits; increase a threshold if it stops again.
There is no separate resume command or persistent feedback workflow.

Records are created before model work and checkpointed after attempts, then finalized on
success, failure or graceful interruption. Writes are serialized within one execution;
concurrent commands use distinct IDs. New directories are `0700`; atomic replacement files
are `0600`. Existing directory permissions are retained. Execution-owned symlink directories
are refused, and history skips and counts unreadable, unsafe, oversized or invalid records.
Each record is limited to 10,000 attempt entries; reaching capacity stops new work, which can
continue in a fresh execution using cache. Readers accept files up to 10 MB.

A checkpoint is not a transactional provider receipt. A hard kill or power loss can leave
`outcome: running` on disk and lose measurements since the last atomic write. History labels
such records **unknown**, since it cannot establish whether the process is still alive.
Its counts are checkpoint subtotals, not a complete total for the interrupted work. An
in-flight entry has unknown consumption until measurements arrive. Such records are never
silently declared successful.

A checkpoint failure stops subsequent admissions. Error finalization is best effort and
bounded to five seconds of actual filesystem wait, without replacing the primary model
failure. If final persistence fails after otherwise successful work, the command exits with
an error and warns that the last checkpoint may be incomplete. Report files already published
remain available. No file-write error can undo model consumption.

## Optional measured-cost stop threshold

`--max-cost-usd` accepts a positive finite decimal USD amount. It currently supports Claude
Code, whose CLI reports cost. A real Codex run with this flag is rejected before model work:
its CLI does not reliably report cost, effective model and service tier. A dry run stays free
and does not enforce a monetary threshold.

The threshold checks completed reported spending before new admission. Concurrent in-flight
requests can finish after the threshold is reached, so spending can overshoot. Cancellation
cannot recover consumed tokens. If cost coverage becomes unavailable, further work stops
explicitly. This is a local stop threshold, never a provider-enforced billing ceiling.
`--max-calls` remains the hard admission cap, shared across stages and retries; both settings
can be used together. No extra model call is made to estimate price, check credentials or
update progress.

## Formats and compatibility

- `EXECUTION_VERSION = 1` identifies execution records and their summary contract. Readers
  validate the record, ignore extra fields, and recompute summary totals from validated
  attempts instead of trusting externally supplied totals.
- `Profile.schemaVersion = 20` adds optional generation metadata; released schemas 8 and 14 remain
  renderable with unavailable generation data.
- Look versions are classic 20 and other looks 26. Render manifest version remains 3.
- Analysis prompts, analysis-cache version, cleaning/redaction rules and pricing data are
  unchanged. The output audit recognizes the new execution ID as a machine identifier;
  displayed model names still pass the existing output audit.
- `--exclude usage` and `--exclude personal` hide the generation section along with historical
  usage. The stored profile remains the source of truth, as for other rendering exclusions.

## Validation record — 2026-10-31

Behavior-first tests demonstrated failures before adding execution aggregation, call
recording, persistence and CLI integration. Additional regression tests demonstrated that a
failed spawn must not count as an invocation and that the privacy audit must preserve a
valid execution ID. Tests cover mixed coverage, retries, paid parse failures, cache-token
normalization, cancellation, concurrent cost overshoot, checkpoint failure, corrupt records,
symlinks, legacy migration, free operations and terminal/profile/record agreement.
[`execution.partial.json`](../test/fixtures/execution.partial.json) is entirely fictional.
Terminal snapshots in `test/cli/` are fictional too.

Manual fictional runs inspected both PTY status updates and redirected output. The cache
rerun made two fresh calls (draft and review) and reused two chunks; the redirected fresh run
made four calls. Seven looks were checked at 375 and 1280 pixels, in English and Traditional
Chinese, in light and dark schemes, with partial coverage and a 180-character model name.
The generation section was inspected visually; print styles and an existing card were also
inspected. These are layout checks, not evidence of reader comprehension or provider billing
accuracy. Local captures are under `tmp/plan33-qa/` and are not committed.

Two bounded real-CLI smoke passes used only fictional tiny prompts: four invocations total,
two per backend, without retries. In the final pass Claude reported `claude-opus-5-5` and
USD 0.006316; Codex returned tokens but no model or cost, which remained unknown. Assertions
compared telemetry with each runner's returned metadata and checked history isolation.
The final pass had two passing tests; six unrelated LLM tests were deliberately skipped.
No provider-invoice reconciliation was attempted. Local synthetic-run measurements are in
`tmp/plan33-smoke/` and are not fixtures.

The npm tarball and native macOS ARM64 standalone archive were installed/unpacked outside
the checkout and tested with the same fictional generation metadata. Checks cover help,
offline HTML/JSON/PNG output, private files, fonts, generation metadata and free execution
history. Other binary platforms were not executed on this machine.

The design borrows command lifecycle and measured-spending patterns from Deepsec, reviewed at
revision [`4fa6722`](https://github.com/vercel-labs/deepsec/tree/4fa67220aff67ac93dfc840206d3d32bfa4411ec):
[agent contracts](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/packages/processor/src/agents/types.ts),
[processing](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/packages/processor/src/index.ts)
and [command output](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/packages/deepsec/src/commands/process.ts).
Effect services, local CLI authentication, private local storage and the existing library
remain the implementation foundation.

## Released-format baseline — 2026-10-31

Published releases v0.1.1–v0.1.4 used profile schema 8; v0.1.5 used schema 14. Only
those released formats and the current schema are supported. Intermediate development
formats 2–7, 9–13 and 15–19 are rejected. Supporting released profiles only requires
changing their schema version and applying current additive-field defaults. The old
pre-version-12 axis conversion and unreleased stored third-person voice path were removed.
Released prose and source quotations remain unchanged; missing new measurements stay unknown.
