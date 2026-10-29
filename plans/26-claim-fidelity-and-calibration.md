# Claim fidelity and analysis calibration

Status: Ready for fixtures and baseline; production rules follow findings

## Outcome

Distinguish an authentic quotation from evidence that actually supports a claim. Improve
specificity without increasing unsupported frequency, expertise, outcome or causal assertions.

## Dependencies and ownership

Depends on: Plan 22 evaluation tools; episode cases extend after plan 20 B.

Reuse verify.ts, existing persona fixtures/rubrics and plan 22 provenance. Plan 20 B owns episode
structure; C owns role semantics; F consumes this quality work. Do not invent a second judge pipeline.

## Delivery sequence

1. Turn documented blind-review failures into hand-written behavioral cases.
2. Record baseline failures and a manual semantic-support rubric.
3. Improve deterministic guards and analysis prompts only where cases justify them.
4. Run bounded opt-in comparisons when authorized and record remaining limitations.

## Acceptance

- [ ] Cover authentic-but-irrelevant quotes, repeated prompts in one session, one event described as a habit, requests described as achievements, missing counterexamples and context-dependent behavior.
- [ ] Separate quote validity, session spread, semantic support, specificity, contradictions and uncertainty in evaluation output; heuristic checks never certify semantic truth.
- [ ] Preserve contrary evidence through merge/evidence caps and test that rejected support cannot leave unsupported headline, portrait or coaching assertions.
- [ ] Where source coverage exists, replace opaque confidence-only presentation with readable support/spread/context; distinguish selected evidence from full-history statistics.
- [ ] Use session-level support rather than quote volume alone; do not assign numerical personality scores or treat autonomous tool events as user mastery.
- [ ] Record concrete before/after authored cases and repeat-run structured variation; retain model requested/reported identity separately and do not declare a universal model winner.
- [ ] Keep normal tests fake-runner-only. Any real evaluation uses an explicit bounded attempt budget, frozen inputs and private outputs through plan 22.
- [ ] Bump analysis/profile/pipeline versions only for corresponding contract changes; verify migration/cache invalidation and bilingual claim strength.

## Implementation and verification

Likely areas: src/analysis/, src/domain/ when required, scripts/eval-quality.ts, existing evaluation tests and docs/ux/model-comparison/.

Follow the shared rules and execution gates in [the plan index](README.md#shared-rules-for-every-plan).
Use behavioral TDD for implementation changes, including a demonstrated failing regression.
Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before finishing;
record exit codes and test-file counts. Documentation-only work needs no artificial tests.
Preserve offline rendering, module boundaries, private atomic writes and legacy compatibility.
Update matching versions only when their contracts change. Record visual/manual evidence honestly.

## Out of scope

No hidden LLM judge, scientific personality validation or automatic paid evaluation.

## Completion

When all acceptance items are complete, move durable usage/decision notes outside `plans/`,
delete this file and its index row in the same change, and repair incoming links.
