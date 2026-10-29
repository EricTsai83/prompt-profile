# First-run clarity and recovery

Status: Ready; first delivery batch

## Outcome

A first-time user understands what will be read, what leaves the machine, what uses subscription
quota, and how to recover. Small histories receive an intentional useful report.

## Dependencies and ownership

Depends on: None.

Existing stats, dry-run, confirmation, call caps, cache recovery and error rendering are the
foundation. Improve their connection and wording; do not build a second onboarding pipeline.
Local collection/output is different from remote inference through the logged-in CLI.

## Delivery sequence

1. Audit README, help, confirmation, progress and error text against the actual data flow.
2. Improve the preflight summary using existing collected counts and analysis planning.
3. Design sparse-data, interruption, budget-exhaustion and partial-output behavior.
4. Verify the full first-run and recovery paths using fake runners and fictional histories.

## Acceptance

- [ ] Correct ambiguous local-processing claims: identify local reading/redaction/output, provider inference, subscription quota and absence of required API keys.
- [ ] Before confirmation, show source/time-window coverage, cleaned and selected prompt counts, sampling, base calls, retry/merge uncertainty and any hard budget; reuse stats/dry-run rather than introduce redundant modes.
- [ ] Expose a free inspection route from help and preflight; dry-run still makes zero analysis calls and states where its sensitive prepared files are written.
- [ ] Use honest phase-based progress; do not show fabricated completion times or expose prompt text in errors.
- [ ] Define sparse-data fallback using available evidence, not arbitrary personality thresholds: observations and limits remain readable, unsupported roles/coaching are absent.
- [ ] For interruption, budget exhaustion and generation failure, state what is saved and provide the exact supported recovery command; prove cache reuse without claiming it resumes every stage.
- [ ] Test no history, one session, no logged-in runner, sampled input, cancellation, retry/budget limits, translation failure and missing card output.
- [ ] Update English CLI/docs and bilingual report fallback copy; inspect real rendered sparse outputs.

## Implementation and verification

Likely areas: src/cli/, src/analysis/progress.ts, src/report/, README.md; relevant CLI/analysis/report tests.

Follow the shared rules and execution gates in [the plan index](README.md#shared-rules-for-every-plan).
Use behavioral TDD for implementation changes, including a demonstrated failing regression.
Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before finishing;
record exit codes and test-file counts. Documentation-only work needs no artificial tests.
Preserve offline rendering, module boundaries, private atomic writes and legacy compatibility.
Update matching versions only when their contracts change. Record visual/manual evidence honestly.

## Out of scope

No new engine, installation system, account, telemetry or automatic paid run.

## Completion

When all acceptance items are complete, move durable usage/decision notes outside `plans/`,
delete this file and its index row in the same change, and repair incoming links.
