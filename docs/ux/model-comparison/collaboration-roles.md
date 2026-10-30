# Collaboration-role calibration

## What a role means

The four original axes describe observed choices within tasks. They are not personality,
competence, popularity or psychological measures. Stable role codes and English names remain
in `domain/Interaction.ts`; Traditional Chinese names and composable descriptions live in
`report/messages.ts`. Every catalog description combines four independently observed choices.
Names identify a working arrangement, not seniority. No name is a profession or credential.

The catalog keeps sixteen combinations because pacing and decision ownership can be separated
in authored examples. This is a product hypothesis, not scientific validation. Do not use a
complete role when any axis has both characteristic ways or insufficient evidence. Both ways
can characterize one person in different contexts. No preference is a counterexample or defect.

## Authored axis rubric

Each example below is fictional. The opposite example is another valid way of working, not
negative evidence about the person. Apply the rubric to the choice actually expressed.

| Axis    | First pole / positive example                            | Second pole / positive example                                     | Insufficient evidence                     | Context effect / prohibited inference                                                         |
| ------- | -------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Framing | Define: “Keep the public API unchanged; add pagination.” | Explore: “Compare possible navigation models before choosing one.” | “Continue.”                               | Discovery may explore while implementation defines; prompt length does not determine framing. |
| Pacing  | Stepwise: “Show one step, then wait for review.”         | Whole task: “Complete the patch before returning.”                 | A long autonomous agent run               | A learning task may need checkpoints; message brevity does not imply batching.                |
| Control | Direct: “Use my schema and index choices.”               | Delegate: “Choose the implementation within this API boundary.”    | A tool invocation or unexplained approval | A deployment approval does not remove delegated implementation choices.                       |
| Closure | Criteria: “Accept only when the contract tests pass.”    | Refinement: “Show the layout; I will adjust spacing after review.” | A correction to a broken constraint       | A test request is not a passing test; refinement is not failure to define criteria.           |

Pacing versus ownership has four distinguishable authored cases:

- Stepwise/direct: user chooses implementation details and asks for each checkpoint.
- Stepwise/delegate: agent chooses the approach and returns at each checkpoint.
- Whole-task/direct: user specifies an exact design and requests complete implementation.
- Whole-task/delegate: agent chooses details and returns a complete task.

`test/eval/personas/contextual-collaborator/` repeats these four combinations across eight
conversations. The expected result is both poles on every axis, contextual explanations and
no complete role. These are authored expectations; automated quote checks cannot certify them.

## Support and coverage

A characteristic way needs at least two independent conversations. Quotes are verified against
source prompts first. Each conversation contributes at most once, and the same excerpt cannot
supply independent recurrence twice. Maximum matching between conversations and normalized
excerpts makes this count independent of citation order. Normalization folds case, Unicode
compatibility and whitespace. It does not paraphrase or modify displayed evidence.

A long conversation adds no weight. Repeated boilerplate quotations stay visible but count only
once. This protects exact copied excerpts, not arbitrary paraphrases or every possible repeated
template. Different quoted fragments of the same template can still escape this check. Very short
identical but meaningful follow-ups can be undercounted. Semantic support remains a manual question.

The facts view reports independent support alongside total analysed conversations. That total
is coverage, not an eligible denominator or a percentage of agreement. We cannot infer whether
an uncited conversation offered a comparable choice; eligible coverage is unknown. An unobserved
pole is not evidence of its opposite. There are no numerical preference scores or population ranks.
Profiles keep their stored evidence counts on render; reanalysis applies the current analysis version.

## Roles and signature moves

Catalog rhythm, suitable contexts and possible coordination friction are fixed descriptions of
a role combination. They are explicitly qualified as possibilities, never additional findings
about the subject. Personal prose remains evidence-backed generated text. Role names in HTML
and cards come from the fixed bilingual catalog even when an older translation used another name.
No new model call occurs on render. Friction copy is hidden with coaching exclusions.

Where episodes exist, the identity view uses recurring pattern claims as short names for
observable sequences. It shows task context, numbered user turns and support spread. Each move shows at most two
representative episodes: one supporting sequence and another context when available. The
facts view retains all selected episodes. Different
contextual approaches remain present. Unknown endings never imply assistant replies or success.
Older profiles without patterns keep their existing verified trait presentation. No missing
benefit or cost is invented to fill a field. Exact quotations retain exclusions and scrubbing.
This is an initial episode-to-report slice; richer structured names, benefit/cost fields and
card selection remain unfinished work in phase C/F.

