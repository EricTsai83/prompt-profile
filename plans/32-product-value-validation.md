# Product value and reader validation

Status: Ready for protocol and fictional sessions; real sessions need participants

## Outcome

Evaluate recognition, comprehension, actionable usefulness and reasons to return. Keep observed
user behavior distinct from owner aesthetic approval, synthetic tests and product hypotheses.

## Dependencies and ownership

Depends on: Current product; repeat after plans 24–31 and plan 20 milestones.

Plan 21 was closed by owner decision without claiming a completed unfamiliar-reader walkthrough.
This plan owns the remaining reader research protocol and records actual participant evidence.

## Delivery sequence

1. Define research questions, tasks, consent boundaries and note templates.
2. Pilot the protocol with fictional artifacts, labeling the pilot honestly.
3. Conduct small owner-coordinated sessions with actual participants when available.
4. Record decisions and revisit after a focused delivery batch.

## Acceptance

- [ ] Create an English protocol and recording template under docs/ux/ covering first-run expectations, reader comprehension, recognition, usefulness, sharing and return intent.
- [ ] Ask unfamiliar readers to describe the subject and cite an example; ask subjects which concrete observation is new, wrong or too generic.
- [ ] Observe whether a person can choose and apply one experiment/preference draft; distinguish stated intent from reported or observed adoption.
- [ ] Follow up only with participant permission to learn whether project completion or new history created a reason to return; no automatic messages or telemetry.
- [ ] Record participant/artifact type, task, direct observation, interpretation and limitation separately; do not invent sessions or statistically generalize a small sample.
- [ ] Keep private reports and identifying notes out of committed artifacts. Use fictional examples and anonymized consented summaries for repository findings.
- [ ] Before each session batch, state what result would change the next product decision; prioritize blockers over adding cosmetic presets.
- [ ] Track expansion hypotheses separately: new adapters need evidence of missing history, cross-source deduplication cases and a separate implementation plan; team/self-introduction use needs demonstrated demand.
- [ ] Produce a decision log: supported value, unresolved problems, next bounded experiment and work to defer. If participants are unavailable, keep live-session acceptance open.
- [ ] Feed actual reader findings back to the durable report design records and the relevant feature plan without treating automated checks as human acceptance.

## Implementation and verification

Likely areas: docs/ux/ research protocol, task sheets and anonymized decision logs; no production telemetry required.

Follow the shared rules and execution gates in [the plan index](README.md#shared-rules-for-every-plan).
Use behavioral TDD for implementation changes, including a demonstrated failing regression.
Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before finishing;
record exit codes and test-file counts. Documentation-only work needs no artificial tests.
Preserve offline rendering, module boundaries, private atomic writes and legacy compatibility.
Update matching versions only when their contracts change. Record visual/manual evidence honestly.

## Out of scope

No recruitment messages, scheduled outreach, population benchmarks or invented adoption metrics.

## Completion

When all acceptance items are complete, move durable usage/decision notes outside `plans/`,
delete this file and its index row in the same change, and repair incoming links.
