# Collaboration profile experience

Status: planned

## Outcome

Make prompt-profile a readable, visual introduction to how a person collaborates with AI,
with an original role and character system, evidence-backed interaction stories, and a local
library of reports over time. The reader may be the subject or someone who has never met them.

This plan records the unfinished work from the product discussion. It does not mark earlier
working-tree changes as released, and it does not require replacing the working implementation.

## Working baseline: already implemented

- Third-person portrait introduction and connected chapters, with verified source quotes.
- Session identifiers in map input and cited prompt origins in reduce input.
- Four original preference axes: framing, pacing, control, and closure.
- Sixteen stable English role names, with no complete role when an axis is unresolved.
- A conservative verifier: a pole needs quotes from at least two sessions and no verified
  counterevidence. This is an initial guardrail, not a calibrated classification method.
- Two offline HTML views: visual overview and detailed portrait/evidence/skills; evidence
  starts expanded. Language selection is independent of view selection; printing includes both.
- English and Traditional Chinese generated prose, HTML and cards, existing visibility controls,
  private atomic file writes, and migration of older profiles.
- A previous-report snapshot of selected statistics and improvement titles. This is not an archive.
- Synthetic demonstration data and a separate, ignored local report generated from real history.

Do not redo these as new features. Extend their behavior and verify compatibility.

## Product boundaries

- Describe observed collaboration preferences, not fixed personality, psychological diagnoses,
  sensitive attributes, or a person's likely physical appearance.
- Usage intensity, demonstrated understanding, technique breadth, and collaboration preference
  are separate concepts. More tools or prompts does not mean greater expertise.
- Keep role definitions, names, art, copy, and branding original. Do not reproduce MBTI or
  16Personalities questions, descriptions, illustrations, or branding, or imply affiliation.
- Do not force sixteen categories onto evidence that does not support them. Revisit overlapping
  axes before expanding the role presentation. No fabricated population ranks or personality scores.
- Ordinary generation must not require an image-generation API, account, new API key, or image call.
- Raw prompt history and real generated profiles must never become committed fixtures or demos.
- Preserve the current local CLI model, modular dependency boundaries, and offline report behavior.

## Delivery sequence

| Phase | Deliverable | Depends on |
|---|---|---|
| A | Local report library and safe history retention | Existing report writer |
| B | Structured interaction episodes and recurring patterns | Existing verified observations |
| C | Calibrated original roles, signature habits, and understanding signals | B; evaluation cases can start earlier |
| D | Original character art and deterministic avatar renderer | Art studies can start now; final mapping depends on C |
| E | Narrative planning and meaningful change over time | A, B, C |
| F | Integrated visual experience, evaluations, and release preparation | A–E |

Complete each phase with its relevant tests and the shared checks. Do not wait until F to
verify behavior. Final acceptance requires every phase below; unrelated distribution ideas
(Homebrew, install script, additional adapters) are outside this plan.

## A. Preserve multiple reports under one output root

Proposed layout:

```text
my-profile/
  index.html
  library.json
  reports/
    2026-10-29T060000Z-<unique-suffix>/
      profile.json
      report.html
      card.png
      card.en.png
      variants/
        <render-variant>/
          report.html
          render.json
          ...
```

The output root is a library; a successful analysis publishes a new immutable report directory.
`library.json` is a versioned, rebuildable index, not another copy of all profile content.
The homepage links to the latest completed report and lists date, data window, sampling,
role when available, languages, and engine. Links are relative and usable from `file://`.

- [ ] Define library/run manifests and CLI path resolution, preserving standalone `render` input.
- [ ] Give each run a collision-safe ID; repeated runs on one day and simultaneous runs must
      not overwrite each other. Cache reuse does not erase the distinction between reports.
- [ ] Stage a run privately, publish it after profile and HTML succeed, then update the index.
      A card failure remains nonfatal and is explicitly represented in the run's output metadata.
- [ ] Make interrupted generation and index failures recoverable. An unfinished run must never
      become the latest report; index repair must discover completed reports without executing HTML.
- [ ] Serialize index publication or rebuild it safely so concurrent writers cannot lose entries.
- [ ] Render the bilingual homepage without network calls or required JavaScript. Escape metadata,
      validate paths, and handle missing/corrupt run manifests without exposing arbitrary files.
- [ ] Keep legacy root-level `profile.json` readable. Preserve it and its artifacts before an
      upgraded analysis could replace them; never silently delete a pre-library report.
- [ ] Attach appearance variants to their source run. Re-rendering must not mutate archived
      analysis data or advance the latest-analysis pointer. Explicit external output stays supported.
- [ ] Retain all completed reports by default. Do not add automatic deletion or retention cleanup.
- [ ] Verify permissions, collision handling, concurrent publication, interrupted runs, legacy
      migration, index repair, bilingual navigation, and offline links with synthetic reports.

Implementation: `cli/commands/analyze.ts`, `cli/commands/render.ts`, `cli/steps.ts`,
`report/`, and private-file utilities in `platform/`. Rendering still consumes domain data only.

