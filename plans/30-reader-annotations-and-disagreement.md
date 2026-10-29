# Reader annotations and disagreement

Status: Planned; after evidence identifiers are stable

## Outcome

Let users record where an interpretation is wrong, limited to one context, or useful, without
rewriting source evidence or treating feedback as verified ground truth.

## Dependencies and ownership

Depends on: Plan 20 B; the completed [purpose contract](../docs/ux/report-redesign/purpose-contract.md) (plan 25); library integration uses plan 20 A.

Use a separate versioned annotation artifact keyed to a report and stable claim/evidence IDs.
Annotations are user statements, never invisible edits to generated analysis.

## Delivery sequence

1. Define identifiers, annotation schema and explicit report association.
2. Add a minimal local CLI add/list flow and a safe edit/export path.
3. Render an annotated variant from explicit annotation input.
4. Handle stale references and optional use in a later analysis.

## Acceptance

- [ ] Support disagreement, context qualification and useful-observation notes with user-authored text; record their source and association.
- [ ] Keep original profile/report immutable; annotated variants label user comments separately from model observations and source quotes.
- [ ] Define missing/changed claim behavior across migration and reanalysis; do not attach comments to another claim by matching prose alone.
- [ ] Use explicit private file persistence; file:// HTML must not imply that browser-local edits are automatically saved to disk.
- [ ] Validate untrusted annotations, escape content, count invalid entries and handle corrupt or mismatched versions visibly.
- [ ] Keep annotations out of share exports by default and honor exclusions when explicitly included.
- [ ] If later analysis uses feedback, require an explicit option and mark it as user testimony; quotes and historical outcomes cannot be altered retroactively.
- [ ] Test hostile text, stale IDs, cancellation, concurrent/conflicting edits, bilingual display and reproducible zero-LLM annotated rendering.

## Implementation and verification

Likely areas: Domain annotation schema/pure functions, CLI persistence, report annotation display, migration and privacy tests.

Follow the shared rules and execution gates in [the plan index](README.md#shared-rules-for-every-plan).
Use behavioral TDD for implementation changes, including a demonstrated failing regression.
Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before finishing;
record exit codes and test-file counts. Documentation-only work needs no artificial tests.
Preserve offline rendering, module boundaries, private atomic writes and legacy compatibility.
Update matching versions only when their contracts change. Record visual/manual evidence honestly.

## Out of scope

No telemetry, automatic learning, hidden reranking or cloud feedback collection.

## Completion

When all acceptance items are complete, move durable usage/decision notes outside `plans/`,
delete this file and its index row in the same change, and repair incoming links.
