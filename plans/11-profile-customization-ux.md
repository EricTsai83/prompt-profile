# Profile customization UX research plan

Status: stages 1 (plan and baseline) and 2 (presentation experiment) done; stages 3–6 not
started. Production customization is not implemented by this plan.

## Goal

Find the smallest useful set of choices that makes a profile feel relevant, readable and safe
to share. Explore all three meanings of a "profile version": content direction, report design,
and model output. Do not turn the CLI into a prompt editor or make people configure it before
seeing a useful result. This revisits the current "minimal customization" decision; it does not
silently replace it.

This document and the accompanying prototype are the deliverable for this stage. Implementing
new production flags, changing analysis prompts or publishing personal profiles is a later step.

## Current behavior, verified in the repository

1. Read local history through the adapters; filter, clean, redact and truncate prompts.
2. Build roughly weekly chunks, sample up to 30 by default, and calculate deterministic statistics.
3. Show the base call estimate and ask before calling the logged-in CLI; `--yes` supports scripts.
4. Map chunks to observations, verify quotes, merge oversized observations and reduce to a profile.
5. Verify final evidence, deduplicate quotes and cap confidence for insufficient independent support.
6. Write `profile.json`, offline `report.html` and a 1200 × 630 `card.png`.

Existing controls: `--since`, `--full`, `--engine`, `--model`, `--max-calls`, `--no-cache`, `--out`,
`--dry-run`, `--yes` and `--verbose`. `render` accepts an existing profile without another LLM call.
There are no shipped style, focus, theme, depth or language flags. Generated text is English;
quotes retain their original language. The report has five fixed dimensions, and the renderer
has one layout with system light/dark styling.

Sources: [CLI](../src/cli/main.ts), [analysis](../src/analysis/index.ts),
[reduce instructions](../src/analysis/prompts/reduce.md), [profile schema](../src/domain/Profile.ts),
[HTML](../src/report/html.ts), [card](../src/report/card.ts).

## What users may choose, and what the product must define

The choices below are research candidates, not a promise to ship every control.

| Area | User choice to study | Defined by the product | When it takes effect |
| --- | --- | --- | --- |
| Data scope | Time range; later source/project inclusions and exclusions | One consistent subset for both statistics and analysis; visible coverage | New analysis; some cached chunks may remain reusable |
| Purpose | Work mirror, growth journal, share story | Three bounded presets with explicit instructions; a useful default | Rendering when only selection/order changes; reduce when narrative changes |
| Tone | Direct or lightly playful | Honest, respectful and evidence-based; no flattery/roast/diagnosis modes | New narrative requires reduce |
| Depth | Concise overview or detailed reading | Defined section budgets and a stable five-dimension schema | Render first; extra interpretation requires reduce |
| Report design | Signal, Afterhours, Studio | Accessible layouts, typography, contrast and bundled fonts | Render only; zero LLM calls |
| Display | Section visibility, evidence expansion, selected metrics | Missing evidence stays visible; confidence cannot be hidden to imply certainty | Render only |
| Share privacy | Omit project labels, activity times and selected metrics | Card never exposes evidence quotes; separate explicit share preview | Render only; does not sanitize the private source JSON |
| Title | Optional custom display title | Label user-edited text; retain generated title and provenance | Render only, without changing inferred traits |
| Model | Existing engine/model selection, placed under advanced options | Same data and verification contract; explicit model provenance where available | LLM calls; cost and output can change |
| Repeated runs | Named variants, compare, retain or delete | Non-overwriting output paths and clear lineage | Export and storage workflow |

Keep these fixed: evidence matching and deduplication, confidence rules, deterministic statistics,
redaction defaults, private file modes, factual/sensitive-inference constraints, schema semantics,
cache compatibility, quota confirmation and English product output. Theme or purpose must never
invent personality scores, change counts, upgrade confidence or hide an evidence failure.

Do not initially expose arbitrary analysis prompts, custom JavaScript/CSS, downloadable font URLs,
a confidence slider, MBTI/clinical labels, or controls that disable verification/redaction. These
would expand the contract beyond a small, understandable customization surface.

## Experiments

Change one axis at a time. Avoid a full preset × theme × model × depth Cartesian product.
Use the same synthetic input and a neutral name while comparing alternatives.

### A. Content direction: three versions of the same evidence

- **Work mirror:** emphasize planning, delegation, collaboration and recurring work habits.
- **Growth journal:** emphasize learning questions, experiments and evidence across time. If the
  selected history does not support a progression, say so instead of inventing improvement.
- **Share story:** use a short headline, a compact archetype and at most three supported traits.
  This is a display preset first; concise does not mean exaggerated.

Keep all five canonical dimensions in the private profile. Start by changing section emphasis,
order and length in a prototype. Only test alternative reduce instructions when presentation
alone cannot answer the need. Preserve the same evidence pool, counts and confidence rules.
Compare direct/playful wording within the winning content direction, not across different models.

