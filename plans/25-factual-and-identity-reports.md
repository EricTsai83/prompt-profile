# Factual and identity report experience

Status: Implementation complete; final PNG owner review pending (reader research remains in plan 32)

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

- [x] Write a content contract in docs/ux/: identity leads with a supported introduction and two or three distinctive behaviors when available; factual content exposes evidence, coverage, exceptions and unknowns.
- [x] Keep detailed usage/plan/list-price information in the factual HTML view; allow selected usage and clearly labeled API list-price estimates on PNG per the owner review below. Activity graphics earn prominence through a useful supported question rather than occupying the hero by default.
- [x] Remove redundant repetition across portrait, traits and dimensions without discarding accessible supporting or contrary evidence.
- [x] Use current verified fields immediately; label missing episode/signature inputs as dependencies on plan 20 B/C, never synthesize them in render.
- [x] Provide intentional sparse/mixed/legacy and heavily excluded compositions; no forced complete role, measured personality strength or inferred outcome.
- [x] Keep report-language and purpose/view selection independent, keyboard accessible and offline; printing includes the intended factual and identity content.
- [x] Keep the PNG a legible introduction rather than a miniature dashboard; preserve quote-free cards, project exclusions and long bilingual text handling.
- [x] Prove rerendering compatible profiles adds zero analysis calls and does not rewrite stored prose; record which changes require future analysis.
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

### Integration checkpoint — 2026-10-29

The [production purpose contract](../docs/ux/report-redesign/purpose-contract.md) maps current
fields, fallbacks, repetition policy and future-analysis dependencies. All card looks now omit
low-confidence and unsupported trait labels, matching the HTML featured-observation rule.
A new behavioral regression failed before implementation and passed afterward across all looks.
Classic advances to version 6; other looks to 12. No analysis/profile/pipeline contract changes.

Validation: typecheck, lint, format:check and full tests each exited 0; 58 test files passed,
638 tests passed. Fresh visual inspection and participant research are not claimed. Remaining
acceptance boxes stay open, including repetition review and complete export/layout inspection.

### Owner review direction — share card, 2026-10-29

The owner wants the PNG to be more interesting and self-explanatory: selected usage counts,
tokens and API list-price equivalent can complement the collaboration introduction. This
supersedes the earlier factual-only usage restriction for PNG (the identity HTML view remains
unchanged). Reuse measured usage; do not imply that API list-price equivalent is actual spend,
subscription savings or a bill. The current contract does not establish actual payments or human
time spent. Missing or partially priced usage needs an honest compact state, never a fabricated zero.

Replace or explain the ambiguous `npx prompt-profile` footer; a clear product attribution is
preferable to an unexplained shell command. Review the hierarchy, copy and small-screen appeal
of the entire card rather than merely adding more numbers. The next PNG review should show a
clear introduction, a small selection of interesting measured facts, a labeled price estimate
and understandable attribution. Character integration can follow plan 20 D; it is not a blocker.

### Final implementation checkpoint

The owner accepted the content and purpose-switching round, then requested centered navigation.
Navigation is centered at desktop and mobile widths. Story headings now share the section edge;
only the prose retains the reading measure. The broader content repetition review is complete:
document looks omit duplicate featured descriptions; source evidence remains available in facts,
and stored generated prose is not rewritten. No new analysis call is needed.

PNG now includes up to two supported behavior names, prompt/conversation counts, tokens and API
estimates. It distinguishes unmeasured, unpriced, partially priced and incomplete logs. Usage and
prompt periods are separate; exclusions and hidden stats affect both labels and periods. The
unexplained command footer is replaced with localized product attribution. Character art remains
in plan 20 D. Production Profile, analysis and pipeline contracts are unchanged.

Technical validation and agent visual inspection are recorded in the
[durable purpose contract](../docs/ux/report-redesign/purpose-contract.md). The remaining open
review is the owner's revised PNG review; do not interpret automated checks as that approval.
Real participant sessions remain entirely owned by plan 32 and do not block this feature closeout.