Usage intensity is statistical. Technique breadth is a description of observed requests.
Understanding needs evidence of context management, uncertainty, tool boundaries, checking or
recovery, and stays separate in the narrative. A question about a tool or an autonomous action
does not prove mastery. Missing evidence means unobserved, not low competence.

Additional authored review controls, not competence classifiers:

| Control                     | Fictional source                                       | Expected bounded reading                                              |
| --------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| Fluent short prompt         | “Use the previous schema; check null and empty input.” | Contextual follow-up and a requested check; no inference from length. |
| Heavy novice usage          | Many repeated “What does this error mean?” questions   | High activity plus questions; no expertise grade.                     |
| Sparse expert-looking usage | Two precise requests to check transaction isolation    | Two requests showing a specific concern; no global expertise claim.   |
| Tool question               | “What is a worktree?”                                  | A question, not demonstrated use.                                     |
| Autonomous action           | Agent launches tests without a user request            | No user-understanding evidence from that event alone.                 |

## Source-based draft review (analysis 18)

Every analysis now makes one bounded review call after drafting and before verification or
translation. It receives the full reduce input (observations, selected episodes, source-session
context and statistics) together with the draft. It checks all eight axis/pole combinations
independently, then checks actor, request, outcome, frequency and cost in every generated field.
It returns a complete replacement draft; the ordinary quote and provenance checks apply to it.
This has access to evidence omitted from the draft, rather than only its selected quotations.
Analysis 18 could not recover behavior that the map or episode selection never preserved;
analysis 19 adds the bounded source context described below, without sending uncited history.

The review runs once, not in an unbounded repair loop. There is no unreviewed fallback. An
error or exhausted call budget fails the profile stage before any new report is published.
Completed map/merge cache entries remain reusable; a rerun repeats drafting, review and any
translations. The call estimate and experiment minimum include the extra call. No profile
format change or review occurs on render; stored analysis-version-17 prose stays unchanged.

Behavioral regression tests prove that revised prose and restored axis sides reach the final
profile, fabricated review citations are rejected, failed review does not publish the draft,
and a budget ending after drafting writes no profile or report. These are pipeline guarantees,
not proof that a model's semantic judgment is correct. A model review is fallible and uses the
same configured runner; it is not an independent human or a scientific validation.

## Reproduction and limits

```bash
pnpm eval:compare --config experiments/role-calibration.json --dry-run
pnpm eval:compare --config experiments/role-calibration.json --budget 10
```

This holds the fictional input constant, runs the same engine twice without cache and requests
both languages. The current expected minimum is eight calls; the ten-attempt cap includes retries. Record actual
calls, errors, returned model identity, axis states, quote relevance and narrative limitations
separately. Stability on this one authored input cannot establish general classification accuracy.
Do not equate deterministic quote verification with semantic correctness or reader comprehension.

The executable persona fixtures `heavy-questions` and `sparse-boundaries` hold the activity
and understanding controls above. They are available to the existing experiment harness;
they were not included in the two-run contextual comparison. Their expectations remain
unmeasured beyond the authored source review.

## Bounded run — 2026-10-30

Ran `experiments/role-calibration.json` twice using the logged-in Claude Code default. Both
responses reported `claude-opus-5-5`; analysis version 17. The input SHA-256 was
`358cadfb8bdfb6cb82ee8a936eeaf62b4131bfbdd832035180793316eb55f940`.
The run used six attempts (map, reduce, translation per repetition), no failed attempts or
retries, within an eight-attempt cap. Durations were approximately 160 and 98 seconds. Both
mechanical quality rubrics passed. The ignored local artifact is
`eval-output/comparisons/20261030-143243-4ddf/`; re-rendered with the final production renderer
without new analysis. Generated prose is not committed as a fixture.

Manual comparison against the complete authored source:

- Both repetitions kept both characteristic ways for pacing, ownership and closure. Stepwise
  delegation and whole-task direction remained distinguishable. Neither assigned a complete role.
- Framing was unstable: repetition 1 kept both ways, while repetition 2 kept only define-first,
  despite available exploration requests. Stable on three axes in this tiny case is not a
  general accuracy measure. No inference about real users follows.
- Pattern names and selected episodes varied. Repetition 1 preserved backend versus prototype
  context well. Repetition 2 selected a broader working-mode pattern and a backend-check pattern.
