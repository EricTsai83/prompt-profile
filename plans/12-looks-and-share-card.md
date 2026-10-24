# 12 · Report looks and share-card privacy

Status: implementation proposal from plan 11, stage 5, approved by the owner on 2026-10-24.
Stage 4 (participant study) was skipped by the owner's decision, so plan 11's go/no-go
criteria have **not** been tested. Scope is limited to render-only choices; content stories
are out of scope.

## Basis

- Plan 11 stage 1: three share-first looks (Signal, Afterhours, Studio) and a share preview
  with visibility controls ([prototype](../docs/ux/startup-profile-prototype.html)).
- Plan 11 stage 2 ([results](../docs/ux/presentation/README.md)): presentation choices keep
  evidence, confidence and statistics unchanged; Share story belongs in the share card;
  Growth journal needs new analysis data and is deferred; long trait names are truncated on
  the card.
- Owner decision: implement the looks and share-card privacy only; keep the default unchanged.

## User-facing behaviour

```bash
prompt-profile --look signal                       # analyse, then render in the Signal look
prompt-profile render profile.json --look studio   # re-render; no analysis, no LLM calls
prompt-profile render profile.json --card-hide stats,graphic
```

| Flag | Values | Default | Applies to |
| --- | --- | --- | --- |
| `--look` | `classic`, `signal`, `afterhours`, `studio` | `classic` (today's report and card) | report.html and card.png |
| `--card-hide` | comma list of `traits`, `stats`, `graphic` | nothing hidden | card.png only |

- Both flags exist on the main command and on `render`. They never change the analysis,
  its cache key, `profile.json` or any version number.
- `render` with non-default options and no `--out` writes into a **new folder** next to the
  profile, `variants/<look>[-no-<part>…]/` (for example `variants/signal-no-stats`), so the
  original report and card are never overwritten. An explicit `--out` is used as given.
- `render` always prints that no new analysis or LLM call happened.
- Unknown look: effect/cli rejects it (exit 2). Unknown `--card-hide` part: `InvalidArgument`
  (exit 2) naming the valid parts.
- `graphic` has no effect on `classic`, which has no signature graphic.

## Fixed guarantees

- The card never contains prompt text, evidence quotes or project names, in any look or
  combination; hiding parts can only remove content.
- The private report keeps every trait, dimension, quote, confidence label, statistic,
  missing-evidence warning and coverage line in every look. `--card-hide` does not touch it.
- The report stays offline: the display font is embedded as a data URL, and the
  Content-Security-Policy allows `font-src data:` only for looks that need it.
- Long text on the card is clipped at a word boundary with "…" (archetype 56 characters,
  headline 120 in the looks / 150 in classic, trait 32), and the archetype type steps down
  (96 → 72 → 58 px). The private report always shows the full text.
- Derived files keep the private write rules (folders `0700`, files `0600`, temp + rename).

## Data and files

- `src/report/looks.ts`: `LOOKS` is a data array. Each look has an id, a version, HTML tokens
  for light and dark, card colors and a graphic kind (`none`, `bars`, `orbit`, `fold`).
  Adding a look adds an entry; no flow code changes.
- `RenderOptions = { look, cardHide }` is an explicit input to `renderHtml`, `cardTree`,
  `renderCard` and `writeReport`. `report/` still consumes only `Profile` plus these options.
- A non-default render also writes `render.json` (companion manifest): `renderVersion`,
  `look`, `lookVersion`, `cardHidden`, `profileSha256` (of the `profile.json` written next to
  it) and `source` (the input path relative to the output folder, `render` only). It contains
  no prompt text. A default render writes nothing new, so the default output is unchanged.
- Font: Bricolage Grotesque ExtraBold, a static 41 KB WOFF from Google Fonts with its SIL OFL
  notice, in `src/report/fonts/` (copied to `dist/fonts/` like Inter). satori reads WOFF, not
  WOFF2, so the research WOFF2 is not reused.

## Tests

- Default HTML and card stay identical (existing snapshot; explicit default equals implicit).
- Every look: offline HTML, `data-look`, every quote and warning present, card hide options do
  not change the HTML.
- Every look × every hide combination: no quote or project name in the card tree; hidden parts
  are absent; every look renders a 1200 × 630 PNG.
- `writeReport` writes `render.json` only for non-default options, with a matching hash.
- CLI: `render --look` writes a variant folder and leaves the original files untouched; invalid
  look / part exit 2; the main command accepts `--look`; the installed-package check includes
  the new font.

## Not in scope

Content stories, custom titles, compare/variant management commands, interactive preview,
arbitrary colors or CSS, and any analysis change.
