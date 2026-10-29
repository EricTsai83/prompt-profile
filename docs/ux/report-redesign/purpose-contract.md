# Production report purpose contract

This contract describes the existing renderer, rather than the earlier prototype matrix in
content.md. Purpose and output format are independent: HTML offers both purposes; PNG is an
introduction. The source Profile is immutable. All examples and checks use fictional data.

| Reader question                   | Source                                      | Identity presentation                                                                                      | Factual presentation and limits                                                                        |
| --------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| How does this person collaborate? | archetype, headline, portrait.introduction  | Supported introduction and connected story                                                                 | Original interpretation remains inspectable; a request does not prove an outcome                       |
| Which behaviors stand out?        | traits, confidence, evidence                | Up to three non-low-confidence observations with evidence, in profile order; all PNG cards use at most two | All traits, support, confidence and excerpts, including weaker observations                            |
| Where do preferences differ?      | portrait.axes                               | Categorical labels, including mixed and unclear                                                            | Explanation plus supporting and contrary evidence; no strength score                                   |
| What is the context?              | stats, projects, techniques                 | Optional aggregate activity signals and fun facts                                                          | Definitions, denominators, coverage, projects, activity and metadata; missing metadata is not zero use |
| What does usage mean?             | usage, plan, list-price estimates           | HTML omits usage; PNG may show tokens and API estimates                                                    | Factual view only; estimates retain their qualifications                                               |
| What remains unknown?             | coverage, evidence limits, missing portrait | Limited-evidence introduction; fewer observations or none                                                  | Sampling and missing evidence remain visible; no inferred expertise or successful outcome              |
| What could change?                | improvements, previous                      | No coaching as identity                                                                                    | Optional suggestions and available comparison, subject to exclusions                                   |

Repeated names connect the two views; they do not indicate independent corroboration. Document
heroes already describe featured observations, so their identity observation blocks add the
excerpt rather than repeating the description. The factual view retains every supporting and
contrary excerpt. Stored prose can still repeat itself across portrait, traits and dimensions;
the renderer must not rewrite it or silently remove evidence to force uniqueness.

## Fallbacks and privacy

Legacy profiles retain existing dimensions without invented portrait fields. Mixed and unclear
preferences remain categorical. Limited samples use the limited-evidence introduction and omit
card traits. Exclusions remove quotes, coaching and fun facts as requested; project exclusions
scrub known names in both HTML and PNG, including translations. Heavily excluded reports keep
coverage and caveats. Cards never contain prompt excerpts. Long names and headlines use the
existing bounded card text layout; full HTML prose is preserved.

Episodes and contextual signature moves require plan 20 B/C. No renderer synthesizes turns,
chronology, outcomes or new roles. Richer evidence and better generated wording require future
analysis; composition and card selection apply by rerendering compatible stored profiles.
Profile, analysis and pipeline versions do not change for this integration. Look versions advance
to Classic 10 and other looks 16 after the navigation and PNG integration.

## Offline reading and exports

View and language selectors remain independent offline controls with keyboard access. Print
includes both intended purposes rather than only the active screen view. PNG remains a fixed
1200 × 630 introduction: title, headline, supported behavior names and optional aggregate
activity context. The measured summary includes prompt/conversation counts, tokens and an API
list-price estimate in USD. Prompt and response periods are labeled separately. `--exclude usage`
replaces token/cost cells with active days and longest streak; `--card-hide stats` removes all
summary cells and periods. Missing usage is “Not measured”; unpriced responses are “Unknown”;
partial prices carry a plus sign and a label. Unreadable logs retain a visible qualification.
There are no evidence panels or quotes.

## Verification record — 2026-10-29

A regression with a low-confidence trait, an unsupported trait and a supported trait failed
before the fix (Classic exported both unsupported labels). It now checks all seven looks,
preserves source indices for translated labels and leaves input traits untouched. Existing report
suites cover language/view independence, exclusions, legacy/sparse content and render commands.
No LLM call or stored prose change is introduced by card selection.

This change does not claim a completed reader study or exhaustive visual approval. Earlier HTML
capture findings remain in output-roles.md. The final inspection record below supersedes the earlier outstanding visual work. Further iteration uses owner feedback; final PNG owner approval is recorded below.