## B. Preserve interaction episodes before summarizing the person

The current prompts ask the model to preserve episodes, but the schema still stores generic
observations and chapter-level evidence. Make chronology and provenance explicit data.

- [ ] Add domain structures for an episode (session, ordered turns, task context, user
      interventions, observable ending or unknown outcome) and a pattern (supporting episodes,
      spread, counterexamples, and task context). Use redacted excerpts, not a second raw transcript.
- [ ] Carry source session, timestamp, and turn order through chunking, map, merge, and reduce.
      A session split across chunks must remain identifiable; omitted turns must be apparent.
- [ ] Verify quoted text, session membership and chronological order. Reject invented turns,
      reordered evidence, or multiple sessions presented as a single conversation; count rejections.
- [ ] Keep user requests separate from observed outcomes. With user-only prompts, never invent
      assistant replies, successful completion, saved time, or causality that the record cannot show.
- [ ] Preserve contradictory examples and recurring patterns through evidence caps and merging,
      instead of retaining only the easiest opening quote from each chunk.
- [ ] Define how sampling selects representative episodes across time and task contexts. Expose
      coverage and missing data, and distinguish analyzed evidence from full-history statistics.
- [ ] Test repairs, abandoned directions, short but well-contextualized follow-ups, split sessions,
      missing turns, mixed task types, and injected instructions using hand-written data.
- [ ] Bump profile/analysis versions as needed, migrate older reports, and invalidate affected caches.

Implementation: `domain/`, `analysis/chunk.ts`, map/merge/reduce schemas and prompts,
`analysis/verify.ts`, and `analysis/portrait.ts`. Change adapters/pipeline only when needed;
run real-data smoke checks if those modules change, without logging personal content.

## C. Finish the collaboration-role product

Existing role names are a starting catalog, not a finished personality system. Retain stable
identifiers while evaluating whether the axes describe distinct, observable preferences.

- [ ] Specify each pole with positive examples, counterexamples, insufficient-evidence cases,
      task-context effects, and what must not be inferred from prompt length or tool events.
- [ ] Evaluate overlap between pacing and decision ownership. Revise axes or catalog size if
      synthetic examples cannot distinguish them; do not preserve sixteen types merely for symmetry.
- [ ] Replace the single `unclear` presentation with explicit reasons for insufficient evidence,
      conflicting evidence, or task-dependent preferences. A counterexample should trigger analysis
      of context, not automatically erase all useful information about the person's behavior.
- [ ] Aggregate support at the session level, report spread and eligible evidence coverage, and
      prevent one very long conversation or repeated boilerplate from dominating classification.
- [ ] Define evidence-strength reporting without numerical personality scores. No complete role
      is assigned until all required preferences are sufficiently supported.
- [ ] Review all role names and write original bilingual names and descriptions in a deterministic
      catalog. Translation must not invent a different role name on each run.
- [ ] Give each role a collaboration description, common working rhythm, suitable contexts,
      and potential friction. Avoid flattering, diagnostic, gendered, or hierarchical labels.
- [ ] Extract evidence-backed "signature moves": memorable names, observable sequences, situations
      where they help, possible costs only when supported, source quotes, and recurrence/spread.
- [ ] Present usage intensity, technique breadth, and demonstrated AI understanding separately.
      Understanding signals include context management, uncertainty, tool boundaries, verification,
      and recovering from mistakes. Missing evidence means unobserved, not lack of competence.
- [ ] Distinguish user-requested techniques from autonomous agent actions. Asking about a tool
      does not prove using or understanding it; using many tools is not an expertise grade.
- [ ] Extend synthetic evaluation cases to include both poles, contextual variation, fluent short
      prompts, heavy novice usage, sparse expert usage, and genuinely mixed collaboration.
- [ ] Measure repeat-run classification stability and show known limitations. Treat this as
      product calibration, not scientific validation of personality.

Implementation: `domain/Interaction.ts`, profile/LLM schemas, analysis verification and prompts,
`report/messages.ts`, translation alignment, and overview/detail renderers.

## D. Design and ship original role characters

Coordinate character studies and placement with the [report design records](../docs/ux/report-redesign/output-roles.md),
which owns the report visual direction; this phase owns the reusable asset system.

Create a symbolic collaboration avatar, not an inferred likeness of the report subject.
Use a cohesive vector illustration system that works with the existing SVG/Satori stack.

- [ ] Establish an original art direction: restrained palette, consistent half-body proportions,
      recognizable silhouettes, simple linework, and a neutral background. Ensure original assets
      and appropriate asset/font licenses; do not copy existing personality-test characters.
- [ ] Produce 3–4 initial character studies and test them in the HTML hero, overview and PNG card
      at desktop, mobile, small-card, light and dark sizes before expanding the artwork set.
- [ ] Use a small vocabulary of actions/props (planning, exploration, coordination, verification)
      within complete compositions. Avoid piling one accessory per axis onto a generic figure.
