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

## Owner wording and interaction update — 2026-10-31

The owner now requires second-person descriptions throughout the generated profile: “you”
in English and “你” in Traditional Chinese. This supersedes the earlier third-person writing
choice above. Neutral noun headings remain natural; exact quotes and suggested sample prompts
keep their own voice. For example, “They ask for checks before accepting a change” becomes
“You ask for checks before accepting a change”, with the same evidence qualification.
Analysis version 24 applies this to future generation. Existing stored prose is not rewritten
by rendering; the owner's requested local report received a separate editorial revision with
all source quotes, statistics, coverage and evidence origins checked unchanged.

Episode identifiers remain internal anchor targets. Reader-facing headings and cross-links use
the episode task title, so filtered selections never suggest a missing numbered first example.
Definitions now open on hover and keyboard focus. Native disclosure remains available for touch
and pinning, with a filled accent state when pinned. Essential evidence remains visible.
Optional interaction design and owner feedback are recorded in the [interaction record](#optional-interactions--2026-10-31).

Regression tests were observed failing before fixes for scope-hash auditing, visible episode
identifiers, and tooltip interaction styles. Typecheck, lint, formatting and 88 test files / 813
tests passed after the fixes. A live headless Chrome check at 390px verified closed-by-default,
hover, keyboard focus and click-to-pin behavior; its dark-mode tooltip screenshot was inspected.
This verifies interaction behavior, not owner aesthetic acceptance. The scope hash is exempted
only at its exact metadata path and only when it is 64 lowercase hexadecimal characters; the
same string in prose and malformed identity values remain subject to privacy checks.

The follow-up local-data smoke run also exited 0 (4 files, 4 tests). The final local artifact
was checked for absence of visible episode IDs, the restored scope hash, second-person
narrative and hover styles. Its original analysis archive was retained separately.

## Configurable narration — 2026-10-31

The owner approved a generation-time `--voice first|second|third` setting, defaulting to second
person. This replaces the fixed second-person requirement above with a configurable policy.
The choice is assigned by the application as `profile.voice`, passed to final generation,
evidence review and translation, and shown in offline report metadata. Descriptive navigation
and introduction labels follow the recorded perspective. Interface instructions may still
address the reader. Source quotes and sample-prompt speakers are not rewritten.

Profile schema 19 makes the voice optional for legacy decoding; missing metadata stays unknown.
Analysis version 25 carries the configured instructions. Voice-independent map/merge evidence
caches are reused across narration choices; final prose and translations are regenerated.
Offline render preserves stored prose and has no voice override. Full usage is in the
[README](../../../README.md#narration-voice).

Before implementation, the CLI regression failed for all three requested voices. Separate
render regressions failed for all three voice labels. Final typecheck, lint, format check and
unit tests exited 0 (89 files, 825 tests); local-data smoke also exited 0 (4 files, 4 tests).
Tests cover stage routing, default/selected provenance, invalid values, cache reuse, recovery
commands, bilingual labels, legacy fallback, quote integrity and render without another model
call. A synthetic desktop HTML report was inspected for the first-person labels and metadata.
The synthetic fixture's original generated prose was preserved, rather than relabeled by string
replacement; this is layout/routing evidence, not a live LLM evaluation of narration quality.
No additional subscription calls were made for this feature's verification.

## Narration options simplified — 2026-10-31

The owner removed third person from generation settings. `--voice` now accepts only `first`
and `second` (default). This supersedes the three-option configuration above. The CLI rejects
`--voice third` before making any LLM calls, and recovery commands and current documentation
only advertise supported choices. Previously stored third-person profiles remain decodable
and render unchanged; this compatibility path is not a generation option.

The rejection regression failed before the CLI choices were narrowed. Cache-reuse coverage
now switches between first and second person; existing third-person rendering coverage is
retained explicitly for legacy compatibility. No profile format or generation instruction
change was needed.

## Released-profile compatibility baseline — 2026-10-31

The owner limited compatibility to published profile formats. Releases v0.1.1–v0.1.4 used
schema 8, and v0.1.5 used schema 14, before stored narration settings existed. This supersedes
the development-only third-person compatibility path described above. Current files accept
only first or second person; released files without a stored voice keep their original prose
and do not acquire a narration label. Intermediate development schemas are unsupported.

## Optional interactions — 2026-10-31

Reader questions and existing sources determine the controls:

| Reader question                        | Existing content                               | Interaction                                                                                   |
| -------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| What does this number mean?            | Renderer definitions, sources and denominators | Labeled native definition disclosure; hover/focus previews and tap/Enter pins it              |
| What supports this observation?        | Stored quotes and preference evidence          | Native disclosures remain open initially, with text controls and distinct open/closed markers |
| What other suggestions can I consider? | Remaining stored improvements                  | Existing optional alternatives disclosure, with the same state treatment                      |

Previously definitions appeared only as a small `i`. They now show “About” /
“說明”, following the selected report language, with a larger target. Pinned definitions
use document flow so touch readers can scroll through them. Essential observations and evidence
remain visible initially. Print exposes native disclosure content even when the reader closed it.
No new animation is added; existing reduced-motion rules remain in force.

This is a render-only change for stored profiles; no analysis, pipeline or Profile schema changes.
All look versions advance (Classic 21, others 27). Run `scripts/template-gallery.ts`, then
`scripts/interactions-qa.mjs` with Playwright Core available to reproduce synthetic interaction
checks. Browser automation establishes control behavior, not reader comprehension. Owner
feedback and the resulting revisions are recorded below.

### Owner feedback and revisions

The owner found the filled, bordered disclosure controls too much like clickable cards.
Controls now use text, native disclosure markers and an underlined open state. The definition
entry is the shorter bilingual “About” / “說明”, without a button border or filled background.
Keyboard, touch, focus and print behavior remain available.

The owner also found skipped turn numbers confusing. Featured observations and grouped
excerpts now use unordered lists without manually prefixed turn numbers. Explicit turn
metadata remains on the factual episode record.

Preference rails looked like scores and unexplained missing dots looked like missing data.
The overview now uses text descriptions instead. Unsupported dimensions and wholly empty
preference sections are omitted. The heading is “How you work with AI” /
“你習慣怎麼和 AI 一起做事”, with visible text explaining what requests the current dimensions
describe and the two-conversation evidence threshold. Factual evidence retains single examples.
These changes do not lower the evidence threshold or infer new preferences. Current look
versions are Classic 24 and other looks 30.

The owner asked whether observation should extend beyond four fixed dimensions. Existing
free-form observations, signature moves and episode patterns already support a broader account.
Further analysis changes should distinguish open-ended habits from fixed categories, retain
independent evidence and explain that they apply to future analysis rather than rewritten
stored profiles. The owner selected open-ended habits; the implementation record below supersedes this pending decision.

### Open-ended habits — owner direction

The owner chose evidence-led habits without a fixed four-category limit. Map, reduce and
review prompts now look beyond those axes, using context sharing, explanation requests,
comparison, decision boundaries, checkpoints, verification, redirection and recovery as search
aids rather than required slots. Existing `collaboration.moves` stores up to six distinct habits
proposed by the model. A recurring choice need not be phrased as a sequence; supporting episodes
still retain ordered turns for context. Each description must state its supported task context.

The first view uses these freely named habits and their existing episode evidence. It displays
all stored habits rather than truncating them to three; the hero still selects three for a
quick scan. The fixed-axis overview is removed. The facts view retains the old axis evidence
with single examples labeled as such, so historical evidence remains accessible. Legacy reports
continue through the existing pattern/trait fallback; rendering does not invent new habits.
Stored source prose and the Profile format are unchanged.

Verification rejects habits supported only by one conversation, unknown episode references,
or duplicated source sequences across conversations. Independence is computed from complete
source prompts where available. This checks recurrence and provenance, not whether a quote
semantically entails a claim; the review prompt remains responsible for that distinction.

ANALYSIS_VERSION advances to 27, invalidating earlier analysis caches; Classic is 25 and other
looks 31. Tests establish red before the duplicate-source and fifth-habit fixes. Automated
synthetic checks do not establish that a real model will reliably find every valid habit.
No paid model run or reanalysis of personal history was performed for this change.

The owner's interaction feedback above has been incorporated. Plan 34's interaction acceptance
is complete with bilingual, dark/light, mobile/desktop synthetic checks and the owner-led
revisions. Further aesthetic feedback can still lead to iteration.
