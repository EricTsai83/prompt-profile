# Profile customization research package

This is a planning artifact, not a production feature. All captures use fictional input.
The research plan (plan 11, deleted when done; see `git log -- plans/11-profile-customization-ux.md`) defined the study and decision gates.

## Revised direction: a profile worth sharing

The owner rejected the initial editorial designs as dated. The new study treats the share card
as the first design surface, with a readable private report behind it:

- **Signal:** cobalt, expressive typography and an activity trace. Recommended starting direction.
- **Afterhours:** midnight blue and a radial activity signature.
- **Studio:** white/coral split composition with a folded conversation motif.

Open the [captured comparison gallery](index.html) to switch directions and card/desktop/mobile
views. The [interactive prototype](startup-profile-prototype.html) has working style selection,
a share-preview dialog and visibility controls for traits, statistics and the signature graphic.
It does not export PNGs or add customization flags to the CLI.

The [design brief](startup-design-brief.md) records the token systems, critique and application of
[Anthropic's frontend-design skill](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md).
The skill was read remotely, not installed. Bricolage Grotesque is bundled as a licensed research
font alongside its OFL notice; the production package remains unchanged.

## Revised screenshot evidence

| Direction  | Share card at 1200 × 630                        | Desktop at 1440px                                   | Mobile at 390px                                     |
| ---------- | ----------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| Signal     | [Card](startup-screenshots/signal-card.png)     | [Report](startup-screenshots/signal-report.png)     | [Mobile](startup-screenshots/signal-mobile.png)     |
| Afterhours | [Card](startup-screenshots/afterhours-card.png) | [Report](startup-screenshots/afterhours-report.png) | [Mobile](startup-screenshots/afterhours-mobile.png) |
| Studio     | [Card](startup-screenshots/studio-card.png)     | [Report](startup-screenshots/studio-report.png)     | [Mobile](startup-screenshots/studio-mobile.png)     |

Additional captures: [Signal at 360px](startup-screenshots/signal-mobile-360.png) and
[share preview with statistics/activity hidden](startup-screenshots/signal-share-preview.png).

The [new capture manifest](startup-screenshots/manifest.json) records source, font, fixture and
image hashes, browser-console checks and limitations. All eleven captures loaded the intended
font, had no horizontal page overflow and preserved the source profile. The share compositions
omit evidence quotes. All three card captures are exactly 1200 × 630.

The browser interaction probe checked actual click/key events for direction switching, opening
and closing the dialog, and changing its privacy controls. Hidden share metrics/traits/graphics
did not alter the private report or source data. These are prototype behavior checks, not proof
of production export, provider privacy, accessibility conformance or willingness to share.

## Reproduce the revised study

Serve the repository root locally, then open the prototype:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
# http://127.0.0.1:8765/docs/ux/startup-profile-prototype.html
```

The prototype accepts `?direction=signal`, `?direction=afterhours` or `?direction=studio`.
For a full-size landscape composition use `?direction=signal&capture=card` at a 1200px viewport.
For T3 headless captures, inline the three local font assets as data URLs: the synthetic page
origin cannot load local font paths. No external font requests are required after preparation.
The manifest records the font assets and this transformation. Root `data-direction` and
`data-capture` attributes select the same state for headless rendering.

The privacy-preview capture opens the dialog and unchecks statistics and the signature graphic.
The design rebalances the title when the signature is hidden. It does not modify or annotate the
captured PNG afterward. Re-capture changed views and update the manifest when changing the design.

## Presentation experiment (stage 2)

The [presentation experiment](presentation/README.md) applies the three content directions
(Work mirror, Growth journal, Share story) to the Signal look as data presets over one synthetic
profile. It adds dark-mode, edge-case (long title, CJK quotes, absent evidence, large counts)
and keyboard-focus captures with a reproducible Playwright script and manifest. Every capture
checks that evidence, confidence, statistics and warnings are unchanged and that the card has
no quotes. The stage 1 files above are unchanged.

## Model comparison (stage 3)

The [model comparison](model-comparison/README.md) ran 12 analyses (3 synthetic personas ×
Claude Code / Codex × 2 repeats, 40 of a 60-call budget) with full provenance, the persona
rubrics and a blind review. It found one analysis defect (weekday order), which is now fixed.

## Historical first study

The [initial gallery](initial-study-gallery.html), [initial prototype](profile-customization-prototype.html)
and [initial capture manifest](screenshots/manifest.json) remain intact as rejected-design evidence.
They include the actual current renderer at desktop/mobile widths, the first content/design
sketches, free-versus-paid flow and the model-study protocol. The original production
[share card](../sample-card.png) is also preserved for comparison.

The model comparison is still not run. Participant preference, actual sharing behavior and
production theme/export work remain future research and implementation stages.
