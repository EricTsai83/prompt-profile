# Context and project retrospectives

Status: Planned; evidence foundation first

## Outcome

Offer a bounded project or task-context retrospective that explains how collaboration varies
with the work, without forcing a single stable label onto every situation.

## Dependencies and ownership

Depends on: Plan 20 B/C; history comparison also requires plan 20 A/E.

Plan 20 E owns comparable historical change. This plan owns selection and contextual reading;
it consumes those rules rather than implementing a second longitudinal comparison system.

## Delivery sequence

1. Start with one explicit project/time-window selection using existing source metadata.
2. Carry selection and coverage through analysis provenance, output and cache identity.
3. Render contextual patterns and exceptions with supporting episodes.
4. Add task categories only after manual fixture review shows they can be distinguished.

## Acceptance

- [ ] Define proposed selection syntax in help/docs before implementation; distinguish a project label from a filesystem path and handle ambiguous or missing metadata.
- [ ] Use the existing pipeline/analysis and LLM budget, with selection recorded in provenance and cache/input identity; no independent analysis engine.
- [ ] Present selection coverage, excluded/missing records and task context; preserve links to available verified episodes without exposing excluded names.
- [ ] Allow different behavior across debugging, design exploration or learning only when evidence supports the distinction; uncertain task labels remain uncertain.
- [ ] Show within-context observations before comparing contexts. Never interpret different task mixes, role labels or source coverage as growth by themselves.
- [ ] Preserve short follow-ups in their session context and avoid assigning standalone intent to an acknowledgement; count genuinely unusable records.
- [ ] For repeated reviews, reuse plan 20 E comparability checks and explicitly distinguish overlapping data windows and changed analysis versions.
- [ ] Test mixed projects, renamed/unknown labels, split sessions, sparse contexts, overlapping windows, legacy profiles, exclusions and source duplication; run smoke checks if adapter/pipeline rules change.

## Implementation and verification

Likely areas: src/cli/options.ts and commands, pipeline selection, analysis provenance, report contextual sections and relevant tests.

Follow the shared rules and execution gates in [the plan index](README.md#shared-rules-for-every-plan).
Use behavioral TDD for implementation changes, including a demonstrated failing regression.
Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before finishing;
record exit codes and test-file counts. Documentation-only work needs no artificial tests.
Preserve offline rendering, module boundaries, private atomic writes and legacy compatibility.
Update matching versions only when their contracts change. Record visual/manual evidence honestly.

## Out of scope

No repository code inspection, outcome inference, team ranking or exhaustive task taxonomy.

## Completion

When all acceptance items are complete, move durable usage/decision notes outside `plans/`,
delete this file and its index row in the same change, and repair incoming links.
