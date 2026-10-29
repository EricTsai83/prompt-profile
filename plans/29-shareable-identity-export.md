# Shareable identity export workflow

Status: Planned; follow purpose split

## Outcome

A user can deliberately compose, inspect and export an introduction that remains specific after
private information is removed. Sharing is a complete local workflow, not just a set of flags.

## Dependencies and ownership

Depends on: The completed [purpose contract](../docs/ux/report-redesign/purpose-contract.md) (plan 25); reuse exclusions and output audit.

Existing render variants, PNGs, --exclude and rule-based audit remain the foundation. This plan
owns selection/preview/export orchestration; it must not add cloud publishing or replace the audit.

## Delivery sequence

1. Define a sharing preset and a manifest of included/omitted content.
2. Build a render-only local review path and identity composition.
3. Export the reviewed HTML/PNG and an optional copyable introduction.
4. Audit the complete artifacts, not merely visible elements.

## Acceptance

- [ ] Offer explicit selection of supported identity behaviors and optional statistics; do not rewrite claims or fabricate specificity after exclusions.
- [ ] Show the actual selected artifact and remaining sensitive categories before final export; document that rule-based checks cannot guarantee anonymity.
- [ ] Apply exclusions to visible text, embedded data, script literals, attributes, accessibility text, print content and exported assets; test absence of excluded synthetic sentinel values in artifact bytes.
- [ ] For PNG, retain the no-quotes rule and project/custom-name controls; short text uses the same approved supported content.
- [ ] Keep private profile data out of share bundles and preserve the original report. Explain any profile JSON accompanying an export rather than silently include it.
- [ ] Keep preview and final export settings aligned through a render manifest; rerun/version mismatch must not silently export a different selection.
- [ ] Verify offline operation, CSP, escaping, private atomic writes, multilingual long text, missing fields and all exclusion combinations relevant to sharing.
- [ ] Inspect actual mobile-sized PNG readability and full share HTML; prove no new analysis calls for compatible saved content.

## Implementation and verification

Likely areas: src/cli/commands/render.ts or a focused share command, src/report/visibility.ts, audit, render manifests and report/card tests.

Follow the shared rules and execution gates in [the plan index](README.md#shared-rules-for-every-plan).
Use behavioral TDD for implementation changes, including a demonstrated failing regression.
Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before finishing;
record exit codes and test-file counts. Documentation-only work needs no artificial tests.
Preserve offline rendering, module boundaries, private atomic writes and legacy compatibility.
Update matching versions only when their contracts change. Record visual/manual evidence honestly.

## Out of scope

No accounts, upload, public URL hosting or external messages.

## Completion

When all acceptance items are complete, move durable usage/decision notes outside `plans/`,
delete this file and its index row in the same change, and repair incoming links.
