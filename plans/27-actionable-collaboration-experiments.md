# Actionable collaboration experiments

Status: Ready for contract and fixtures; claim calibration baseline delivered

## Outcome

A reader can leave with one small optional collaboration experiment that is tied to a supported
habit and has a clear situation, action and observation for a later review.

## Dependencies and ownership

Depends on: Existing improvements; plan 20 B enriches evidence later.

Extend existing improvements/rewrite behavior. This plan owns the detailed coaching contract;
plan 20 E integrates it into narrative and comparison, and the completed
[purpose contract](../docs/ux/report-redesign/purpose-contract.md) (plan 25) controls its reading prominence.

## Delivery sequence

1. Define the smallest experiment contract and absence state.
2. Adapt analysis and verification without adding a default model call.
3. Render one primary experiment with supporting detail and copyable text.
4. Add user-selected experiment follow-up only once report history exists.

## Acceptance

- [ ] Each experiment states when to try it, one concrete action, evidence references, optional copyable wording and what the user can observe next time.
- [ ] Allow zero suggestions when evidence is insufficient or prompts are already clear; do not require shortcomings to fill a section.
- [ ] Keep observed patterns, proposed effects and user-reported results distinct; never promise saved time or infer causality from later correction-rate changes.
- [ ] Preserve exact original quotes and language; rewrites add only supported task information and are labeled suggestions.
- [ ] Use one primary experiment by default with existing alternatives subordinate; honor --exclude coaching and quotes consistently in HTML, print and sharing.
- [ ] Prove proposed prompt text is untrusted content that is never executed; provide keyboard-accessible copy behavior with an offline fallback.
- [ ] For history integration, store user selection/result separately from immutable analysis; no result is inferred solely from another run.
- [ ] Test clear, sparse, contradictory, short-contextual and bilingual histories, removed evidence, legacy improvements and excluded coaching; bump appropriate versions.

## Implementation and verification

Likely areas: src/domain/Profile.ts as needed, src/analysis/prompts/, verification/translation, src/report/messages.ts and coaching renderer.

Follow the shared rules and execution gates in [the plan index](README.md#shared-rules-for-every-plan).
Use behavioral TDD for implementation changes, including a demonstrated failing regression.
Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before finishing;
record exit codes and test-file counts. Documentation-only work needs no artificial tests.
Preserve offline rendering, module boundaries, private atomic writes and legacy compatibility.
Update matching versions only when their contracts change. Record visual/manual evidence honestly.

## Out of scope

No automatic reminders, agent execution or productivity scores.

## Completion

When all acceptance items are complete, move durable usage/decision notes outside `plans/`,
delete this file and its index row in the same change, and repair incoming links.

Calibration foundation: [authored cases, production safeguards and limitations](../docs/ux/model-comparison/claim-support.md).
