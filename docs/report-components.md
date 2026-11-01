# Report interaction contracts

Reports use fixed renderer templates. Model output supplies structured content, never HTML,
CSS or interaction code. Components may grow with text; fixed heights must not clip evidence.
These contracts apply to every look, language and color scheme.

| Component                     | Shared implementation                                              | Contract                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Help                          | `definition()` and `defined()` in `src/report/definition.ts`       | One question-mark trigger with a localized accessible name. Hover and focus reveal the explanation; Enter or touch pins it open. Heading explanations stay beside their heading, within the viewport. |
| Optional detail               | Native `details` / `summary`, `disclosureStyle` in the same module | Use native keyboard and touch behavior. State survives view and language changes. Keep the main evidence readable without expanding optional method notes.                                            |
| Reading and language controls | `src/report/html.ts` and `src/report/templates.ts`                 | Independent radio groups select the view and language. A selection must not reset the other control or disclosure state.                                                                              |
| Chapter navigation            | `readingPath()` in `src/report/reading-flow.ts`                    | Links point only to chapters with content; the reading order comes from the renderer.                                                                                                                 |
| Charts and generation detail  | `src/report/charts.ts`, `src/report/generation.ts`                 | Labels, units and missing-data states remain visible. Do not fabricate zero values or draw bars for unavailable measurements.                                                                         |
| Print                         | Shared print styles                                                | Both reading views, explanations and disclosure content remain readable, including content collapsed on screen.                                                                                       |

Use the existing helpers and native controls when adding report sections. Keep common behavior
in shared styles; a theme changes design tokens rather than replacing component behavior.
Any exception needs a reader-facing reason and a browser regression case. Help in the hero
uses inline content to stay inside that composition; pinned help can intentionally expand
the document. Opening a disclosure may change page height, but must not cause horizontal overflow.

## Regression checks

```sh
pnpm exec playwright install chromium
pnpm test:report-ui
```

The lockfile pins Playwright and its Chromium revision. No installed Chrome or personal cache
path is required. The reviewed computed-style baseline uses macOS system fonts, so run the
baseline checks on macOS, as CI does. This is a browser and layout regression gate, not proof
of identical typography on every operating system or browser.

The command generates only fictional profiles and checks all seven looks, both languages,
light and dark schemes, narrow and desktop widths, keyboard and touch controls, reduced
motion, accessibility and print. Generation examples include partial, unavailable and confirmed
zero measurements. No history, login or model calls are needed.

CI runs these checks for pull requests and main pushes. Releases must pass the same reusable
workflow before publication. Failures retain fictional screenshots and check results as a
GitHub Actions artifact for seven days. Local output is under `tmp/template-qa/`.

For an intentional design change, review screenshots before running
`UPDATE_STYLES=1 pnpm test:report-ui`. Inspect the diff in
`test/report/computed-styles.json`; never update it merely to make a failing check pass.
The check fails if its baseline is missing. Update the relevant theme versions when the
rendered design changes. Content coverage alone is not a reason to change the baseline.
