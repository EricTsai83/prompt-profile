# Document layout iteration

Owner visual acceptance remains pending. Independent review pass 1 identified three issues;
all were accepted and corrected as recorded below. Final review confirmed all three findings resolved without new findings. This is an implementation
iteration, not completion of plan 21.

## Starting state and scope

The shared checkout already contained authorized changes in README, plan 21/index, analysis
prompts/version 11, CLI options, report templates/card/looks/html/messages/portrait/visibility/
overview, report and analysis tests/snapshots, template/card QA scripts and fictional demos.
The unrelated untracked plan 22 was preserved. The supplied starting validation was 43 files /
488 tests. No history, LLM or private smoke test was read or called.

## Findings and decisions

Source audit found panel bottom margins combined with grid gaps and section margins; portrait
leading approached 1.95, while captions and inventories followed unrelated local spacing.
The previous print rule kept entire portrait chapters together. These are source observations;
a saved pre-change physical PDF was not produced in this iteration.

`document-layout.ts` is the final layout layer, after component and template styles. Components
retain color, illustration and semantic markup. The shared 4/8/12/16/24/32/48 spacing scale
separates inline, paragraph, group and section distances. Grid children have no extra trailing
margin. Desktop gutters scale from 20 to 48 px, and portrait prose uses a 65ch measure with
1.8 body leading. Evidence, coaching, axis bodies, captions and methodology use the same rhythm.
Prism keeps its accent rule, Slate its compact split introduction, and Folio its serif/open
introduction. Classic remains the default. All look versions are now 6; no data/analysis version
was changed by this iteration.

## Print strategy and physical review

A4 uses 16 mm top, 17 mm sides and 18 mm bottom margins. Both views print with the existing
selected-language CSS; no cloned DOM or visibility transformation is used. Chrome adds a safe
page counter without URL, path or date. Long chapters, inventories and coaching can split;
short excerpts, inventory entries and chart panels stay together. Print colors use a light,
muted blue/gray palette with labels retained. No PDF command was added to the product.

The first physical export revealed excessive single-column chart pages and a split weekly chart.
The revision restores two-column overview figures, two-column small chart groups, shorter plot
heights and ordinary block flow for long capability inventories. The first implementation exported six PDFs with
12 A4 pages each, before the review-driven corrections below. Every page was rasterized with PyMuPDF and inspected in six full-page contact sheets
(72 page images total). Poppler was unavailable; PyMuPDF was installed only in a scoped temporary
uv environment. Geometry/text checks passed; no wholly blank page or out-of-page text was found.
The weekly plot now stays together. Long containers can continue across page boundaries.

Initial visual limitations (corrected below): overview figure grouping and the deliberate
detail-view page break left partially filled pages, and methodology was stranded on a short tail
page. This is not a claim of publication-ready perfection or owner acceptance. The fixture's
portrait falls back to English in the Chinese report, so this is not full bilingual prose QA.
Contact-sheet inspection assesses page composition; individual PNGs are available for closer
parent review. No independent review was performed by this implementation agent.

## Reproduction and checks

- `pnpm exec tsx scripts/template-gallery.ts` refreshes the fictional captures in `tmp/template-edges/`.
- `PLAYWRIGHT_CORE=<module path> node scripts/pdf-qa.mjs` exports the six PDFs from file URLs.
- `uv run --with pymupdf python scripts/pdf-inspect.py` checks A4, nonblank pages and text bounds,
  and renders all pages. `tmp/pdfs/inventory.json` lists every PDF and PNG.
- PDF browser QA checks both views, selected language and document overflow before export.
- Existing 27-case browser QA checks 360/390/1440 widths, light/dark, both views/languages and
  fictional exclusion/legacy/unclear fixtures. Exclusion correctness remains covered by unit
  regressions; PDF text checks do not independently prove all exclusions.
- Final required checks: typecheck, lint, format check and 43 test files / 488 tests passed.
  Installed-package validation passed. Card code was untouched in this iteration; report/card
  unit regressions ran, without repeating the earlier 48-case card raster study.

Incremental files: document-layout.ts (new), html.ts composition, looks.ts versions,
looks/templates tests, report snapshot, plans README/21, regenerated fictional template HTML/index,
pdf-qa.mjs and pdf-inspect.py (new), and this log. Existing card PNGs are regenerated deterministically.

## Review-driven pagination corrections

- D1 (high): excessive avoidable blank space remained in the first 12-page exports. Accepted.
  The detail view now continues after the overview rather than forcing a new page. Overview
  chart spacing is tighter, the three small context charts share one row, and dimension
  summaries use a two-column print flow. Methodology is secondary typographically and stays
  with the report tail. Content and evidence are preserved; body prose remains 10pt.
- D2 (medium): Classic has no data-look attribute, so the initial shared CSS missed it.
  Accepted. The common selector is now html:root; template-specific exceptions still use
  their look attributes. Classic English/Chinese renders are generated as QA artifacts under
  tmp/pdfs and included in browser checks and physical inspection.
- D3 (medium): Ship's heading and its 144 PR measurement split across pages. Accepted and
  reproduced with PDF text before the fix. Capability headers and their initial measures now
  share a cap-lead group that stays together, while long named inventories may continue.
  PDF QA checks that the synthetic Ship heading and measurement occur on the same page.

The corrected six deliverable PDFs each have 10 pages, down from 12. Classic's two QA PDFs
also have 10 pages each. The fixed fictional gallery additionally checks the page-count budget
and that methodology is not stranded on a separate tail page; these are fixture regressions,
not constraints on arbitrary user reports. Both views and the selected language remain
visible in all eight physical exports. The sparse fourth page now contains portrait text;
the final page contains the remaining observations and methodology together. Each page is
rasterized, and stale page PNGs are removed before rebuilding the inspection inventory.

Post-fix verification: typecheck/lint/format/test passed (43 files / 488 tests), as did the
installed-package build check. Browser QA now includes Classic and passes 33 cases. All eight
current PDF contact sheets were inspected for page composition; individual Prism English
pages 4, 9 and 10, Prism Chinese page 10 and Classic English page 1 were also opened at full
page size to inspect the corrected joins, final observations/methodology, and default layout.
These are actual rendered outputs, not only print-media DOM checks. The PDF inspector verifies
all 80 page rasters, text bounds, selected fixture page budget and Ship's heading/data pairing.
Final independent review pass 2 confirmed D1, D2 and D3 resolved with no new findings. The
reviewer inspected all eight current contact sheets and the same five full-size issue pages;
checks were not rerun by the reviewer. This verification is limited to the fictional fixture,
not arbitrary report lengths. Owner visual acceptance remains open.
