# Report content and UI iteration

Status: production templates implemented and reviewed; owner approved current design for commit; reader walkthrough pending

## Objective

Redesign what the report communicates and how it looks. The owner considers the current report
unattractive; functioning tabs, more charts, or passing layout checks do not resolve that feedback.
The result should introduce a specific person and their way of collaborating with AI, with a
recognizable visual identity and a clear route from a visual overview to deeper evidence.

This is a dedicated design iteration plan, not another implementation checklist for the whole
product. Start from the current two-view report, but do not preserve its composition merely
because it is implemented. Work includes content selection, information architecture, visual
direction, character placement, charts, typography, interactions, and responsive reading.

## Relationship to plan 20

[Plan 20](20-collaboration-profile-experience.md) owns analysis, role semantics, the character
asset system, report history, and longitudinal comparison. This plan owns the report's content
hierarchy, visual direction, and presentation acceptance. It can start immediately with the
existing profile schema and does not wait for every plan 20 phase to finish.

- Use existing verified data for prototypes; do not invent capabilities or new personality scores.
- Identify missing data contracts explicitly and hand those requirements to plan 20.
- Coordinate initial character studies with plan 20 D. Do not implement two avatar systems.
- Keep report history navigation as a future integration point, not a dependency of the redesign.
- Changes to presentation alone must work through `render`, without another analysis call.

## Non-negotiable experience

- A reader may not know the subject. The first screen should answer who they are as an AI
  collaborator, rather than require knowledge of their projects or our classification framework.
- The first view is primarily visual; the second contains the connected portrait, representative
  interactions, supporting and contrary evidence, skill descriptions, and secondary suggestions.
- Evidence starts expanded. Readers do not have to unlock each paragraph or quote to understand
  the person. Optional collapsing may remain as a convenience.
- Roles and characters are original symbolic introductions, never inferred physical likenesses.
  Mixed or missing evidence gets a dignified, informative presentation.
- Language and view switches remain independent and work offline. Existing visibility choices,
  private writes, legacy-profile compatibility, and accessible reading must remain intact.
- No cosmetic chart without an intelligible question, source, denominator and missing-data state.
  No numerical personality score or invented comparison with other users.

## 1. Diagnose the current report before choosing a style

- [x] Capture and annotate the current overview and detail views in English and Traditional
      Chinese at desktop and mobile sizes. Keep real-history captures under ignored local output;
      use fictional data for anything committed or shared publicly.
- [x] Audit existing research in `docs/ux/` and its recorded feedback. Those explorations are
      context, not approved templates for this redesign.
- [x] Record concrete weaknesses with examples and their reading consequences. Investigate the
      oversized generic hero, emphasis on activity rather than identity, repeated rounded panels,
      weak distinctions between section importance, repetitive headings, sparse role information,
      and the space consumed by four unresolved axes. These are hypotheses to inspect, not a
      requirement to replace every component.
- [x] Audit detail-page pacing: repeated claims, excessive quote repetition, unexplained technical
      names, skill inventories without a point, overly long coaching, and unclear evidence context.
- [x] Produce a prioritized critique: what to remove, combine, elevate, simplify, or redesign.
      Distinguish visual issues from missing analysis data and content-quality issues.

Deliverable: `docs/ux/report-redesign/critique.md` with annotated fictional captures.

## 2. Design the content hierarchy

Create a content matrix before styling. For every candidate block, record the reader's question,
its source field, the takeaway, view/position, approximate length, fallback, and exclusion behavior.
Do not render every available field just because it exists in `Profile`.

- [x] Define three reading speeds: a first-screen impression, a brief visual scan, and a deeper
      read. State what a reader should learn at each speed without making unsupported promises.
- [x] Prioritize the overview around a role/character and one-line portrait, two or three supported
      signature behaviors when available, a compact collaboration pattern, and selected tool or
      activity signals. Evaluate which of these deserves the hero rather than assuming a large clock.
- [x] Move counts, generation metadata, engine details and methodological caveats to supporting
      positions. Keep sampling and material uncertainty clear without making them the entire hero.
- [x] Limit overview charts to those that tell something distinctive. Consider whether prompt
      length, correction frequency and activity timing deserve default prominence; avoid treating
      high usage, late work or many skills as inherently impressive.
- [x] Specify an overview that still feels intentional when all four axes are unresolved, the
      profile lacks a portrait, tool metadata is absent, or exclusions remove most personal details.
- [x] Define the detail sequence: introduction, representative interaction and turning points,
      recurring habits and exceptions, relevant skills/tools, and optional next experiments.
      Avoid restating the same paragraph under portrait, traits and dimensions.
