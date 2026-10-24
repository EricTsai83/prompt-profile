# Presentation experiment (plan 11, stage 2)

Status: research prototype, not shipped. No CLI flags, analysis prompts or renderer code
changed. No LLM calls were made. All data is fictional.

This stage tests the plan's content directions (Work mirror, Growth journal, Share story) as
**presentation presets** over one fixed profile, plus the open checks from stage 1: dark mode,
long titles, CJK quotes, absent evidence, large counts and keyboard focus. One axis changes at a
time: stories are compared on the Signal look, looks are compared in dark mode, and the edge-case
fixture runs through every look.

- [Prototype](experiment.html): accepts `?story=work-mirror|growth-journal|share-story`,
  `?direction=signal|afterhours|studio`, `?fixture=sample|edge` and `?capture=card`. Dark mode
  follows `prefers-color-scheme`. It opens from `file://`; fonts load from local paths.
- [Fixtures](fixtures.js): two synthetic profiles in the schemaVersion 2 field layout.
  `test/fixtures/profile.sample.json` repeats one summary in all five dimensions, so it cannot
  show a change of emphasis. `sample` keeps its archetype, counts, confidences and empty growth
  evidence, and gives each dimension its own summary. `edge` has a 56-character archetype, a
  long headline, CJK and mixed-language quotes, four items without evidence, 1,234,567 prompts,
  sampled coverage and a null Codex model.
- [Capture script](capture.mjs) and [manifest](screenshots/manifest.json): source hashes, image
  hashes, viewport, appearance and the page's own checks for every capture.

```sh
npx -y -p playwright-core@1.61.1 node docs/ux/presentation/capture.mjs
```

The script uses the installed Google Chrome and exits non-zero on a failed check, a page error
or any request that is not `file:`.

## Presets are data

Each story is one entry in `STORIES`: dimension order, how many dimensions lead, the card's
supporting line, how many supported traits the card shows, the card's two metrics and a cost
label. A story only reorders and chooses among profile fields. It writes no profile text; the
only new copy is the product's own section headings.

## What the checks establish

For each capture, and for all 9 story × look combinations switched in one page:

- The source profile object is deep-frozen and its JSON is unchanged.
- Every evidence item, keyed by owner (dimension or trait), prompt ID and quote, is in the
  private report exactly once per owner. Open excerpts and collapsed ones both count.
- Trait confidence labels and the four statistics match the source.
- Every dimension or trait without evidence shows a visible warning, never one hidden inside
  a collapsed section.
- The share card contains no quote and no project name. No card content falls outside the
  card, and card captures are exactly 1200 × 630.
- No page has horizontal overflow, the display and reading fonts are loaded, and the page made
  no non-`file:` request.

Negative check: removing one quote from the report, hiding a warning, and putting a quote into
the card each made the corresponding check fail. The first version of the evidence check missed
the removed quote, because it compared sets and the quote also belonged to a trait. It now
compares owner-keyed lists.

These checks cover what the page shows. They do not prove that the analysis step is private,
that a production export would match, or that anyone would share the card.

## Captures

| ID  | Capture                                                                                                                                                                                                        | Viewport                | What it shows                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| S1  | [Work mirror](screenshots/work-mirror-desktop.png) · [mobile](screenshots/work-mirror-mobile.png) · [card](screenshots/work-mirror-card.png)                                                                   | 1440 / 390 / 1200 × 630 | Work style and communication lead; archetype line and sessions on the card      |
| S1  | [Growth journal](screenshots/growth-journal-desktop.png) · [mobile](screenshots/growth-journal-mobile.png) · [card](screenshots/growth-journal-card.png)                                                       | 1440 / 390 / 1200 × 630 | Growth leads with its warning; "No progression shown" note; partial-cost label  |
| S1  | [Share story](screenshots/share-story-desktop.png) · [mobile](screenshots/share-story-mobile.png) · [card](screenshots/share-story-card.png)                                                                   | 1440 / 390 / 1200 × 630 | One leading dimension; headline and three supported traits on the card          |
| S2  | [Signal dark](screenshots/signal-dark-desktop.png) · [Signal](screenshots/signal-dark-mobile.png) · [Afterhours](screenshots/afterhours-dark-mobile.png) · [Studio](screenshots/studio-dark-mobile.png) mobile | 1440 / 390              | Dark report surfaces; each card keeps its own colors                            |
| S6  | [Edge desktop](screenshots/edge-desktop.png) · [360px](screenshots/edge-mobile-360.png)                                                                                                                        | 1440 / 360              | Long archetype, CJK quotes, four warnings, large counts, sampled coverage       |
| S6  | [Signal](screenshots/edge-signal-card.png) · [Afterhours](screenshots/edge-afterhours-card.png) · [Studio](screenshots/edge-studio-card.png) edge cards                                                        | 1200 × 630              | Long title in every look; the long trait chip ends in an ellipsis               |
| F   | [Keyboard focus](screenshots/keyboard-focus.png)                                                                                                                                                               | 1440 × 900 viewport     | Tab to the story tabs, then ArrowRight: Growth journal is selected and outlined |

## Findings

1. **Work mirror works as presentation alone.** Reordering the existing dimensions and putting
   the archetype line on the card gives a coherent default with no new analysis. It is the
   default candidate.
2. **Share story is a card preset, not a report story.** In the private report it differs from
   Work mirror only in one leading dimension instead of two, and the order of the rest. The
   visible difference is on the card: headline and up to three supported traits. Fold it into
   the share-preview flow instead of a top-level story choice.
3. **Growth journal cannot be done with presentation alone.** The profile records no date for
   any evidence, so it cannot show change over time. The growth dimension has no evidence in
   either fixture. Its card line
   becomes "No clear change over time is supported by this sample.", which nobody will want to
   post. The prototype says this plainly instead of inventing a progression. A real growth story
   needs dated evidence in the schema and a map/reduce change, which means a `schemaVersion` and
   `ANALYSIS_VERSION` bump. Defer it, or drop it, until stage 3 shows a need.
4. **Long text needs one product rule.** A 56-character archetype fits in three lines at the
   smallest title size in all three looks. A 50-character trait name ends in an ellipsis on the
   card, while the report shows it in full. Before implementation, decide whether a truncated
   trait is acceptable on a card or should be left off. The capture manifest records each
   truncation under `checks.truncated`.
5. **Large counts and CJK hold up.** 1,234,567 prompts and 98,765 sessions fit both the card and
   the 360px stats grid. CJK and mixed quotes wrap cleanly at 360px; quotes carry a `lang`
   attribute.
6. **Dark mode changes the report, not the card.** Report surfaces and warnings switch to dark
   tokens. Each card keeps its identity colors, so the exported card is the same in either mode.
   Studio's white card is the brightest surface on a dark page; check whether people find that
   jarring.
7. **The inline card preview is unreadable on mobile.** At 390px the card is about 350px wide
   and its small text is a few pixels tall. This confirms that a full-size share preview (the
   stage 1 dialog) is needed on mobile. A thumbnail cannot show what will be exported.
8. **The cost label works on paper.** Work mirror and Share story say "Presentation only. No new
   analysis, no LLM calls."; Growth journal says what it cannot show and that new analysis would
   be needed. Whether people understand the difference is a stage 4 question.

## Not done in this stage

- No participant sessions. Stated preference and willingness to share are not established.
- No production renderer, PNG export, CLI flag or companion manifest.
- No model comparison (stage 3) and no alternative reduce instructions.
- Direct vs playful wording was not compared. The plan compares it within the winning story, and
  Work mirror needs no new text to test it against.
