# Direction study — owner selection pending

Open [comparison.html](comparison.html) directly from disk. All assets are local, no server,
network or analysis needed. Open each full report to assess desktop composition; comparison
frames deliberately demonstrate narrow reflow rather than shrinking desktop text.

## Compared compositions

| Direction         | Composition / distinctiveness                                                              | Readability and density                                 | Unknown state                                             | Cost / tradeoff                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Current           | Identity header plus metrics, dashboards, then portrait                                    | Long overview competes with identity; repeated surfaces | Four axis panels can dominate limited evidence            | Existing implementation; weakest content selection                                        |
| A Portrait poster | Lime identity field; large offset symbolic slot; three terse signatures                    | Fast introduction, medium density, smaller prose width  | Plain caveat band under behaviors                         | Moderate renderer cost; memorable but character slot occupies considerable mobile space   |
| B Decision route  | Dark continuous canvas; decision strip precedes portrait; vertical numbered behavior rail  | Scan starts with agency; stacked sections favor mobile  | Context panel stays part of route rather than empty graph | Higher diagram/print effort; route could falsely imply chronology without explicit caveat |
| C Research index  | Small character margin, right-column title; ruled label/value rows; indexed detail columns | Highest density, less dramatic; linear mobile reading   | Caveat reads as an entry in the dossier                   | Moderate grid work; could feel institutional rather than personal                         |

These are different arrangements, not renamed skins: A makes identity/character the anchor,
B puts a categorical diagram before the title and stacks behavior on a rail, C uses a margin
index and horizontal records. They intentionally avoid the owner's rejected serif aesthetic.
No direction is selected, recommended as approved, or moved into production.

## Token systems

Shared: local system sans only, 17px / 1.65 body, 65ch maximum prose, 12px monospace metadata;
24–48px section rhythm; visible 3px keyboard outline; no motion. No equal rounded-card grid.

A: ink #172c32 / lime #e3edb4 / deep green #193d38; 40–82px compressed display; 2:1.3 hero;
solid character field with 3-degree offset; 5px divider; no chart. Mobile brings character
below the statement and stacks signatures with fine rules.

B: navy #112b39 / pale text #e7f2f4 / muted blue #234959 / teal rail; same type scale;
full-width decision strip, stacked behaviors, slim horizontal character placeholder. Diagrams
use words and arrows, no numeric length encoding. Mobile wraps labels in DOM reading order.

C: warm neutral #f5f4ee / ink #172c32 / fine gray-green rules; 38–65px title;
190px detail labels and flexible reading column; 1:3 margin/title grid; rectangular marker.
Mobile becomes one column, retaining entry numbers and full quotes.

Shared evidence: open native details, 21px quotes, green supporting rule, separately labeled
rust contrary section; color is redundant with headings. Placeholder explicitly names plan 20 D
and carries no physical traits. No role art or mapping is asserted. History remains reserved,
not a dead control. Metadata remains secondary. No decorative activity graph or personality score.

## Genuine owner gate

After independent Codex review, ask the owner to open all three full reports (overview, detail,
and mobile) and decide: A, B, C, or a concrete combination of named regions; which elements to
reject; whether the role wording and three behaviors introduce this person adequately; whether
the mixed-evidence treatment is dignified. Record exact feedback here before phase 4. If none
works, iterate the composition studies rather than shipping a presumed winner.

No owner feedback or reader walkthrough has been collected. Passing browser checks is not
visual acceptance. English prototypes are phase 3 studies; full bilingual, dark/light, print,
exclusion and card acceptance belongs to phase 4 after this gate. Current bilingual screenshots
include English fallback portrait text because the legacy fixture has no translated portrait.

## Reproduction and limits

`pnpm exec tsx docs/ux/report-redesign/baseline.ts` regenerates the current fixture report.
`node docs/ux/report-redesign/capture.mjs` captures 20 full pages and checks actual view switches,
expanded evidence, horizontal overflow, page errors and remote requests. Set PLAYWRIGHT_CORE
when the installed package lives elsewhere. Capture names encode source, locale, width and view.

Current has legacy sample metrics/headline plus attached portrait; prototypes intentionally use
only that portrait, so cross-direction copy is identical but the baseline is not a data-parity
experiment. No claims about production exclusions, real-history quality or study participants.

## Implementation verification record

- `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`: exit 0;
  42 test files passed, 483 tests passed. No build needed: production sources/assets unchanged.
- `node docs/ux/report-redesign/capture.mjs`: exit 0; 20 full-page captures, zero recorded
  page errors, remote requests or horizontal overflows. Actual overview/detail clicks checked.
- All 20 full-page PNGs were opened with `view_image`: current en/zh-TW × 1440/390 ×
  overview/detail (8), and A/B/C en × 1440/390 × overview/detail (12). Route behavior prose
  initially occupied the number column despite zero page overflow; corrected to column 2,
  recaptured and visually inspected. Overview hierarchy, bottom caveats, open quotes and
  separate contrary sections are visible. This is not an accessibility conformance audit.
- Independent Codex GPT-6.1 Sol (medium) review pass 1 completed: R1/P2 identified unsupported
  exclusion names in the content matrix. Accepted after checking `looks.ts`, `visibility.ts`,
  `portrait.ts`, `html.ts` and `techniques.ts`; corrected the matrix to the six actual exclusions,
  project-name scrubbing, date precision and custom inventory policy, with extra hide options
  explicitly proposed only. Documentation-only fix; no second review pass was requested.
  No production behavior test was added because this change is documentation/prototype only.
- Phase 4 still owns full language interactions, exclusion combinations, card, print acceptance
  and long-content edge cases. No personal-history smoke test or LLM smoke test was run.

## Authorized production iteration

Owner feedback: A/B/C were rejected. The baseline is relatively better, but still not attractive
enough. Product UI research principles and multiple original production templates were accepted
for implementation. The owner authorized proceeding beyond the earlier selection gate.

Prism: light, clear overview with supported signatures. Slate: compact workspace with adjacent
identity and behaviors. Folio: editorial reading measure and connected evidence. These are
original implementations, with no copied third-party code or assets. External reference names
belong only to research provenance, never the generated template presentation.

Public fictional artifacts: `demo/templates/index.html` on the Pages site, built by
`pnpm site`. Browser checks: `node scripts/template-qa.mjs`,
with local ignored captures and manifest in `tmp/template-qa/`.

Status: implementation iteration, pending independent review and owner acceptance. The legacy
fixture lacks translated portrait prose, so its Traditional Chinese view intentionally retains
the existing fallback rather than inventing a translation.
