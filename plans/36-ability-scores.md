# AI collaboration ability scores

Status: Planned; owner requested on 2026-11-01

## Outcome

The radar shows how well the person works with AI, not how often a trait shows. Six fixed
abilities are each scored 0–100%: how far the person exercises that ability in these
conversations. Clear evidence of strong practice earns a high score regardless of how often it
appears. Traits stay as text descriptions of the person's style.

This reverses a product principle ("not an ability score", "no numerical scores"): the
prompts, the report notes and the docs say instead that the scores assess collaboration skill
from these conversations' evidence, and that "not assessed" is not a low score.

## Abilities (owner: "keep these for now")

| Key | Ability | Strong practice looks like |
| --- | --- | --- |
| `context` | Providing context | files, errors and expected results given up front; irrelevant tools ruled out |
| `planning` | Breaking down and planning | numbered plans, ordered steps, describe before running |
| `verification` | Verifying results | tests, acceptance criteria, "did it actually run?" |
| `steering` | Steering and correcting | names the specific problem and redirects early |
| `boundaries` | Risk and boundaries | clear limits on risky operations and on what is delegated |
| `recovery` | Recovering from mistakes | reverts, drops a wrong direction, reframes the problem |

## Scoring

- Each ability gets a score 0–100 (multiples of 5) with a rubric of anchors written into the
  reduce prompt: 25 = basic, 50 = competent, 75 = advanced, 100 = expert, each with concrete
  behaviours. Scores between anchors are allowed.
- Every score cites verbatim quotes; the program verifies them like other evidence.
- Evidence caps, enforced by the program: above 60 needs quotes from 2 or more conversations;
  above 85 needs 3 or more conversations across 2 or more analysed periods. A score above its
  cap is lowered to the cap. An ability with no verified quote is "not assessed" (null), never 0.
- The review step checks each score against its quotes and the rubric like any other claim.
- Per project (projects with at least MIN_PROJECT_CONVERSATIONS analysed conversations): the
  same six scores from that project's quotes only, for the small radars.

## Pipeline changes

- Remove the label stage (`analysis/label.ts`, `prompts/label.md`, `LlmTraitLabels`, the
  `label` execution stage stays readable in old records). About 21 fewer calls per run.
- Trait frequency is no longer measured; rare traits are filtered by their evidence spread
  (one conversation only → dropped when at least three traits remain).
- `Profile.abilities`: `{ key, score | null, evidence, byProject }`; schema bump.
- Report: the radar draws the six abilities (unassessed spokes marked), its note explains
  ability scoring; the per-project radars use per-project scores; the card radar too.
- README cost tables and call estimates updated (no label calls).

## Acceptance

- [ ] Tests first: score caps by evidence spread, unverified quotes dropped, null for no
      evidence, per-project scores from that project's quotes only.
- [ ] `ANALYSIS_VERSION` and `Profile.schemaVersion` bumped; README and docs updated.
- [ ] A Claude and a Codex run on the same input: scores of the two engines within about 15
      points on most abilities; owner reviews the scores and their quotes.

Follow the repository TDD and verification gates.