### B. Design: three layouts, without re-analysis

The owner rejected the initial editorial directions as dated and insufficiently shareable.
The revised candidates are share-first, each with an explicit visual identity:

- **Signal:** cobalt, expressive sans typography and a data-derived activity trace.
- **Afterhours:** midnight blue, an activity orbit and a quieter night-session identity.
- **Studio:** a white/coral split composition and a folded conversation motif.

See the [design brief](../docs/ux/startup-design-brief.md) for palettes, typography, first-pass
critique and the frontend-design skill reference. The [revised prototype](../docs/ux/startup-profile-prototype.html)
uses the same synthetic profile and offers a real local share-preview dialog with visibility controls.
These controls are prototype interactions, not production CLI customization or PNG export.

Render the same serialized profile in each layout. Verify that switching a theme preserves the
profile hash and starts no CLI process. Inspect desktop, 390px mobile, 360px mobile, light/dark,
keyboard focus and the 1200 × 630 card. Test long titles, CJK quotes, absent evidence and large counts.

### C. Model output: a controlled comparison

Use the three synthetic personas already under `test/eval/personas/`. For each available engine,
record an explicit model when supported, the CLI version, analysis/pipeline versions, input hash,
selected prompt IDs, sampling policy, call count, retries, coverage and runtime. A null model from
Codex is "unknown", not a guessed model name. Availability is established locally, not assumed.

First run one supported model per engine, twice per persona: 3 personas × 2 engines × 2 repeats
= 12 profile analyses if both engines are available. Show a call-budget estimate and set a hard
budget before executing this later experiment. A profile analysis can contain multiple CLI calls;
12 analyses is not 12 calls. Expand to a second model only if there is a specific unresolved question.

Compare outputs blind in the same layout, using the deterministic rubric plus human review:
specificity, factual support, usefulness, contradictions, sensitive inference and overconfident
language. Keep engine labels hidden during preference testing and restore provenance afterward.
Separate stochastic variation from a model effect. The current three Claude persona runs are a
pipeline/quality baseline, not evidence that Claude is better than Codex.

## Proposed user journeys

These are scenarios to prototype, not implemented command syntax.

1. **First run:** keep the current default command; show scope, privacy and a base call estimate;
   generate a useful default report without a mandatory customization questionnaire.
2. **Change the look:** choose a local render preset, preview it, then save it to a new folder.
   Explicitly show "No new analysis; no LLM calls" and keep the original profile unchanged.
3. **Change the story:** choose another content direction; explain whether it only changes
   presentation or requires a new reduce call. Show the estimate/budget and require confirmation
   for additional calls. Never imply that every preset can reuse the same map observations.
4. **Prepare a share card:** preview the exact export with project/time/metric visibility choices;
   distinguish that export from the private HTML and JSON. Show the chosen filename before saving.
5. **Compare a model:** put engine/model selection under advanced options; retain the original
   variant, generate into another folder and compare equal-scope reports with provenance visible.
6. **Repeat in scripts:** offer explicit flags after the winning concepts are clear; do not depend
   on a browser or TTY. Reject unknown preset names and conflicting options with useful errors.

Test whether a preset selector should appear in the terminal, in a separate local preview, or only
as documented render flags. An interactive preview would be a separate artifact; the exported
report should remain offline and script-free unless research establishes a reason to change it.

## Research method and decision gates

Recruit 6–8 developers: first-time users, repeat CLI users, privacy-conscious users and people with
small/large or multilingual histories. Use only synthetic data for recording sessions and screenshots.
Counterbalance order within participants; do not always show the preferred design first. A small
qualitative study identifies confusion and useful directions, not population-level preference.

Tasks: explain what will leave the machine; generate a default; change its appearance without
spending quota; choose a content purpose; open the supporting evidence; prepare a share export;
then compare two blind model reports. Ask participants to explain the consequences before acting.

Proceed only when:

- At least 6 of 8 participants distinguish a free render from a new analysis without prompting.
- At least 6 of 8 finish theme selection and locate evidence without assistance.
- Every participant in the final validation round understands that private JSON/HTML may contain
  quotes and is different from the share card; any confusion triggers redesign and another check.
- No candidate loses verified evidence/coverage warnings or changes statistics through styling.
- The winning design has no clipped content at tested widths, readable long labels and visible focus.
- Model/preset variants pass the existing rubrics and human review without new sensitive claims.

These are proposed go/no-go criteria. Do not claim they have passed until participants are tested.
Keep decisions that fail to improve usefulness out of the first implementation.

## Screenshot-based verification

A screenshot shows visible output, not proof of privacy, zero network activity or factual accuracy.
Pair it with an observed process-call count, unchanged profile hash, evidence checks and keyboard checks.

