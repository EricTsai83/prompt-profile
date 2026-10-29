# Output roles: identity and facts

On 2026-10-29 the owner asked that the outputs be defined by purpose, not file format:
a **factual report** (complete, with sources, denominators and unknowns) and an **identity
report** (a fun, recognizable introduction of the person). This record describes how the HTML
report now follows that split. It does not record owner approval of this revision.

## The two views

The report keeps two offline views with independent view and language switches. Their contents
now follow the roles, not the split between charts and text.

| View                              | Opens  | Contents                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Who they are** / 認識這個人     | first  | Hero; featured observations (the same verified, non-low-confidence traits as the hero signatures, at most three, in profile order and not ranked by strength), each with one of the person's own prompts; categorical collaboration preferences; the portrait story with its chapter quotes; fun facts                                                                                                   |
| **Facts & evidence** / 事實與證據 | second | Measured habits with definitions; tool and prompt-wording shares with denominators and coverage; calendar and heatmap; project chapters; language, source and habit charts; all traits with confidence, support and every quote; the explanation, supporting and contrary quotes of each preference; dimensions; capabilities; suggestions and changes since the last report; usage; how it was measured |

Choices:

- **Quotes on the identity view.** A habit is easier to recognize in the person's own words.
  Each featured observation shows one quote; the facts view still holds every quote once. The repeat
  is intentional: each view must read on its own.
- **Descriptions only where the hero lacks them.** Document looks (Prism, Slate, Folio) already
  describe the signatures in the hero; there the featured observations show name and quote. Showcase looks
  (Classic, Signal, Afterhours, Studio) add the description.
- **Copy states the rule, not a ranking.** Selection keeps profile order; it does not compare
  support or consistency. The section is "Featured observations" and its note names the rule
  (medium or high confidence, a verified quote), not "most consistent" (review R1).
- **No feature without support.** When no trait is verified with medium or high confidence, the
  section says so and points to the facts view instead of promoting a weak observation.
- **Preferences on both views, at different depths.** The identity view shows the categorical
  map; the facts view shows each axis's explanation and its supporting and contrary quotes.
  Mixed or unknown preferences keep their textual state; there are no scores.
- **Suggestions are on the facts view.** They are optional experiments derived from evidence,
  not part of who the person is.
- **The card stays the shareable identity summary.** It already holds no quotes and no
  measurements beyond the existing card stats; it is unchanged.

## Implementation notes

- Internal anchors stay `#report-overview` / `#report-detail` and `.report-view-overview` /
  `.report-view-detail`, so the view switch, print rules and QA tooling keep working. Only
  their contents and visible names changed (`VIEW_MESSAGES` in `src/report/messages.ts`).
- `portraitStory` and `preferenceEvidence` in `src/report/portrait.ts` replace the single
  portrait section with its preference aside. `identityMoves` in `src/report/templates.ts`
  shares its trait selection with the hero signatures.
- The theme layout key `detailWidth` is now `storyWidth` (`data-story-width`): Folio's reading
  column applies to the portrait story, so the facts view's charts use the full page width.
- All look versions advanced (Classic 4 → 5, others 10 → 11). Profile, analysis, pipeline and
  render-manifest versions are unchanged. Re-rendering an existing `profile.json` applies the
  new layout without an analysis call.

## Verification and limits

Fictional data only; no private history or LLM was used. `node scripts/template-qa.mjs` ran
77 cases with no overflow, axe, view/language, expanded-evidence, print or motion failure.
Its only differences from the recorded style table were elements that moved between views and
Folio's wider facts view; the table was re-recorded from that run. Desktop and mobile captures
of both views in English and Traditional Chinese were inspected for Classic, Prism and Folio.

## Owner closeout — 2026-10-29

The owner accepted the current result and explicitly closed plan 21. This records an owner
scope decision, not a completed unfamiliar-reader study or exhaustive visual acceptance.
Reader research continues in plan 32; remaining purpose/export integration belongs to plan 25.
Plan 21's critique, content matrix, direction studies and iteration records remain in this folder.

## Purpose-specific opening — owner review, 2026-10-29

The owner requested right-aligned view controls and an opening that changes with the purpose.
The identity hero now belongs inside the identity view, so selecting facts starts with the
factual heading and measurements instead of retaining the same identity card. Both purposes
remain visible in print. Mobile retains full-width controls with equal touch targets; desktop
controls align to the right. Language selection remains independent.

A behavioral regression failed before moving the hero into its view and passed afterward.
Headless browser checks at 1280px and 390px verified hero visibility on each selection, visible
facts, no horizontal overflow and both purposes in print. These are functional checks, not
owner visual approval. Classic advances to 7 and other looks to 13; no stored prose or analysis
contract changes. The PNG redesign remains pending.

### Owner acceptance — purpose-specific opening

The owner accepted this review round after opening the updated report: right-aligned view
controls and the identity hero appearing only on the identity view. This acceptance is scoped
to that interaction and layout change; it does not close PNG redesign, the earlier story-width
question, exhaustive visual validation or unfamiliar-reader research.

### Centered navigation amendment

The owner's subsequent screenshot request supersedes right alignment: view controls are now
centered above the selected purpose. Mobile retains full-width touch targets. A browser position
check failed before the CSS change (367px off center at 1280px).

### Story alignment and export integration

Story headings now align with the other report sections; only their prose retains a narrower
measure. The PNG includes a compact measured usage summary and localized generator attribution,
as requested in owner review. See purpose-contract.md for fields, fallbacks and inspection scope.
The earlier statement that cards were unchanged is historical; revised PNG owner review is pending.
