# Explanation iteration

Applied the local `prompt-profile-explain-reports` skill to production rendering and future
analysis writing. It is discoverable by name; it is not a runtime dependency.

## Reader questions and source audit

| Question                             | Stored source                                                 | Denominator and limits                                                                                   | Presentation                                                                                   |
| ------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Which tools appear in conversations? | `stats.techniques.tools[key].sessions`                        | `coveredSessions`, not `totalSessions`; transcript metadata coverage is partial                          | Sorted percentages plus exact session numerator / denominator, coverage against total sessions |
| What do prompts ask for?             | `stats.techniques.prompts[key]`                               | Ratio of matching cleaned prompts / all cleaned prompts; `stats.analyzedPrompts` stores that denominator | Rounded percentage, denominator and wording-rule explanation                                   |
| What is unknown?                     | Null techniques, zero covered sessions, zero analyzed prompts | Missing measurements differ from observed zero use                                                       | Explicit states; no percentage bars without a denominator                                      |
| Which preference is supported?       | Portrait axes and exact evidence                              | Categorical, no numerical scale                                                                          | Unknown remains text; no midpoint marker                                                       |

Pipeline audit: `pipeline/techniques.ts` counts each cleaned prompt once per matching rule,
then rounds ratios to four decimal places. Rules can overlap. Aggregate exact matching counts
are not stored; monthly counts are not used to reconstruct an aggregate or infer numerators
from rounded ratios. Tool session counts are already stored. Counts are observations of agent
activity, not evidence of user expertise. Prompt matches describe requests, not completed work.

All categories remain visible, sorted by frequency. This small complete inventory avoids
hiding zero observations or implying a hand-picked positive story. Detailed named inventories
remain in the evidence view. No trend or sequence is invented.

## Concrete changes

Previously: “Workflow in practice” and a percentage alone.
Now: “Which tools appear in conversations?”, followed by the source, coverage and
“38% / 3 / 8” as a percentage with its exact fraction on a separate line. In this authored
synthetic example, three of eight covered conversations used a tool; forty conversations
exist overall. It does not mean three of forty or three tool events.

Previously, an empty cleaned sample could produce zero-percent bars. Now it explicitly says
there is no denominator. Missing technique measurements and zero metadata coverage have
different explanations; neither claims tools were unused.

Authored writing examples below are design guidance, **not model outputs or an LLM evaluation**:

| Before                                                    | After                                                                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| They exhibit a verification-oriented disposition.         | They ask for checks before accepting a change. This appears in two conversations; other tasks may differ. |
| They successfully validate all work using rigorous tools. | They request tests before delivery. The prompts do not show whether the tests passed.                     |

## When improvements apply

| Change                                                                                    | Existing profile re-render                        | Future analysis                                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Chart labels, source counts, missing states, overlap and interpretation copy              | Immediate; offline                                | Same rendering                                                                             |
| Unknown preference marker removed                                                         | Immediate                                         | Same rendering                                                                             |
| Concrete third-person descriptions, one main idea per sentence, support and qualification | Stored prose and exact quotes remain intact       | Updated reduce and translation prompts; analysis version 11 invalidates old analysis cache |
| Normal project names / excluded names                                                     | Existing user choice preserved in report and card | Same privacy contract                                                                      |

Look version is 5 for the shared chart presentation; render manifest format remains 2.
No Profile or pipeline version change: neither format nor matching/cleaning rules changed.
No renderer rewrite of generated prose and no LLM call were introduced. The writing guidance
uses short English sentences as a flexible target; Traditional Chinese stays natural Taiwan
usage without an English word count. It does not claim standards conformance.

## Medium choices and remaining acceptance

Static labeled comparisons answer the supported quantitative questions. Offline language/view
controls and visible evidence already support deeper inspection. No animation is needed.
Narrated video remains optional guidance for a future supported process explanation, with
captions, pause/skip and a static equivalent; no service, key or autoplay is added.

Behavior tests establish red for missing denominators and coverage labels before production
changes. Existing exclusion/translation and legacy tests remain regression coverage.
Owner visual acceptance and an actual reader walkthrough remain open in plan 21.
No private history was read. Public gallery data is fictional.

## Validation record

- Red: report project had 1 failed / 9 passed files, 2 failed / 65 passed tests.
  The new behavior tests failed on missing coverage and missing-measurement explanations.
- Green: full typecheck, lint, format check and unit suite: 43 files / 488 tests.
  Relevant report + analysis projects: 17 files / 139 tests.
- Browser reproduction: `pnpm exec tsx scripts/template-gallery.ts`, then
  `node scripts/template-qa.mjs`: 27 cases, no failures. File URLs only, no server.
  The QA script now captures both languages at 360 and 1440 pixels in both themes.
- Visually inspected full-page Prism desktop/light English overview, Slate mobile/dark
  Chinese overview, Folio desktop/dark English detail, and Prism mobile/light Chinese
  detail. Chart labels and fractions remain visible. These are representative inspections,
  not owner acceptance of every combination.
- The fictional fixture has no translated portrait, so its Chinese view intentionally
  retains the existing English generated portrait fallback. This run does not evaluate
  future translated narrative quality.
- Card regression reproduction: cached verified CJK fonts with `scripts/card-qa.ts`:
  48 geometry/PNG cases passed. Card rendering logic was not changed in this iteration.
- Installed-package build verifies embedded prompts, fonts, offline HTML and PNG.
  No real CLI/LLM calls, history reads, external media service, commit or deployment.

## Independent review disposition

Codex GPT-6.1 Sol (medium) reviewed the skill, chart denominators and pipeline/CLI data flow,
writing prompts, related tests and verification records. E1 (low): the Chinese authored
before/after example in this document violated the repository's English documentation rule.
Accepted; removed that row while retaining the English examples. Production bilingual report
messages remain unchanged. This documentation-only correction did not require another review
pass. No other functional blockers were reported. The reviewer did not rerun tests, inspect
all regenerated outputs or evaluate real LLM writing quality. Owner acceptance remains open.