## Owner review amendment — PNG direction

The owner requested a more engaging share card with selected usage, tokens and API list-price
equivalent. This direction is now implemented. Detailed usage
stays in factual HTML; PNG may carry a compact measured summary. Estimates must be labeled as
API list-price equivalent, with partial/missing states preserved. Actual spend and human hours
are not established by current fields. Replace the unexplained command footer with clear product
attribution. Plan 20 D owns original character art and can integrate later without blocking this
card iteration. This amendment supersedes the earlier PNG pricing exclusion in this document.

## PNG implementation evidence

Before: the footer showed an unexplained shell command and summary cells showed active hours,
night share and streaks. After: the footer identifies the generator; prompt/conversation counts
provide scale, while tokens and labeled API estimates provide usage context. No generic rank,
subscription savings or human-hours claim is added. Character art remains in plan 20 D.

Behavioral tests failed before summary implementation, then passed for two-source totals,
reasoning counted once, partial/unknown/unmeasured states, distinct periods and date exclusions.
All-look card tests cover usage exclusions, hidden stats, attribution and unchanged stored prose.
The existing CLI render variant test verifies zero fake runners and preserves the original
artifacts; the report module does not import analysis or an LLM implementation.

## Final layout and inspection record

Story sections now share the report section edge. Body text retains a reading measure; Folio
keeps its narrower narrative measure. This resolves the owner's observation that the whole story
block appeared inset. A browser check failed before the cascade fix (185px inset at desktop),
then passed for all seven looks. The shared document-layout rules needed the change as well as
the story stylesheet. Purpose navigation is centered, superseding the earlier right-aligned design.

Local fictional artifacts were rendered for seven looks, two languages and five cases: standard,
legacy without usage/portrait, unclear preferences, long text with personal/usage exclusions,
and limited evidence. All 70 PNGs were inspected in seven contact sheets; representative cards
were also opened at native resolution. Long titles/headlines stay within their bounds; unsupported
traits disappear for limited evidence; legacy cards show unmeasured usage rather than zero. The
inspection found an English title splitting a word; normal word wrapping replaced break-all.
The footnotes are supporting detail and are small at phone-sized thumbnails; the title and metric
values remain primary. Character art and a full export selection workflow remain in plans 20 D/29.

Full-page HTML captures cover both purposes, English/Traditional Chinese, desktop/mobile and
light/dark. Manual inspection included the complete Classic desktop identity view, Classic mobile
identity/facts and the story section, plus print-media output at the transition into facts. The
fictional portrait narrative was kept in English in the bilingual layout fixture; Chinese fixed
copy and the existing translated profile/card fields were exercised, including long Chinese text.
This is layout inspection, not a new translation-quality study or owner aesthetic approval.
Local artifacts are under `tmp/purpose-review/`; personal histories and real LLMs were not used.

The existing offline browser QA suite exercises all looks and edge variants, with additional
checks for centered controls, purpose-specific hero visibility and aligned story headings. Its
style reference is updated for intentionally hidden heroes and the story layout. Print keeps both
views, language/view controls remain independent, and no outside requests are allowed. The CLI
render test records zero LLM runner creation; card tests prove source Profile immutability.

Repository gates passed with 59 test files and 644 tests. Final owner review is limited to the
revised PNG and any newly noticed presentation issue. Content and purpose interaction approval
are already recorded in output-roles.md; no unfamiliar-reader study is claimed.

## Owner closeout — 2026-10-29

The owner accepted the revised PNG and explicitly authorized closing plan 25. Earlier approval
of the content and purpose interaction, the final layout/inspection record above, and this PNG
acceptance complete the feature review. Plan 25 and its open-plan index row are removed; this
contract and output-roles.md retain the decisions and evidence.

Final automated validation: the browser QA suite exited 0 with 77 cases and no failures;
repository typecheck, lint, format check and tests exited 0 (59 test files, 644 tests).
No completed unfamiliar-reader or translation-quality study is claimed. External participant research was removed by owner decision; further iteration uses owner feedback.
Character assets remain in plan 20 D, and export orchestration in plan 29.