- Quote checks kept 46 and 51 citations, dropping zero. This did not prevent semantic overreach:
  repetition 2 said backend tasks “end with explicit checks” and interfaces “stay untouched”,
  where the source shows requests, not completed outcomes. Its “cost of clarity” heading also
  suggests a cost not established by the fictional prompts. These remain known model failures.
- Translation completed twice. We inspected rendered English desktop and Traditional Chinese
  dark mobile layouts, including the catalog and evidence; this is developer layout QA, not
  reader comprehension research. The 390px mobile page had no horizontal overflow. The PNG
  regression export remained 1200×630. Automated checks cover all sixteen bilingual names,
  source immutability, exclusions, legacy fallback, duplicate support and citation ordering.

Phase C remains open for broader role/understanding calibration, stronger semantic safeguards
and richer signature structures. These two runs measure a limitation; they do not close it.

## Reviewed run — analysis 18

The same fixed input and reported `claude-opus-5-5` were used in two fresh repetitions under
`eval-output/comparisons/20261030-152003-d18e/`. Eight attempts were used within a ten-attempt
cap, no failures or retries, approximately 148 and 182 seconds. Both mechanical rubrics passed.

The main chapters described checks as user requests, rather than passed tests or preserved
interfaces. However, review alone did not resolve evidence loss. In repetition 2 the exploration
side cited only the layout request, counting one conversation; the navigation citation had
retained the implementation-choice sentence but omitted its opening exploration request. A
review limited to those excerpts cannot recover the missing choice. Repetition 1 still kept
both characteristic ways on every axis. Neither repetition assigned a complete role.

Repetition 1 also retained an improvement claiming that the agent worked from the opening
prompt before a later constraint arrived. The source contains no assistant turns, so that
assertion was unsupported. Repetition 2 omitted improvements. These observations motivated
bounded source context and a specific no-inferred-intervening-actions example in analysis 19.

## Bounded source context — analysis 19

The reduce and review inputs additionally contain prefixes from cited `SafePrompt` records,
which are already cleaned and redacted, never raw local history. Each prefix is at most 200
code points. Serialized excerpt data is capped at 20,000 characters and selected round-robin
by source session so one long conversation cannot fill the context. Included/eligible counts
and per-prefix truncation are explicit. Metadata remains separate from behavioral evidence.
This is extra input in the existing calls, not an extra call. It can recover opening choices
omitted by shorter observation quotes. Uncited prompts and omitted tails remain unknown.

Source-context regressions cover the exploration/ownership example, session diversity under
a small budget, explicit truncation, source IDs, omission of uncited prompts and the total
size bound. Pipeline tests also assert that the review receives this source context. The
review prompt explicitly rejects an assumed agent action between two user turns as an impact.

## Source-context run — analysis 19

Repeated the same input twice with the same engine. Both runs reported `claude-opus-5-5`,
using eight attempts in total, no failures or retries, under a ten-attempt cap. Durations were
approximately 119 and 136 seconds. Artifacts remain ignored under
`eval-output/comparisons/20261030-152716-089b/`. Across the two evaluation rounds in this change
(analysis 18 and 19), the total was sixteen CLI attempts.

Manual source comparison found both characteristic ways on all four axes in both repetitions,
including the exploration request previously missing from the navigation citation. Neither
assigned a complete role. Main chapters described checks as requests and did not assert passed
tests, preserved interfaces or a completed implementation. Both omitted improvements when
no visible cost was supported. The mechanical rubrics passed, with 41 and 43 citations kept
and zero dropped. This measures one authored case, not general classification accuracy.

There are remaining semantic limits. A compressed pattern in repetition 1 describes steering
from a result more directly than the user-only sequence establishes. Statistical fun facts
also generalized observed prompt days into work days. A review by the same configured model
is a safeguard, not an independent truth certificate. Broader cases and semantic review remain
open; do not count these two repetitions as full phase-C acceptance.

The final implementation addresses the statistical scope error deterministically: published
fun facts are now projected directly from total recorded prompts, conversations, prompt days
and streak length, explicitly scoped to the selected history. Generated model fun facts are
ignored before translation. For example, “They work Monday to Thursday only” is replaced by
“Recorded prompts appear on 8 days in this history.” Activity cannot establish a work schedule.
This projection was added after the paid run and tested with synthetic statistics, without
additional model calls. The saved evaluation profiles above retain their original output;
existing profiles are not rewritten on render. Future analyses translate the bounded facts.
