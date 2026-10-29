# Production iteration implementation record

## Scope and decision

The owner rejected prototypes A/B/C; the baseline was only relatively preferred and remains
insufficiently attractive. The owner authorized original production templates after accepting
the product UI research recommendations. Prism, Slate and Folio are selectable through the
existing render-only `--look`. Classic remains the default. No third-party code or assets were
copied. Existing licensed bundled fonts remain governed by their existing license files.

The new report layouts share tokens, verified signature selection and existing evidence/chart
renderers. Prism emphasizes a bright summary, Slate places identity beside compact signatures,
and Folio uses a narrower narrative reading measure. Matching cards reuse the existing PNG
pipeline and privacy boundary. Mixed axes omit misleading centered numerical-looking rails;
contrary and supporting portrait evidence have separate expanded groups.

## Verification

- TDD red: `pnpm test --project report`, 1 failed / 9 passed files, 62 passed / 1 failed tests.
  The new template registry assertion failed before implementation (log: `/tmp/plan21-red.log`).
- Full checks: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`, exit 0,
  43 passed test files, 484 passed tests. Existing look tests enumerate the expanded registry,
  including all eight card hiding combinations, unchanged report output and card privacy.
- `pnpm test:package`, exit 0: build and installed-package assets/HTML/PNG check passed.
- `pnpm exec tsx scripts/template-gallery.ts`: public fictional examples and 1200 × 630 cards.
- `node scripts/template-qa.mjs`: 27 cases: 18 viewport/color combinations plus nine mobile edge profiles; each checks both views and
  both languages, offline requests, horizontal overflow, expanded evidence, independent
  selections and print visibility. Local manifest: `tmp/template-qa/checks.json`.
- Captures in `tmp/template-qa/` cover full overview and detail at 360/1440 in light/dark.
  Manual screenshot inspection included lower report sections and all three cards. An initial
  card overflow and layout selector specificity issue were corrected before final captures.

## Remaining acceptance

This record does not claim owner visual acceptance. Independent review completed in two passes; R2 was fixed and confirmed. R1 was later withdrawn after owner clarification. The gallery fixture's portrait lacks generated Traditional Chinese translation and uses
the existing fallback; other translated content and fixed labels remain switchable. Browser
checks also cover legacy/no metadata, all-unclear axes and long mixed-script identity with all
exclusions at 360px. They do not exhaust every cross-product of individual exclusions and text
lengths. Existing unit coverage supplies part of that contract. Keyboard Tab is exercised but a full
screen-reader audit has not been performed. No history, LLM, adapter smoke, commit or deployment
was performed.

## Independent review and fixes

Codex GPT-6.1 Sol (medium), production review pass 1:

- R1 / P1 (withdrawn after owner clarification): the original review required cards to always
  anonymize project names. That requirement is superseded. Normal mode preserves project
  context in both HTML and cards; `--exclude projects` (including `personal`) anonymizes known
  names in both, including generated identity and translated text. The unconditional card
  scrub was removed. Short names are anonymized in both outputs when excluded. The updated
  regression enumerates all looks, two languages, long/short names and both visibility states;
  it failed before this correction. No general entity detection of unknown names is claimed.
- R2 / P2: long CJK identity/headline/traits could push card content into the footer and past
  the PNG boundary. Accepted; reproduced using verified cached Noto Sans TC fonts (second
  trait bottom at 668px). Product cards now clamp title/headline to two lines and each trait
  to one line, normalize whitespace and bound each region. Full text remains in the HTML
  report. A multiline layout regression failed before the fix and now checks actual Satori
  text bounds instead of PNG dimensions alone.

Post-fix checks: full typecheck/lint/format/test exit 0, 43 files / 486 tests; test:package
exit 0; regenerated public examples; report browser QA 27 cases, zero failures.
`CJK_FONT_DIR=<cached-font-folder> pnpm exec tsx scripts/card-qa.ts` verifies font hashes and
runs 48 real CJK/mixed-script card layout and PNG cases across all three product templates
and all eight hide combinations. Six resulting long-text cards in `tmp/card-qa/` were opened
and inspected; text ends before the footer, with ellipses for shortened content. Outputs and
checks.json stay ignored. No network access or real user content is needed. Final independent
review pass 2 confirmed the earlier fixes with no new findings; the later owner clarification
withdraws R1 and restores project visibility as a shared report/card choice. No owner aesthetic acceptance
or reader walkthrough is inferred.
