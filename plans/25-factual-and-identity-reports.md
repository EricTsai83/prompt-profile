# Factual and identity report experience

Status: Purpose-based HTML composition implemented; remaining integration and validation pending

## Outcome

Give the two report purposes independent reading promises: a recognizable introduction and an
inspectable factual account. Purpose drives composition; HTML and PNG remain delivery formats.

## Dependencies and ownership

Depends on: Existing report and the completed plan 21 composition.

Plan 21 was closed by owner decision. Its durable [design records](../docs/ux/report-redesign/output-roles.md)
record the implemented purpose-based HTML composition, evidence selection and validation.
Reuse that implementation; remaining work here covers export alignment, repetition and acceptance.
Reader research belongs to plan 32; no completed human study is claimed.

## Delivery sequence

1. Map each existing field to a reader question, purpose, evidence and fallback.
2. Implement purpose-based entry/navigation and a complete composition using existing fields.
3. Align PNG identity exports and factual usage placement.
4. Inspect complete outputs and run the reader protocol from plan 32 when participants exist.

## Acceptance

- [ ] Write a content contract in docs/ux/: identity leads with a supported introduction and two or three distinctive behaviors when available; factual content exposes evidence, coverage, exceptions and unknowns.
- [ ] Keep usage/plan/list-price information factual-only. Activity graphics earn prominence through a useful supported question rather than occupying the hero by default.
- [ ] Remove redundant repetition across portrait, traits and dimensions without discarding accessible supporting or contrary evidence.
- [ ] Use current verified fields immediately; label missing episode/signature inputs as dependencies on plan 20 B/C, never synthesize them in render.
- [ ] Provide intentional sparse/mixed/legacy and heavily excluded compositions; no forced complete role, measured personality strength or inferred outcome.
- [ ] Keep report-language and purpose/view selection independent, keyboard accessible and offline; printing includes the intended factual and identity content.
- [ ] Keep the PNG a legible introduction rather than a miniature dashboard; preserve quote-free cards, project exclusions and long bilingual text handling.
- [ ] Prove rerendering compatible profiles adds zero analysis calls and does not rewrite stored prose; record which changes require future analysis.
- [ ] Inspect full desktop/mobile, light/dark, English/Traditional Chinese, print and PNG artifacts; attach findings to the durable design records rather than infer visual approval from tests.

## Implementation and verification

Likely areas: src/report/, test/report/, docs/ux/report-redesign/; apply the repository report explanation skill.

Follow the shared rules and execution gates in [the plan index](README.md#shared-rules-for-every-plan).
Use behavioral TDD for implementation changes, including a demonstrated failing regression.
Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` before finishing;
record exit codes and test-file counts. Documentation-only work needs no artificial tests.
Preserve offline rendering, module boundaries, private atomic writes and legacy compatibility.
Update matching versions only when their contracts change. Record visual/manual evidence honestly.

## Out of scope

No additional look catalog, mandatory avatar system or new model call. Plan 20 D owns character assets.

## Completion

When all acceptance items are complete, move durable usage/decision notes outside `plans/`,
delete this file and its index row in the same change, and repair incoming links.