- [x] Connect skills to what the person uses them for when supported. Keep complete inventories
      available but subordinate; never imply that agent tool events prove user expertise.
- [x] Define evidence presentation: original quotes, concise context, chronological order,
      supporting versus contrary evidence, and recurrence. Preserve source text and privacy controls.
- [x] Mark which desired content is available now and which requires plan 20 B/C/E. A mockup must
      label synthetic examples and proposed fields; production must not fabricate missing content.

Deliverables: content matrix, two-view outline, and realistic sample copy using fictional profiles.

## 3. Explore genuinely different visual directions

- [x] Produce three substantially different compositions using the same fictional content, not
      three palette changes. Possible starting points are a character-led portrait, an editorial
      field guide, and a diagram-led collaboration map; evaluate rather than preselect these labels.
- [x] For each direction, design the desktop first screen, overview structure, a representative
      detail passage with evidence, and a mobile composition. Show the mixed-evidence state too.
- [x] Define type scale, reading width, spacing rhythm, color roles, visual hierarchy, chart
      language, character placement and component shapes. Avoid making every block an equal card.
- [x] Include an original character study or an explicitly labeled placeholder; coordinate with
      plan 20 D. Evaluate whether the character helps recognition without overwhelming the profile.
- [x] Compare the directions side by side with the current report, including tradeoffs in
      distinctiveness, readability, content density, unknown states and implementation cost.
- [x] Gather the owner's visual and content feedback and record the chosen direction and rejected
      elements. Technical validation is not aesthetic acceptance. If feedback has not arrived,
      label any working direction provisional and continue only reusable work without claiming approval.

Deliverables: local HTML comparison prototypes and `direction.md`, with fictional assets/captures
under `docs/ux/report-redesign/`. No server or external assets should be required to open them.

## 4. Iterate a complete report, not just a polished hero

- [ ] Build one complete overview and detail experience in the selected direction, using realistic
      variation in titles, prose, quotes, skills, counts and available evidence.
- [ ] Prototype page/view navigation, language controls, selected states, evidence reading and
      optional presentation controls. Add only controls with a clear reader benefit.
- [ ] Refine every chart's labels, units, legend, zero/missing state and nearby interpretation.
      Categorical preference illustrations must not imply measured numerical strength.
- [ ] Refine detail typography, transitions, quote treatment and tool descriptions. The prose
      should remain connected when the reader ignores charts and source excerpts.
- [ ] Coordinate a matching PNG-card composition: a concise introduction, not a miniature dashboard.
      The report and card should look related without requiring identical layouts.
- [ ] Evaluate desktop, narrow mobile, English, Traditional Chinese, long names, mixed scripts,
      long quotes, small/large histories, absent metadata and all supported exclusion combinations.
- [ ] Inspect full-page output, below-the-fold sections, dark/light appearances and print.
      Do not infer readability or visual quality from the first viewport or DOM tests alone.
- [ ] Keep a brief iteration log linking each material change to feedback or an observed problem.
      Separate cosmetic improvements from changes in which story the report tells.

## 5. Implement the chosen design in the renderer

- [ ] Move the selected composition, content-selection rules and reusable visual tokens into
      `src/report/`; keep the report independent of adapters, analysis internals and network calls.
- [ ] Keep fixed English/Traditional Chinese interface text in `src/report/messages.ts`. Reuse
      translated generated content; renderer copy must not invent or strengthen personal claims.
- [ ] Preserve provenance, accessible text equivalents, exclusions, proper escaping, CSP and
      offline embedded fonts/assets. Avoid mandatory animation; honor reduced-motion preferences.
- [ ] Ensure switching views or languages preserves the other selection and remains keyboard
      accessible with visible focus. Printing must include the intended content from both views.
- [ ] Integrate new role assets when available, with a deliberate interim fallback rather than
      blocking all visual improvements on the full character catalog.
- [ ] Clarify whether existing looks adapt to the new composition or remain compatibility styles.
      Do not multiply presets without a useful visual distinction. Bump render/asset versions.
- [ ] Update fictional public examples and usage documentation. Re-render a private real profile
      in a separate output folder for acceptance, without uploading data or another analysis call.

## Acceptance and iteration exit

- [ ] The owner has reviewed a complete direction, including both views and mobile; unresolved
      feedback is recorded. The deliverable is not called finished merely because it looks different.
- [ ] In a simple reader walkthrough, a person unfamiliar with the subject can describe the
      collaboration style and cite a concrete example without decoding our internal schema.
      Record observations honestly; do not fabricate user-study results.
- [ ] Overview content has a clear order of importance; charts have a reason to exist and the
      sparse/mixed state is designed. Detail content is readable with evidence already visible.
