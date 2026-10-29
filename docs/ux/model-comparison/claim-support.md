# Claim-support calibration

## Frozen authored baseline

The six hand-written cases in `test/eval/claim-support/cases.json` translate failure modes
from [the earlier blind review](review.md#concrete-errors-and-unsupported-claims) into a small,
fully fictional source slice. They do not contain local prompt history or new model output.
Each case freezes its source prompts, selected evidence, overreaching `before` claim, bounded
`after` alternative and authored review rationale. The two claims are alternatives written by
the maintainer, not measured model improvements.

| Case                    | Baseline overreach                                                | Bounded alternative                                             | Quote check / selected sessions     |
| ----------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| Irrelevant quotation    | Threshold rationale interpreted as an approval gate               | Describe the rationale request                                  | Authentic / 1                       |
| Same-session repetition | Repeated rollback requests interpreted as a cross-project routine | Repetition within one session                                   | Authentic / 1                       |
| Single event            | One export failure interpreted as recurring breakage              | One failed export                                               | Authentic / 1                       |
| Request as achievement  | A comparison and quiz request interpreted as mastery              | Describe what was requested                                     | Authentic / 1                       |
| Missing counterexample  | Planning interpreted as universal                                 | Planning for a migration, direct implementation for a small fix | Authentic / 1 selected, 2 available |
| Context dependence      | Approval for payments interpreted as universal personal control   | Approval for payments, delegation for a disposable prototype    | Authentic / 1 selected, 2 available |

All six baseline claims have authentic quotations. All six are manually judged unsupported
at the stated scope. This is the baseline finding: quotation validity alone cannot certify
semantic support. The bounded alternatives are examples, not mandatory output strings.
Run the frozen checks without any CLI calls using `pnpm test --project analysis`.

## Manual review rubric

Review the claim together with the entire frozen source slice, not only its selected quotes.
Record judgments separately; do not add them into a personality or overall truth score.

- **Quote validity (mechanical):** does the prompt exist and contain the quoted text? Duplicate
  citations do not add support. This says nothing about whether the text entails the claim.
- **Session spread (mechanical):** count distinct source sessions behind verified selected
  evidence. Several prompts in one session are one session. Available-source totals describe
  only the supplied slice, never full-history statistics or the number of supporting sessions.
- **Semantic support (manual):** supported, unsupported, or insufficient. Check the asserted
  action, actor, outcome and frequency. A request or autonomous agent action is not user mastery.
- **Specificity (manual):** bounded, overbroad, or generic. Does the claim preserve the task,
  context and time window? Do not reward vivid unsupported details over a precise small claim.
- **Contradictions (manual):** addressed, omitted, absent in this slice, or insufficient. Look
  for contrary prompts in the available source, including unselected evidence. Absence here
  does not establish absence in the person's history.
- **Uncertainty (manual):** calibrated, overstated, or insufficient. One episode stays one
  episode. A habit needs distinct sessions and meaningful recurrence, not quote volume.

An absent review is `unreviewed`, never implicitly supported. The authored `review` field in
fixtures records the case author's judgment; it is not a model judge or a blinded human study.

## Evaluation output and regression

Plan 22's existing `quality.json` now includes `claimSupport` when the caller supplies source
prompts. It contains field paths, quote-validity counts, selected-evidence prompt/session counts,
available-source prompt/session counts and four separate pending manual judgments. The legacy
`passed` field still means deterministic rubric checks passed; it does not mean semantic truth.
Calls without sources return `claimSupport: null` rather than invented session coverage.

Headlines, archetypes and portrait introductions have no direct evidence fields in the current
profile contract. They deliberately report zero selected evidence; reviewers must trace their
claims to supported body content. Axis counterevidence is emitted as a separate entry. This
output does not infer that a larger available-source session count supports a claim.

A demonstrated failing regression showed that a forbidden mastery assertion in the portrait
introduction escaped `scoreProfile`, although the same assertion in a headline was checked.
The scorer now includes portrait introduction, chapter prose and axis explanations in its
existing concept/forbidden-pattern/universal-quantifier checks. Quotes remain excluded.
The subsequent production changes below bump the analysis cache version. The profile schema and pipeline rules remain unchanged.

## Production calibration — 2026-10-30

The following behavior is now covered by failing-before/fixed-after regressions:

- A compound observation, trait or coaching item is removed if any citation is missing or
  fabricated. Authentic duplicates are deduplicated, not mistaken for fabricated support.
  Unsupported dimension titles and summaries are cleared. A portrait with a rejected chapter
  or rejected axis/counterevidence is withheld as a whole, so its uncited introduction cannot
  retain an assertion removed from its body.
- If reduce rejects evidence, uncited headline/archetype summaries are reset to neutral
  observations and the global portrait is withheld. A draft with no body evidence also gets
  neutral summaries. This conservative fallback can remove accurate prose too: without
  sentence-level provenance, selectively rewriting a compound claim would invent certainty.
- Map verification is limited to that chunk's actual prompts. Final verification is limited
  to successfully analyzed prompts, excluding failed or unselected source slices.
- A cap or LLM merge that omits a source quote restores the full original observation,
  including its claim/context. Contrary evidence is not identified using sentiment keywords:
  the safeguard preserves every omitted quote. Cached merges get the same treatment.
  The input limit remains enforced; if lossless retention cannot fit, analysis reports
  `input-too-large` rather than silently discarding examples. Preservation can increase input
  size and reduce merge compression. The guard cannot determine whether a paraphrased merge
  claim is semantically faithful when it retains all quotations; the review rubric still applies.
- Without complete origin metadata, a trait's spread stays unknown (`support: null`) and
  confidence is capped at low. Quote volume alone never invents independent sessions.
- Map, merge and reduce instructions explicitly distinguish quotation authenticity from
  relevance, requests from achievements, one event from recurrence, and task-specific choices
  from universal preferences. They require contrary examples to survive compression.

No semantic classifier or second LLM judge has been added. An authentic but irrelevant quote
can still escape deterministic verification. The authored cases and pending manual judgments
make this limitation visible rather than certifying semantic truth.

### Report presentation and bilingual strength

Where `Trait.support` is present, the HTML report replaces the confidence meter with selected
quote/session/week coverage, an explicit warning that these are not full-history frequencies,
and a pointer to context and exceptions in the source prompts. Unknown or inconsistent legacy coverage retains
its confidence fallback with an explicit unknown-spread label. Counts larger than the number
of distinct cited prompts are not presented as selected-evidence coverage. This also applies
to minor traits, which show their support line alongside their descriptions. Existing statistics keep their original full-history denominators.
This applies when rendering existing profiles; existing generated prose is never rewritten.

Each authored case includes a Traditional Chinese bounded alternative (`afterZhTW`). The
paired texts preserve requests, a single event, within-session repetition and task-specific
contrasts. The translation-boundary regression feeds these authored alternatives through the
fake runner and checks preservation of the English source and evidence. This verifies data
flow, not translation quality of a real model. Translation instructions also explicitly preserve
those qualifications and optional suggestions. No human translation study is claimed.

Analysis version is now 12, invalidating older map/merge cache entries through the existing
versioned keys. Profile schema stays at 10 and pipeline version stays at 4, because their
contracts did not change. Theme versions become classic 11 / other looks 17; render manifest
format stays at 2. Existing migration and cache-invalidation tests remain part of the full gate.

## Recorded repeated-run variation

No new subscription-quota calls were made for this change. The existing frozen fictional
`curious-learner` runs provide actual repeat-run evidence, distinct from deterministic tests:

- [Claude r1](runs/claude/curious-learner/r1/run.json) and
  [r2](runs/claude/curious-learner/r2/run.json) both requested the CLI default (`null`) and
  recorded reported model `claude-opus-5-5`. Both returned five traits, but only
  “Tutor, not ghostwriter” retained the same name. Review-loop/review-seeker and
  why-asker labels changed, while idiom/enthusiasm observations gave way to quiz/comparison
  observations. Equal counts did not mean an identical selection of claims.
- [Codex r1](runs/codex/curious-learner/r1/run.json) and
  [r2](runs/codex/curious-learner/r2/run.json) both requested the default and reported no model
  identity (`null`). Both returned four traits, but only “You keep the keyboard” retained
  its name. The second run introduced “Compilation is a milestone”, whose thin support was
  called out in the blind review. Unknown reported identity stays unknown.

All four archived runs record persona hash
`51cead259a79238ec23ade1740ebc1d471f169e404da9cd0d93621c02abcd6ea`, the same three selected
chunk ids and 29 selected prompt ids. They used analysis version 4 and the older experiment
format. They establish historical within-configuration variation, **not** an evaluation of
version 12's prompts or a causal before/after model improvement. Counts are structural;
wording/name changes alone do not prove a change in semantic support. No universal model
winner follows from these examples.

Future opt-in comparisons use plan 22's current frozen inputs, private atomic outputs and
explicit bounded attempt budget. Requested and reported identities remain separate in its
provenance. New real comparisons remain optional; normal tests use fake runners only.

## Verification and completion

The regression suite covers partial rejection, portrait/global fallback, source spread,
lossless cap/merge handling including cached results, source-bounded quality output, bilingual
translation data flow, legacy profile migration and versioned cache invalidation.
The offline renderer is unchanged in its privacy exclusions, escaping and CSP. This calibration
is complete as an engineering/evaluation delivery; it is not a guarantee that every generated
sentence is true. Episode schema/provenance expansion remains owned by plan 20 B, and role
semantics by plan 20 C.

Final validation on 2026-10-30: `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and
`pnpm test` all exited 0; 62 test files and 656 tests passed. Offline production renders for
all seven looks were checked at 360px/dark and 1440px/light in English and Traditional Chinese,
including print-mode support presence: 42 checks, no horizontal overflow or missing support
labels. Full-page Classic mobile/Chinese and focused evidence-panel captures were inspected;
this is a bounded display check, not exhaustive visual or translation approval. The generated
fictional reports and captures are local under `tmp/calibration-render/`, not committed user data.
