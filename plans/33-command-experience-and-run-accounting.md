# Command experience and run accounting

Status: Planned; source review complete, implementation not started

## Outcome

After a command finishes or stops, the user understands what happened, what it consumed,
where the results are, what remains unknown and what command to run next. Terminal output,
saved execution metadata and the report must agree about the same execution.

Owner request: borrow useful command UX and architectural patterns from Deepsec, including
per-run usage/cost information. Preserve this project's Effect 4 implementation, local CLI
authentication, privacy model and offline reports. This is a follow-up to completed plan 20.

## Reference and limits

Source review is pinned to Deepsec revision
[`4fa6722`](https://github.com/vercel-labs/deepsec/tree/4fa67220aff67ac93dfc840206d3d32bfa4411ec).
Recheck relevant upstream behavior before implementation; this plan describes that revision,
not a claim about every future release. Borrow contracts and interaction patterns rather than
copying its branding, status text, framework or complete product architecture.

| Reference | Useful pattern | Application here |
|---|---|---|
| [Command orchestration](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/packages/deepsec/src/commands/process.ts) | Start context, progress events, completion counts, actionable failures and next command | Consistent CLI lifecycle, readable default output and explicit partial results |
| [Agent contracts](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/packages/processor/src/agents/types.ts) | Backend-neutral progress and execution metadata | Extend existing `LlmRunner` and `Progress` services without coupling analysis to terminal formatting |
| [Claude adapter](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/packages/processor/src/agents/claude-agent-sdk.ts) | SDK-reported tokens, cost and duration | Preserve CLI-reported measurements with their provenance |
| [Codex adapter](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/packages/processor/src/agents/codex-sdk.ts) | Normalize cached tokens and estimate known-model cost | Reuse our versioned pricing rules, retain unknown models and distinguish estimates from reported amounts |
| [Processor](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/packages/processor/src/index.ts) | Aggregate execution metadata, persist run totals, stop after quota/cost limits | One accounting source for terminal, saved history and report; cancellation and partial coverage remain explicit |
| [Architecture](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/docs/architecture.md) / [data layout](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/docs/data-layout.md) | Separate processing from read-only reporting; checkpoints and append-only history | Extend existing cache and immutable report library, with durable execution records for failed runs too |
| [Terminal UI](https://github.com/vercel-labs/deepsec/blob/4fa67220aff67ac93dfc840206d3d32bfa4411ec/packages/deepsec/src/setup/tui.tsx) | Visually grouped stages and a clear current action | Improve the existing output renderer; evaluate Ink only if a concrete interaction needs it |

Important differences to preserve:

- Deepsec uses ordinary async functions and SDK plugins; adopting its UX does not require
  replacing Effect, Schema, the existing runner interface or the CLI framework.
- Its Codex dollar amount is a pricing estimate, not a provider invoice. Subscription quota,
  API-equivalent cost, CLI-reported cost and actual billed charges are different quantities.
- Its processor includes unknown batch cost as zero in a numerical accumulator. Our displayed
  totals must retain unknown coverage rather than present an incomplete number as complete.
- Its cost check observes completed batches; concurrent in-flight work may add cost. A local
  stop threshold cannot be advertised as a provider-enforced hard spending cap.
- Its processing command shows per-agent completion details and aggregate result counts;
  it does not establish that every command prints a complete final cost breakdown today.

## Existing foundation: extend rather than repeat

- `src/llm/LlmRunner.ts` already returns input/output tokens, nullable USD cost and duration.
  Claude reads `total_cost_usd`; Codex currently leaves cost null. Neither value is a receipt.
- `src/analysis/progress.ts` and `src/cli/commands/analyze.ts` already separate analysis progress
  from rendering. The preflight shows selection, estimated calls, privacy and a hard call cap.
- `scripts/experiment/execute.ts` already wraps runners to record attempts and aggregate usage.
  Extract reusable accounting contracts where appropriate; production must not import scripts.
- The library already preserves immutable reports, renders appearance variants and repairs its
  index. Cached chunk results already have version and model provenance.
- `Profile.usage` describes the selected historical activity window. It does not describe the
  model calls made to generate this profile. Keep these separate in storage and presentation.
- Recovery already preserves completed chunk/merge work. Builds, package tests, synthetic
  fixtures, output checks and bounded real-CLI evaluations already exist.

## Delivery order and ownership

| Phase | Deliverable | Depends on |
|---|---|---|
| A | Execution, event and measurement contracts | Existing runner, progress and library |
| B | Accurate per-attempt usage and cost accounting | A |
| C | Command lifecycle and terminal summaries | A, B |
| D | Durable execution records and recovery | A, B, C |
| E | Report/library access to generation metadata | D |
| F | Optional monetary stop threshold | B, D; evaluate after the summary is useful |
| G | Integration, compatibility and release preparation | A–F |

A–E are the first useful delivery. F follows reliable measurement, rather than blocking it.
This plan owns operational telemetry and command UX. Plan 22 keeps experiment comparisons;
Profile content and user follow-up features remain outside this plan; sharing orchestration
was removed by owner decision (see the plan index).

## A. Define execution contracts

- [ ] Define an execution identity created before paid work, linked to the completed report's
      identity when available. A failed attempt to generate a report must still be identifiable.
- [ ] Define typed lifecycle/stage events and a summary covering operation, timestamps, engine,
      model provenance, stage counts, attempts, retries, local cache reuse and output artifacts.
      Distinguish wall-clock duration from summed call duration when calls overlap.
- [ ] Separate analysis completion, language availability and artifact availability. Model
      failures, interruption and skipped translation cannot masquerade as complete success;
      nonfatal card failure remains distinguishable from analysis failure.
- [ ] Define complete, partial, unavailable and known-zero measurement states, independently
      for tokens and cost. Preserve measured subtotals plus unknown attempt counts.
- [ ] Design Effect services so analysis emits structured data; CLI and persistence consume
      it. Domain stays pure, runners stay backend-specific, and report consumes saved domain data.
      Existing plain/noninteractive output and silent test services remain supported.

## B. Measure each actual call

- [ ] Record map, merge, draft, evidence review and every translation, including retries,
      failures and cancelled in-flight calls. Place recording around each admitted runner
      invocation inside retry handling; a retry group is not a single attempt.
- [ ] Capture returned usage before output decoding can fail when the CLI supplies it.
      Malformed output can still have consumed tokens. Without supplied usage, record unknown
      consumption; a local validation failure before invocation consumes no model call.
- [ ] Normalize uncached input, cached input, cache creation and output using existing domain
      semantics. Codex cached input is a subset of input; reasoning is a subset of output.
      Neither is added twice. Preserve unknown cache-write duration and absent fields.
- [ ] Store cost provenance: reported, estimated or unavailable; preserve model identity source,
      pricing version and known service tier. Never guess the actual Codex model from defaults.
      Reuse existing pricing data; leave unsupported models/tiers partially or wholly unpriced.
- [ ] Distinguish local analysis-cache hits from provider prompt-cache tokens. Reusing an old
      chunk creates no new call and does not re-charge its historical recorded cost to this run.
      Cached analyses may still require fresh draft, review and translation calls.
- [ ] Make summary totals a pure aggregation shared by production and experiment tooling where
      practical. Test mixed backends/models, cached tokens, missing metadata, parse failures,
      retries, interruptions, zero calls and partially priced executions with fake data.

## C. Make command output understandable

- [ ] Keep a consistent start block: operation, data window, engine/model source, selected work,
      cache reuse, estimated new calls, limits and which data leaves the machine. No model call
      is introduced merely to estimate, validate credentials or decorate progress.
- [ ] Show the current stage, completed/total work, elapsed time and warnings. Add explicit
      evidence-review and rendering states; never expose model reasoning or raw source content.
      Concurrent progress must not interleave unrelated lines or pretend completion order is fixed.
- [ ] Finish with a compact summary: outcome, elapsed time, actual calls/retries, local cache
      reuse, token categories, cost provenance/coverage, generated languages and artifact paths.
      Put detailed per-stage accounting behind `--verbose` or saved execution metadata.
- [ ] Preserve the same essential result for TTY, redirected output and CI. TTY may update one
      status area; non-TTY uses readable lines without cursor controls. Color is redundant with
      text labels. Keep CLI copy centralized in English in `src/cli/messages.ts`.
- [ ] Show partial summaries on quota exhaustion, timeout, budget exhaustion, interruption and
      write failure, followed by the exact next useful command. Avoid calling a stopped run
      successful because some chunks completed; preserve established exit-code contracts.
- [ ] Explain free operations precisely: opening HTML, `render`, `history`, `stats` and
      `--dry-run` make zero model calls. Previously recorded generation cost stays historical;
      it is not the cost of the current render. Font downloads are separate from model usage.
- [ ] Define one machine-readable summary contract; if a `--json` mode is added, stdout must be
      valid JSON and progress must use stderr or be suppressed. Do not silently change existing
      output or overload the historical `stats.json` format.

## D. Persist records and improve recovery

- [ ] Reuse library identity and private-file utilities. Decide an explicit execution-record
      location, such as `executions/<id>/summary.json`, separate from completed report manifests.
      Record creation/finalization even when no report can be published. Failed executions never
      advance the library's latest completed report pointer.
- [ ] Persist bounded per-attempt metadata and summary checkpoints through private atomic writes.
      No raw prompts, outputs, reasoning, credentials or unsanitized stderr. Keep folder/file
      permissions and symlink/path protections consistent with the existing library.
- [ ] Link completed reports to their execution record without copying entire histories or
      mutating archived analysis on render. Define optional legacy fields, schema/manifest versions
      and unknown historical generation-cost states; never fabricate metrics for old profiles.
- [ ] Reuse completed cache entries only with valid input/version provenance. Explain which
      stages a restart repeats and why; distinguish resume/recompute from `history` index repair.
      Resume attempts receive their own execution accounting, linked to prior work if useful.
- [ ] Persist best-effort cancellation/error summaries without masking the primary failure or
      hanging shutdown. Unexpected termination may leave a record marked interrupted/unknown;
      never silently finalize it as successful. Test crash windows and concurrent runs.

## E. Expose generation metadata separately from historical usage

- [ ] Add a secondary "Report generation" section with engine/model provenance, actual calls,
      cache reuse, duration, token categories and cost provenance/coverage. Historical activity
      usage retains its own window, denominator and pricing explanation.
- [ ] Provide natural English/Traditional Chinese copy in `src/report/messages.ts`, matching
      saved values rather than making another translation or model call. Mark older execution
      metadata unavailable. Distinguish subscription usage from separately billed API charges.
- [ ] Show both successful and incomplete generation states where a report exists. Keep the
      portrait prominent and keep operational telemetry off the share card by default.
      Apply existing usage exclusions and privacy/output auditing to the new fields.
- [ ] Decide how the library/history command opens a saved execution summary, including a failed
      execution without a report. Keep standalone rendering and relative offline navigation.
- [ ] Prove terminal, saved summary and rendered report use the same aggregation and values.
      Check long model names, partial/unknown amounts, both languages, narrow widths and print.

## F. Add an optional measured-cost stop threshold

- [ ] Specify `--max-cost-usd` only after provenance and coverage are reliable. Retain
      `--max-calls` as the hard invocation cap; define interaction and validation for both.
- [ ] Check measured spending before admitting new work and after a call completes. Account for
      concurrency and in-flight requests; cancellation cannot undo provider consumption. Describe
      this as a local stop threshold, with possible overshoot, not a guaranteed billing ceiling.
- [ ] Define what happens when the model, tier, pricing or a call's usage is unknown. Do not
      silently treat it as free or claim the monetary limit was enforced. Reject unsupported
      configuration before paid work, or stop further admission with an explicit incomplete
      accounting reason if measurement becomes unavailable mid-run.
- [ ] Persist the stop reason, measured subtotal, missing coverage and resumable work; show a
      safe next command and a distinct limit outcome without changing old exit codes casually.
      Test thresholds with fake runners, including multiple in-flight completions.

## G. Integration and acceptance

- [ ] Deliver in independent scopes: contracts/accounting, CLI lifecycle, persistence/recovery,
      report integration, optional threshold, documentation. Keep shared primitives usable by
      existing experiment comparisons without importing CLI/report code into analysis.
- [ ] Use behavior-first TDD with demonstrated failures. Validate complete/partial/unknown/zero
      states, retries, paid parse failures, free commands, cache reuse, mixed model identity,
      concurrent work, cancellation, write failure, legacy records and all privacy exclusions.
- [ ] Add terminal transcripts and entirely fictional saved summaries. Inspect TTY and piped
      output manually. Record report/card visual checks honestly; no reader-study claim is implied.
- [ ] If CLI invocation/output parsing changes, run bounded real-CLI smoke checks with recorded
      attempt counts and models. Verify telemetry against returned metadata, not provider invoices.
      Ordinary tests must remain free and must not consume subscription quota.
- [ ] Update usage, recovery, cost terminology, format/version tables and migrations. Bump only
      versions whose contracts change; changing analysis prompts is not required for telemetry.
- [ ] Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`, plus appropriate
      package/binary checks. Confirm output summaries, embedded assets and execution metadata
      work from the installed artifact. Judge exit codes and test-file counts.

## Non-goals

No switch from Effect to plain promises, mandatory React/Ink migration, new API-key mode,
Vercel account/Sandbox requirement, remote telemetry, cloud database, new model provider or
security-scanning features. No provider billing reconciliation or claim of actual money charged.
No raw-content event log, automatic deletion of prior runs or automatic publication of reports.
These would need separate product justification rather than follow from copying a dependency list.

## Completion

When every acceptance item is complete, move durable contracts/usage notes outside `plans/`,
delete this file and its index row in the same change, and repair incoming links. During
implementation, distinguish completed slices from the still-unfinished whole plan.