- [ ] Create enough coherent compositions to represent the approved role catalog. Shared base
      assets are allowed; distinct roles must remain recognizable beyond color differences.
- [ ] Provide a neutral/mixed-evidence character and missing-asset fallback. Neither should look
      inferior or imply an unsupported role. Do not infer age, gender, ethnicity or actual appearance.
- [ ] Make the avatar deterministic for a role and art version; rerendering must not randomly
      change identity. Define versioned asset IDs and how archived renders preserve reproducibility.
- [ ] Allow a simple render-only avatar choice or opt-out. A user's visual preference must never
      change the inferred role or its evidence. Record choices in render metadata.
- [ ] Integrate the character into HTML and PNG cards, with bilingual accessible descriptions,
      embedded assets, sensible cropping and stable layout across looks and exclusions.
- [ ] Preserve existing `--card-hide graphic` behavior or provide an explicit compatible migration.
      Add no required image service or extra model call to ordinary profile generation.
- [ ] Verify deterministic output, legacy-profile fallback, opt-out, long role names, narrow cards,
      and exported assets. Render and visually inspect the final HTML/card compositions.

Per-user image generation remains an optional future extension, not a requirement of this plan.
Do not silently add it: first establish the vector system's quality. If later pursued, specify
provider support, cost, consent, image privacy, retries and fallback in a separate plan. Use the
applicable image-generation skill if creating raster art; code-native SVG work needs no image call.

## E. Deepen the narrative and changes over time

- [ ] Add a structured narrative outline before prose generation: central thread, representative
      episode, connections to recurring patterns, evidence references, nuance, and closing insight.
      Prefer the existing reduce call where possible; document any additional calls and update estimates.
- [ ] Verify the outline against supported episodes/patterns before using it. Invalidated evidence
      must not leave unsupported introduction claims, transitions or ending claims in the report.
- [ ] Let different people have different narrative arcs. Explain context for unfamiliar readers,
      then weave role, signature moves and understanding into the story rather than concatenating fields.
- [ ] Show source context (session, sequence and appropriate date precision) near detailed evidence,
      honoring every exclusion. Label counterevidence separately from supporting evidence.
- [ ] Keep coaching secondary: one or two useful experiments linked to observed habits, with no
      invented costs or generic deficiencies. Clear prompting may need no improvement suggestion.
- [ ] Use archived reports for optional longitudinal comparisons. Compare data windows, sampling,
      tool-metadata coverage, analysis/schema versions and classification rules before claiming change.
- [ ] Distinguish changes in observed behavior from changes in available data, engine, or rubric.
      Do not describe a different role label alone as personal growth or regression.
- [ ] Show a small number of supported changes and their evidence; omit the section when reports
      are not comparable. Never recursively embed entire report histories into each profile.
- [ ] Verify bilingual outline/prose alignment, evidence removal, weak-data fallbacks and changed
      classification versions using synthetic historical reports.

## F. Integrate and verify the final experience

The [completed report design iteration](../docs/ux/report-redesign/output-roles.md) owns content hierarchy, design alternatives and
report UI iteration. Integrate its selected design here rather than run a competing redesign.

- [ ] Refine the existing two-view report rather than reintroducing a long collapsed dashboard.
      The overview leads with character/role, signature moves and meaningful charts; the detail
      view carries connected prose, expanded evidence, skills, limits and secondary suggestions.
- [ ] Keep unknown and mixed states legible in the overview. Use categorical preference visuals,
      real statistical denominators and distinct missing-data states; avoid misleading precision.
- [ ] Keep PNG cards focused: character, original role, one-line portrait and two signature moves
      when supported, optionally one statistical fact. Do not shrink the full report onto a card.
- [ ] Retain independent language and view selection, keyboard access, visible focus, responsive
      layout, print coverage, offline assets, CSP and all exclusion/privacy controls.
- [ ] Extend the existing persona evaluation harness and model-comparison protocol to cover
      episodes, role consistency, signature moves, non-invented outcomes and narrative specificity.
      Record model identity when known; do not guess it when the CLI does not report it.
- [ ] Evaluate repeatability, false certainty, evidence relevance and reader comprehension, not
      only quote existence. Keep manual quality findings distinct from automated rubric results.
- [ ] Run paid real-CLI comparisons as a deliberate bounded evaluation with recorded call counts,
      retries and coverage; do not turn ordinary unit tests into quota-consuming tests.
- [ ] Update entirely fictional committed demos, English documentation, migration notes and version
      tables. Keep any private real-history acceptance run under ignored output directories.
- [ ] Verify history preservation and the complete bilingual workflow with no new analysis on render.
- [ ] Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`, then build/package
      checks appropriate to any newly embedded assets. Judge test files as well as test counts.

## Completion

When all acceptance boxes are complete, remove this plan and its index row in the same change,
fix incoming links, and keep the design/usage documentation outside `plans/`. Completed details
remain available through git history. Do not delete the plan merely because one phase ships.
