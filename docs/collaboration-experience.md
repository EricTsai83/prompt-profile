# Collaboration reports: evidence, artwork and history

The collaboration experience combines a local report library, verified user-side episodes,
contextual preferences, recurring moves, original abstract artwork and guarded comparisons.
It describes recorded choices rather than personality, competence or assistant performance.

## Reading the report

The identity view retains the connected portrait, categorical preferences and signature moves.
The factual view supplies expanded evidence, episodes, understanding signals, usage coverage,
limits and optional suggestions. Language and view controls work independently, offline and
without JavaScript. Printing includes both views.

A preference needs distinct evidence from two conversations before it is characteristic.
Different approaches can both be characteristic in different contexts. Copied prompt templates
cannot multiply independent support. A complete role requires one characteristic side on all
four axes; otherwise the report uses a general collaboration portrait and neutral artwork.
Coverage counts cited choices, not all tasks where a preference could have been expressed.

Moves cite recurring user-side sequences from at least two conversations. Benefits and costs
need user-reported outcomes from their supporting episodes. Verification requests do not prove
execution, successful results or expertise. Understanding signals distinguish requested practice
from user-reported practice; absent evidence means unobserved. Older profiles are marked as
not assessed for these fields. Cards contain at most two supported move names and no quotations.

## Original abstract artwork

Owner direction on 2026-10-31 approved abstract geometry with less human form, following four
planning, exploration, coordination and verification studies. This replaces the earlier plan's
half-body character requirement. The system contains no face, body, demographic attributes or
inferred likeness. Neutral artwork receives the same visual treatment as resolved roles.

Sixteen catalog entries map to sixteen fixed compositions. Shape, arrangement and linework,
not color alone, distinguish them. `src/report/avatar.ts` owns the original SVG artwork and
version-1 mapping; it is covered by the repository's MIT license. Existing embedded fonts retain
their bundled licenses. No image API, key or model call is required.

```bash
prompt-profile render profile.json --avatar explorer
prompt-profile render profile.json --avatar neutral
prompt-profile render profile.json --avatar none
prompt-profile render profile.json --card-hide graphic
```

Choices are `auto`, `planner`, `explorer`, `coordinator`, `verifier`, `neutral` and `none`.
Auto uses a complete role's composition or neutral artwork. Explicit choices affect only the
render; `none` restores the existing data graphic. `--card-hide graphic` removes the card's
visual entirely. HTML includes accessible descriptions in the selected report languages.

Every render writes `render.json`, including choice, resolved asset ID and art version, alongside
look/version, exclusions, card hiding, name and source. Archived HTML embeds its SVG and PNGs
already contain the artwork, so saved exports remain reproducible even if a future renderer
changes. Re-rendering with a newer renderer may change presentation; it does not alter the
archived analysis. Keep exports when exact historical appearance matters.

Wide report heroes use a separate 2:3 portrait composition: the same compact symbol sits
among vertically arranged nodes, a connecting line and a small work surface. Shapes retain
their proportions. The portrait ID appends `-portrait-v1` to the compact asset ID. A responsive
picture selects this composition above 760 pixels; narrower pages and PNG cards retain the
compact artwork. The period, generation time and analysed coverage form a full-width row below
the hero description and illustration. Saved HTML embeds both compositions.

Offline layout regression checks cover eight widths, both languages and all seven looks. With
a Playwright installation available, run `PLAYWRIGHT_MODULE=<module> node scripts/avatar-rwd-qa.mjs
<report.html> [...]`. Checks verify visible artwork, square/portrait proportions, no overlap or
horizontal overflow, mobile artwork beside the heading, and desktop metadata below the artwork.

## Planned narrative and source context

The existing draft and evidence-review calls now return an outline together with prose. The
outline links a central thread, chapter focus, episodes/patterns, nuance and closing to quotes.
No additional narrative-planning call is added. Invalid references, unsupported quotes or prose
that drifts from the outline remove the whole portrait and its global summary claims, with a
visible limit note. Other independently verified observations can remain.

Detailed portrait and understanding evidence includes conversation numbers, prompt positions
and dates when metadata is available. Session IDs are not displayed. Date exclusion reduces
precision to month; quote exclusion removes both quotations and their source labels. Source
quotes are never translated. The translated prose preserves the verified English structure;
semantic translation accuracy still benefits from human review.

## Comparable windows

New analysis consults the most recent archived report. Comparisons require bounded, equal-length,
nonoverlapping windows, complete unsampled analysis, the same source presence, timezone,
schema/pipeline/analysis versions, runner and effort, and one matching model identity reported
by every model-producing stage. Unknown identities, mixed models and older unknown cache
provenance prevent comparison. Cache hits with recorded provenance can remain comparable.

At most two supported preference differences are shown, with both periods, task contexts and
source evidence. A different role name alone is never growth or regression. Context descriptions
are retained as recorded and may remain in their original generated language. Tool deltas need
complete tool-metadata coverage in both reports. They use neutral visual treatment.

The report stores bounded previous evidence/context, not recursively nested profiles. Many
ordinary rolling-window runs overlap and intentionally show no comparison. Data collection,
task mix and semantic model variation can still explain differences even after these checks.
See [library usage, migration and recovery](history-library.md).

## Acceptance and limits

The later owner-approved [identity/factual purpose contract](ux/report-redesign/purpose-contract.md)
and [output design closeout](ux/report-redesign/output-roles.md) govern content placement.
They retain the connected story in the identity view and the multi-metric card summary
(prompts, conversations, tokens and estimated USD, with coverage qualifiers). These decisions
supersede the older plan's detail-only prose and optional single-statistic card proposals.

Original art was owner-approved in two stages, first reducing human form and then accepting the
abstract studies. Automated checks establish behavior, not aesthetic acceptance or scientific
validity. Fictional production QA covers all seven looks, both languages, 1280/390-pixel pages,
light/dark appearance, opt-out, hidden graphics, long names and exported cards. A visual review
found stretched symbols in the three document-style cards; square dimensions and a regression
check corrected that defect before final acceptance.

Calibration sources and concrete semantic limits are recorded in
[role calibration](ux/model-comparison/collaboration-roles.md),
[structured foundation](ux/model-comparison/collaboration-foundation.md) and
[final two-engine evaluation](ux/model-comparison/collaboration-final.md).
A valid quotation is not proof that every interpretation of it is correct. These are bounded
product checks using fictional cases, not population research or a comprehension study.
