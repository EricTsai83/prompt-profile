# Reviewed collaboration preference export

Status: Planned; follow initial evidence and experiment delivery

## Outcome

Turn supported observations into an editable, user-reviewed draft of how the user wants to
collaborate with an agent. Observation is input to a choice, not proof of a desired preference.

## Dependencies and ownership

Depends on: Plan 26; plan 27 can provide candidate actions.

Reuse verified profile evidence and private file utilities. Preferences are a separate user-owned
artifact; exporting them must not mutate the source profile or any existing agent configuration.

## Delivery sequence

1. Define candidate selection, provenance and a portable Markdown export.
2. Add an explicit review/edit/select flow using existing CLI conventions.
3. Export to a user-selected local destination with safe conflict behavior.
4. Validate the generated instructions with fictional profiles and user review.

## Acceptance

- [ ] Generate a small set of evidence-linked candidates with applicability and uncertainty; sparse evidence may produce no candidates.
- [ ] Require explicit selection/review before a final preference export; noninteractive operation needs explicit choices rather than silently accepting inferred preferences.
- [ ] Allow editing/rejection and distinguish user-written instructions from inferred candidates; avoid copying private quotes, names or task-specific details by default.
- [ ] Use deterministic extraction from stored supported fields where practical; any additional LLM step must be explicit, budgeted and separately justified.
- [ ] Export a portable English Markdown document with clear instructions and provenance outside the instruction body; honor supported privacy choices.
- [ ] Never write AGENTS.md, CLAUDE.md or global settings automatically. Existing destination files are preserved unless an explicit supported replacement flow is chosen.
- [ ] Verify private atomic writes, hostile generated text, path handling, cancellation, rerun conflicts and zero changes to source profiles/configuration.
- [ ] Document manual installation and limitations without claiming that exported instructions improve outcomes; iterate on usefulness through owner use and feedback.

## Implementation and verification

Likely areas: src/cli/commands/, domain pure derivation if needed, platform private writes; new export documentation and behavioral tests.

Follow the shared rules and execution gates in [the plan index](README.md#shared-rules-for-every-plan).
Use behavioral TDD for implementation changes, including a demonstrated failing regression.
Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before finishing;
record exit codes and test-file counts. Documentation-only work needs no artificial tests.
Preserve offline rendering, module boundaries, private atomic writes and legacy compatibility.
Update matching versions only when their contracts change. Record visual/manual evidence honestly.

## Out of scope

No automatic configuration installation, tool grants or fabricated user approval.

## Completion

When all acceptance items are complete, move durable usage/decision notes outside `plans/`,
delete this file and its index row in the same change, and repair incoming links.
