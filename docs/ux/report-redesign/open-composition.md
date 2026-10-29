# Open report composition

The owner accepted the overall baseline and requested fewer cards and more varied report
composition. This revision preserves the content, selectable looks and Classic default.
It does not record owner approval of this revision or completion of plan 21.

## Reading choices

- Statistics share an inline strip, rather than four individual containers.
- Tool and prompt comparisons use unequal columns; activity charts keep their full-width rhythm.
- The connected portrait has a narrow preference/evidence aside on wide screens. Mobile and
  print return to source order. No evidence is moved in the DOM or hidden.
- Traits pair a short left heading with prose and quotations on the right. Dimensions use
  ruled text groups. Capability inventories use rules, and coaching follows a narrow narrative
  measure. Controls, confidence badges and the suggested rewrite retain useful affordances.
- Prism keeps its clear accented introduction, Slate its compact workspace hierarchy and Folio
  its serif narrative introduction. Their bodies share open surfaces, not repeated card shells.

These are CSS presentation changes, including Classic. Look versions advance from 6 to 7;
profile, analysis, pipeline and render-manifest formats are unchanged. Existing print guards
retain 10pt body text, continuous views, compact dimensions and capability heading/data pairing.
The separate PNG sharing artifact has no layout or privacy changes.

## Output contract

The CLI writes report.html, profile.json and card PNGs. Browser Print / Save as PDF produces
a static copy of both views in the selected language from the same offline HTML and profile.
It makes no analysis call. output/pdf holds fictional developer review exports, not an automatic
CLI PDF feature. No export flag or dependency was added.

## Reproduction and limits

Run `pnpm exec tsx scripts/template-gallery.ts`, `node scripts/template-qa.mjs`,
`node scripts/pdf-qa.mjs` (with PLAYWRIGHT_CORE set when needed), then
`uv run --with pymupdf python scripts/pdf-inspect.py`.
The gallery and edge fixtures contain only synthetic data; no private history or LLM was used.
The PDF inspector rasterizes all eight exports, checks A4/nonblank text/bounds, the ten-page
fixture budget, methodology sharing the last page and Ship's heading/measurement pairing.
Owner aesthetic acceptance, unfamiliar-reader walkthrough and arbitrary-profile pagination
remain open. The fictional portrait intentionally lacks translated generated prose; Chinese
fixed labels therefore coexist with English source prose rather than inventing a translation.

## Verification record

Typecheck, lint, format check and the full suite passed (43 files / 488 tests); report tests
passed (10 files / 67 tests) and installed-package validation passed. Browser QA passed all
33 cases. All eight PDFs remain ten A4 pages, with 80 page rasters and eight contact sheets.
All contacts were inspected, plus desktop detail for all three looks, mobile dark Chinese
overviews for all three, Prism mobile detail, English page 8 and Chinese page 10 across looks.
A new comparison-heading regression was reproduced red with the PDF inspector before the
print fix: the progress heading must travel with its figures. The existing capability and
methodology guards remain. PDF export now waits for embedded fonts before writing the file.
The HTML snapshot was updated after visual inspection; no arbitrary CSS assertion was added.

## Independent review

Codex GPT-6.1 Sol (medium) completed a read-only review with no findings. It inspected the
shared CSS, version and output documentation, representative desktop/mobile captures,
Prism/Folio/Classic PDF contact sheets and selected full-size PDF pages. It confirmed that
open composition changed layout beyond removing card borders and found no concrete overlap,
clipping or source-order regression in the inspected outputs. The reviewer did not rerun
checks, operate the browser or read every page of every PDF. This is not owner aesthetic
acceptance or validation of arbitrary user data lengths.

## Owner acceptance for commit

On 2026-10-29 the owner accepted the current revision and requested scoped commits on main.
The unfamiliar-reader walkthrough and arbitrary-profile validation remain separate open items.