- [ ] Browser interaction checks pass for view/language selection, quote visibility, exclusions,
      keyboard access, responsive overflow, unclipped text, offline operation and print coverage.
- [ ] Visual inspection covers complete desktop/mobile reports in both languages and the card.
      Screenshots support inspection; snapshot matches alone do not establish good design.
- [x] Use behavior-first tests for implementation changes and verify new tests fail before the
      corresponding fix. Do not write tests that merely assert arbitrary CSS values.
- [x] Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` and build checks
      appropriate to embedded assets. Record test-file counts and any remaining limitations.
- [ ] Keep the durable design decisions in `docs/ux/report-redesign/`. When every box is complete,
      remove this plan and its index row, and fix incoming links in the same change.

## Phase 1–3 handoff

Fictional annotated baseline captures, critique, content matrix and three offline composition
studies are in [report-redesign](../docs/ux/report-redesign/direction.md). Owner direction
selection remains open; no production renderer changes, private-history reads or analysis calls.
Independent Codex review is coordinated separately before requesting owner feedback.

## Production iteration — original selectable templates

The owner rejected A/B/C. The current baseline was relatively preferred, but remains
insufficiently attractive. The owner accepted product UI research principles and authorized
implementation of multiple original templates; the previous selection gate no longer blocks work.

Prism, Slate and Folio now render through the existing `--look` path with matching cards.
No profile, analysis or pipeline version changes are required. Look design version is 4;
render manifest remains 2 because its format has not changed. Classic remains the default.

Independent implementation review completed in two passes; R2 card overflow was fixed and
confirmed. R1 was withdrawn after owner clarification: project names follow the same exclusion
choice in the report and card. Post-fix checks passed: 43 test files / 486 tests, installed-package build check,
27 report browser cases and 48 long CJK/mixed-script card cases. Complete edge-case visual
acceptance and actual owner reader walkthrough remain outstanding. Do not treat technical checks as
visual acceptance or delete this plan.

## Explanation skill application

Production overview charts now expose source units, stored tool session numerators, actual
denominators, coverage and overlapping categories. Missing measurements, zero metadata coverage,
zero cleaned samples and observed zero are distinct. Unknown preferences have no midpoint marker.
Fixed bilingual explanations apply on re-render; description prompt changes apply only to future
analysis (analysis version 11). See the [source audit and authored examples](../docs/ux/report-redesign/explanation-iteration.md).
Owner visual acceptance and a reader walkthrough remain open; no real LLM evaluation is claimed.

## Document layout follow-up

Shared spacing and A4 print styles were implemented with six fictional PDF review artifacts.
See [document layout observations](../docs/ux/report-redesign/document-layout.md) for physical
page inspection and reproduction. Independent review completed in two passes; excess blank
pages, Classic coverage and split capability headings were fixed and confirmed. The six review
PDFs now have 10 pages each, and Classic is included in 33-case browser QA. The owner's complete
visual walkthrough remains pending; this plan remains open.

## Open composition follow-up

The owner accepted the overall baseline and requested fewer card blocks and more varied
presentation. The shared report body now uses inline statistics, unequal chart columns,
a narrative/context aside, ruled traits and dimensions, and open capability/coaching text.
Classic receives the same body improvements; its default status and the three selectable
product identities remain. Look version is 7. See [open composition](../docs/ux/report-redesign/open-composition.md).
The CLI output contract is documented: HTML/JSON/PNG are automatic; PDF is a manual browser
print export from the same offline HTML, without another analysis. Owner review of this
revision remains pending. Independent review completed with no findings; no aesthetic
acceptance checkbox is inferred from implementation checks.


## Owner decision - 2026-10-29

The owner accepted the current open composition and requested scoped commits on main.
This records acceptance of the current design iteration, not a completed unfamiliar-reader
walkthrough or validation of every report/language edge case. Plan 21 remains open for those
remaining acceptance items. Generated PDF review exports remain local; reproducible fictional
HTML examples, research captures and QA tooling are versioned. The report explanation skill
is versioned at `.agents/skills/prompt-profile-explain-reports/SKILL.md`.

## Owner direction - output roles (2026-10-29)

The owner finds the current split between the HTML report and the PNG card unhelpful. Two
outputs matter, defined by purpose rather than file format:

- **Factual report:** a truthful, complete presentation of the information, with sources,
  denominators and unknowns.
- **Identity report:** a fun, recognizable introduction of the person.

Today the "Profile & evidence" view comes closest to the factual role, and the visual overview
plus the card come closest to the identity role. Remaining composition work should restructure
the outputs around these two roles. [Plan 23](23-usage-plan-and-api-equivalent-cost.md) already
places usage, plan and cost in the factual report only.
