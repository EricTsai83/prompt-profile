# Profile customization research package

This is a planning artifact, not a production feature. All screenshots use fictional input.
The [research plan](../../plans/11-profile-customization-ux.md) defines the study and decision gates.

Open [the screenshot gallery](index.html) for the captured comparisons, or open the
[interactive prototype](profile-customization-prototype.html) to switch research views.
The prototype supports `?view=content`, `?view=layout`, `?view=flow` and `?view=model`.
Its action-shaped labels are illustrations; it does not generate or save profiles.

## Captures

| Screenshot                                                           | Type                               | Purpose                                                                       |
| -------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| [Current desktop report](screenshots/00-current-report-desktop.png)  | Actual renderer, synthetic profile | Establish the current hierarchy and evidence affordances                      |
| [Current mobile report](screenshots/00-current-report-mobile.png)    | Actual renderer, synthetic profile | Establish the 390px baseline                                                  |
| [Content directions](screenshots/01-content-directions-desktop.png)  | Research prototype                 | Work mirror, growth journal and share story on the same evidence              |
| [Content on mobile](screenshots/01-content-directions-mobile.png)    | Research prototype                 | Check 390px wrapping and section order                                        |
| [Report designs](screenshots/02-report-design-desktop.png)           | Research prototype                 | Editorial, evidence notebook and share poster                                 |
| [Designs on mobile](screenshots/02-report-design-mobile.png)         | Research prototype                 | Check 390px layout                                                            |
| [Designs in dark mode](screenshots/02-report-design-mobile-dark.png) | Research prototype                 | Check 360px dark appearance                                                   |
| [Generation cost flow](screenshots/03-generation-cost-flow.png)      | Research prototype                 | Separate a free render from new narrative analysis                            |
| [Model study protocol](screenshots/04-model-study-protocol.png)      | Baseline + proposed experiment     | Existing Claude quality baseline; Codex profile comparison explicitly not run |

The [capture manifest](screenshots/manifest.json) records source/image hashes, viewport widths,
appearance, full capture heights and browser-console checks. The seven prototype captures show
one active panel and no horizontal page overflow. Browser-console assertions reported no errors.
The original report has no JavaScript; its captures are visual baselines, not runtime assertions.
The PNG share card remains available as [the actual sample export](../sample-card.png).

These captures do not establish participant preference, factual correctness, production theme
switching, network isolation or comparative model quality. Keyboard, exact share-export behavior
and actual call-count checks are required in the implementation experiment. Screenshot review
is one part of that validation, alongside hashes, process counts, evidence checks and user tasks.

## Reproduction

- Baseline source: `docs/sample-report.html`, rendered from `test/fixtures/profile.sample.json`.
- Prototype source: `docs/ux/profile-customization-prototype.html`; no fonts or scripts are fetched.
- Captured with T3 `html_preview`, light at 1440/390px and dark at 360px as recorded per image.
- The capture helper selects a prototype view by changing the root `data-view` value before
  rendering. The equivalent view is accessible with the URL query parameters above.
- A content or layout edit requires recapturing the affected images and updating their hashes;
  do not annotate or alter a screenshot while describing it as an untouched capture.
