# Production report purpose contract

This contract describes the existing renderer, rather than the earlier prototype matrix in
content.md. Purpose and output format are independent: HTML offers both purposes; PNG is an
introduction. The source Profile is immutable. All examples and checks use fictional data.

| Reader question                   | Source                                      | Identity presentation                                                                               | Factual presentation and limits                                                                        |
| --------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| How does this person collaborate? | archetype, headline, portrait.introduction  | Supported introduction and connected story                                                          | Original interpretation remains inspectable; a request does not prove an outcome                       |
| Which behaviors stand out?        | traits, confidence, evidence                | Up to three non-low-confidence observations with evidence, in profile order; document cards use two | All traits, support, confidence and excerpts, including weaker observations                            |
| Where do preferences differ?      | portrait.axes                               | Categorical labels, including mixed and unclear                                                     | Explanation plus supporting and contrary evidence; no strength score                                   |
| What is the context?              | stats, projects, techniques                 | Optional aggregate activity signals and fun facts                                                   | Definitions, denominators, coverage, projects, activity and metadata; missing metadata is not zero use |
| What does usage mean?             | usage, plan, list-price estimates           | No usage, subscription or price content                                                             | Factual view only; estimates retain their qualifications                                               |
| What remains unknown?             | coverage, evidence limits, missing portrait | Limited-evidence introduction; fewer observations or none                                           | Sampling and missing evidence remain visible; no inferred expertise or successful outcome              |
| What could change?                | improvements, previous                      | No coaching as identity                                                                             | Optional suggestions and available comparison, subject to exclusions                                   |

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
to Classic 6 and other looks 12 because shared card selection changes.

## Offline reading and exports

View and language selectors remain independent offline controls with keyboard access. Print
includes both intended purposes rather than only the active screen view. PNG remains a fixed
1200 × 630 introduction: title, headline, supported behavior names and optional aggregate
activity context. Existing stats and graphic hiding controls remain available. It does not add
usage pricing, evidence panels or quotes.

## Verification record — 2026-10-29

A regression with a low-confidence trait, an unsupported trait and a supported trait failed
before the fix (Classic exported both unsupported labels). It now checks all seven looks,
preserves source indices for translated labels and leaves input traits untouched. Existing report
suites cover language/view independence, exclusions, legacy/sparse content and render commands.
No LLM call or stored prose change is introduced by card selection.

This change does not claim a completed reader study or exhaustive visual approval. Earlier HTML
capture findings remain in output-roles.md. Fresh full-page, mobile, bilingual, light/dark, print
and PNG inspection and unfamiliar-reader sessions remain outstanding acceptance work for plan 25.

## Owner review amendment — PNG direction

The owner requested a more engaging share card with selected usage, tokens and API list-price
equivalent. This is the next design direction, not an implemented PNG feature. Detailed usage
stays in factual HTML; PNG may carry a compact measured summary. Estimates must be labeled as
API list-price equivalent, with partial/missing states preserved. Actual spend and human hours
are not established by current fields. Replace the unexplained command footer with clear product
attribution. Plan 20 D owns original character art and can integrate later without blocking this
card iteration. This amendment supersedes the earlier PNG pricing exclusion in this document.