| ID | Screenshot evidence | What to compare | Non-visual check |
| --- | --- | --- | --- |
| S0 | Current HTML at 1440px and 390px | Baseline hierarchy, wrapping, evidence affordances | Real renderer + synthetic sample |
| S1 | Three content directions with the same evidence and numbers | Relevance, specificity, uncertainty | Quote IDs/counts/confidence invariant |
| S2 | Three layouts of the same profile at desktop and mobile widths | Hierarchy, density, long-title behavior | Identical profile hash; zero LLM calls |
| S3 | Before/after theme change and before/after story change | Does the UI explain free vs paid? | Record which stages and calls actually ran |
| S4 | Private report next to exact share-card export | Visibility of quotes, project names, time and metrics | Search serialized export and inspect PNG tree |
| S5 | Blind model reports, then provenance revealed | Groundedness, uncertainty and user preference | Same input manifest; rubric + human review |
| S6 | Missing evidence, exhausted budget, long labels, light/dark and focus | Warnings survive all presets | Existing failure behavior remains intact |

Store synthetic screenshots and their capture manifest under `docs/ux/screenshots/`. Each capture
records the source path/hash, view, viewport, appearance and whether it is actual output or a
research prototype. Label prototype captures as "not shipped" in the gallery and manifest. Full-size card captures
show the exact composition without surrounding UI; their captions retain the research status. For model
comparisons, never fill a missing result with invented model output. Record "not run" explicitly.
Real personal outputs stay outside git and are never substituted for synthetic research fixtures.

The initial planning package includes the actual current report and proposed comparison screens
from the [original prototype](../docs/ux/profile-customization-prototype.html), which is now
historical/rejected design evidence. The [revised design gallery](../docs/ux/index.html) and
[new capture manifest](../docs/ux/startup-screenshots/manifest.json) cover Signal, Afterhours and
Studio at real share-card size and desktop/mobile report widths. The [original manifest](../docs/ux/screenshots/manifest.json)
remains intact. Captions distinguish observed behavior from proposals.
These initial screens establish experiment scope; they are not completed participant validation.

## Architecture questions to resolve before implementation

- Keep analysis options separate from render options; `report/` must still consume Profile rather
  than knowing about runners or subscription state. Render options are explicit additional input.
- Keep the source profile immutable. Store user display edits, variant name, render preset and
  lineage in a companion manifest until there is a justified schema migration.
- A render-only option is not part of an analysis cache key. A reduce-only style may reuse common
  verified map/merge results only if their observation contract is unchanged. A focus that changes
  what map extracts requires a distinct analysis contract and appropriate cache/version changes.
- Current reduce results are not cached. Do not promise "only one more call" when observations
  are unavailable, incompatible or need merging/retries. Study whether a private intermediate
  bundle is worth its storage, privacy and cache-lifecycle costs before adding one.
- Presets/themes are versioned data arrays with explicit defaults. Avoid one-off conditionals and
  implicit environment-dependent customization. Unknown versions must not silently change a report.
- Use unique variant output folders and private atomic file writes; define overwrite and cleanup
  behavior before adding a compare/save flow. Theme changes must not erase an original report.

## Deliverables and rollout

1. **Plan and baseline (done):** current-control inventory, customization boundaries,
   hypothesis matrix, research prototype, baseline/proposal screenshots and capture manifest.
2. **Presentation experiment (done):** three content presentations and three designs on shared synthetic
   evidence; desktop/mobile/dark/card captures; no production flags or new model calls needed.
   Results: [presentation experiment](../docs/ux/presentation/README.md). Work mirror works as
   presentation alone; Share story belongs in the share preview; Growth journal needs dated
   evidence (a schema and analysis change), so it is deferred.
3. **Controlled analysis experiment:** bounded preset instructions only where necessary, followed
   by the controlled model comparison. Record actual provenance, budgets and failures.
4. **Usability review:** complete tasks, annotate screenshots with observed confusion, record
   preferences and reject options that do not justify their complexity.
5. **Implementation proposal:** choose one default, a small preset set and advanced controls;
   specify syntax, metadata/cache compatibility, failure states, tests and migration requirements.
6. **Implementation after plan review:** TDD for behavior; HTML/card screenshot verification;
   full type/lint/format/unit/package checks; real CLI smoke only if CLI invocation changes.

Recommended starting order: render-only design choices and safe share previews, then bounded
content directions, then advanced model comparison. This is a hypothesis about cost and clarity,
not a final product decision. Keep the existing default command working throughout.


## Shareability criteria added after visual review

The first set of designs did not meet the owner's desired startup-style, shareable identity.
The next user sessions should test the revised directions, keeping the old version as a baseline:

- Can someone recognize the archetype and distinguish the direction at a 360px-wide thumbnail?
- Would they actually choose to save/post it, and what would they remove first?
- Does the card have one memorable visual device rather than a collection of generic badges?
- Is the exact share preview convincing, with clear controls for potentially personal metrics?
- Does the report remain readable and evidence-driven after the expressive first impression?

Record actual export choices and the reasons for reluctance; a designer's preference or a polished
screenshot does not establish willingness to share. Keep a simple default and three bounded looks
until the study justifies more controls.
