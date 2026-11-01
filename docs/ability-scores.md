# AI collaboration ability scores

New analyses assess six fixed abilities: providing context, planning, verification, steering,
risk and boundaries, and recovery. Traits remain prose observations. The radar scores practice
shown by selected user prompts and explicitly adopted recorded instruction content, not population rank, personality, or proof that an agent
completed the requested work.

Scores run from 0 to 100 in steps of five. The reduce prompt defines concrete anchors at 25,
50, 75 and 100; the review checks the scores against the same sources. The program verifies
quotes and caps scores at 60 with one cited conversation, 85 with two, and 100 only with
three across at least two analysed periods. No verified evidence yields null ("Not assessed"),
not zero. These caps limit the evidence claim; they do not validate the model's judgment.

Projects with at least 20 analysed conversations receive scores based only on their own
quotes. Reports show the evidence for overall scores and hide quotes/project names under
the existing exclusions. Cards contain no quotes. A missing score has a labeled spoke but
no point; a partial radar has no filled polygon.

For example, the former frequency radar could show "verification: 2 of 100 conversations".
The new assessment can give strong verification practice a score of 85 from two conversations,
even if it is rare. A proposed 95 from one conversation is lowered to 60. These are synthetic
examples of the contract, not results from an engine comparison.

Schema 24 stores abilities and removes trait frequencies. Released schemas 8 and 14 decode
with an empty ability list; render does not infer scores from old traits. Reanalysis is needed
to obtain scores. Analysis version 35 invalidates earlier analysis caches. Trait labeling is
removed, saving one call per analysed chunk. Existing historical execution records with a
label stage remain readable.

## Verification on 2026-11-01

- Typecheck, lint, formatting and all 107 test files pass (955 tests).
- The production build passes. English and Traditional Chinese classic cards were rendered
  and inspected with a synthetic partial ability radar.
- The two-engine fictional calibration used the same curious-learner input. The Claude
  case failed with RateLimited (9 attempts); the comparison skipped Codex under its remaining
  budget. A separate bounded Codex run completed in 176 seconds (6 attempts, no failures), with
  scores 50/50/40/25/50/25 in spoke order. Its overall experiment rubric failed only
  "Too few improvements" under the original rubric. The clear learner persona now permits
  zero improvements when there is no evidenced gap or cost. Re-scoring the saved Codex
  profile against that corrected rubric passes, with the prepared input hash matching and
  all six abilities' quotes verified against reconstructed fictional sources. The original
  manifest is retained unchanged. Artifacts are local under
  `eval-output/comparisons/20261031-195741-c21c/`. The failed Claude attempt is under
  `eval-output/comparisons/20261031-195610-03a7/`.
- After quota recovery, Claude completed in 206 seconds (6 calls, no failed attempts).
  The input hash and selected prompt ids match the saved Codex case. The original run
  still used the old rubric loaded at startup; re-scoring both profiles under the corrected
  learner rubric passes. All ability quotes match the reconstructed prepared fictional input.
  Claude artifacts: `eval-output/comparisons/20261031-212855-69f4/`.
- Five abilities have numeric scores from both engines and differ by at most 10 points,
  meeting the "about 15 on most abilities" criterion on this one input. Steering differs
  in assessed status; null is not compared as zero. The owner resolved its definition on
  2026-11-01; see the decision below.
  Automated checks establish quote matching, caps, project isolation and rendering behavior;
  they do not establish semantic scoring quality or human comprehension.

Plan 35 was superseded by this scoring model. Its role-name validation, role fallback and
measured preference balance remain; trait labeling and trait frequency do not.

## Same-input calibration

| Ability             | Claude       | Codex | Absolute difference |
| ------------------- | ------------ | ----- | ------------------- |
| Providing context   | 45           | 50    | 5                   |
| Planning            | 40           | 50    | 10                  |
| Verification        | 40           | 40    | 0                   |
| Steering            | Not assessed | 25    | Not comparable      |
| Risk and boundaries | 50           | 50    | 0                   |
| Recovery            | 30           | 25    | 5                   |

Both used 29 prompts in nine conversations, across three analysed periods. The prepared
input SHA-256 is `94177171bb5a60d69ab494d096f70d465a7ea51c5755f0b34e74a24868426149`.
These are one run per engine, not a reliability estimate or a claim about the owner's ability.

### Concrete evidence and owner decision

Both engines cite "Don't write it for me, just give me the steps." for boundaries (50).
This supports a limit on delegated work; it does not establish safe production operations.

For steering, Codex cites "I'm stuck on step 3, how do I serialize a Vec of structs to JSON
with serde?" and "the canvas is blank, what am I doing wrong? I'm calling draw() every frame".
Claude leaves steering unassessed. The quotes name a problem but do not explicitly correct an
AI mistake. The former 25 anchor ("flags a problem") permitted a broader interpretation than
the ability description ("redirects"). On 2026-11-01 the owner chose to require a specific
mismatch in AI assistance or an
explicit request to change direction. Generic problem reporting alone does not qualify.
Under this definition, the historical Codex steering score is unsupported; Claude's
unassessed result is appropriate. Historical profiles are preserved as generated.

Analysis version 39 applies this threshold in both reduction and review, including project
scores. It distinguishes initial task requirements, learning questions and delegation limits
from steering. The fictional curious-learner rubric now requires unassessed steering, so a
future scored result fails the deterministic quality gate. This authored expectation is for
that input only; the application does not use keyword rules to judge arbitrary steering.
Existing reports keep their stored scores until reanalysis. The exact owner answer and case
item ids are recorded privately in the two experiments' `review.md`; other review items remain
unreviewed.

Reusable instruction evidence is described in [instruction provenance](./instruction-provenance.md). Schema 26 records purpose, selection and requirements; analysis 38 and pipeline 8 apply it to new analyses without assessing authorship.

## Evidence safeguards from local validation

An explicit SDK review-job opening identifies a delegated review session, so its follow-up
instructions are excluded from personal evidence as well. SDK transport alone is insufficient:
ordinary SDK requests and direct CLI prompts remain eligible. This recognizes specific known
job templates; it does not prove the authorship of every retained message.

Accepting results or asking to close a plan does not demonstrate verification. The reduction
and review prompts require user checks, independent verification requests or concrete acceptance
criteria. A narrow deterministic guard also removes bare acceptance-waiver quotes from verification
support before calculating its score and evidence spread. Other unsupported paraphrases still
require semantic review; matching a quote establishes its source, not its interpretation.

## Plan 36 closeout — 2026-11-01

The owner resolved the remaining scoring definition above. A fresh bounded comparison under
analysis 39 used the same prepared input hash as the original calibration. Both Claude and
Codex left steering unassessed and passed the revised curious-learner rubric. Each completed
with five calls and no failed attempts (10 of the 16-call cap). The five numerically comparable
abilities differed by at most 10 points; this single fictional case does not establish general
scoring reliability. The profiles and original outputs are preserved privately under
`eval-output/comparisons/20261101-101105-a89b/`.

The regression gate rejects a scored steering result for this authored input and accepts an
unassessed one. Its test failed before the gate was added and passed afterwards. The complete
verification passed: typecheck, lint, formatting, 111 test files / 992 tests, and installed-package
checks for prompts, dry run, HTML, JSON and PNG. No report layout or profile schema changed.
Plan 36 is complete; its file and open-plan entry were removed. This clarification ships in
0.2.1. Reports generated by 0.2.0 retain their stored scores until reanalysis.
