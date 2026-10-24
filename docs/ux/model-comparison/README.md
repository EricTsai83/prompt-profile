# Model comparison (plan 11, stage 3)

Status: done on 2026-10-24 with synthetic personas only. One supported model per engine, two
repeats per persona: 3 personas × 2 engines × 2 repeats = 12 profile analyses.

## Setup and provenance

|                             | Claude Code                     | Codex                                               |
| --------------------------- | ------------------------------- | --------------------------------------------------- |
| CLI version                 | 2.1.309                         | codex-cli 0.164.0                                   |
| Requested model             | none (CLI default)              | none (CLI default)                                  |
| Reported model              | `claude-opus-5-5` in every call | not reported (`null`, meaning unknown, not guessed) |
| Analysis / pipeline version | 4 / 4                           | 4 / 4                                               |

- Input: the three personas in `test/eval/personas/`, processed by the real pipeline. Each
  `run.json` records the persona file hash, chunk IDs, every selected prompt ID and the sampling
  policy (full, no sampling, cache disabled). Both engines received identical input per persona.
- Budget: a hard cap of 60 CLI attempts across all runs, retries included, approved by the owner.
  **40 were used**: 4 per analysis for curious-learner (3 chunks plus reduce) and 3 for the other
  two. There were no retries or failures and no merge calls. A later check of the analysis fix
  used 6 more calls (see below), 46 in total.
- Run order: persona, then repeat, then engine, so both engines ran close together on the same
  input.
- Script: [`scripts/eval-compare.ts`](../../../scripts/eval-compare.ts) (`pnpm eval:compare`).
  Outputs: [`runs/`](runs/) (`profile.json` + `run.json` per run, [`summary.json`](runs/summary.json)).

## Deterministic rubric

All 12 profiles passed the existing persona rubrics: required concepts present, no forbidden
inference, enough traits, evidence retention of at least 80%, and at most two empty dimensions.

|                             | Claude Code            | Codex             |
| --------------------------- | ---------------------- | ----------------- |
| Rubric passed               | 6 / 6                  | 6 / 6             |
| Traits per profile          | 5–6                    | 4–5               |
| Evidence kept (dropped)     | 32–38 (1 dropped once) | 28–32 (0 dropped) |
| Dimensions without evidence | 0                      | 0                 |
| Wall time per analysis      | 38–48 s                | 51–64 s           |

The rubric does not separate the engines. It catches regressions, not quality differences.

## Blind review

[`make-blind.mjs`](make-blind.mjs) wrote one packet per persona with the four profiles under
letters in a seeded, shuffled order ([`blind/`](blind/)), and the mapping in [`key.json`](key.json).
An independent reviewer scored each profile against the persona's prompts and `expected.md`
before the key was opened: [review](review.md).

After the key was opened:

| Persona            | Ranking (engine, repeat)                    | Totals out of 30 |
| ------------------ | ------------------------------------------- | ---------------- |
| curious-learner    | Claude r2 > Claude r1 ≈ Codex r1 > Codex r2 | 28, 26, 26, 24   |
| methodical-backend | Claude r2 > Codex r2 > Claude r1 > Codex r1 | 28, 27, 26, 26   |
| night-owl-frontend | Claude r2 > Codex r2 > Claude r1 > Codex r1 | 28, 27, 27, 26   |

The reviewer's two blind groups matched the engines exactly: "Group X" was Claude in all three
personas and "Group Y" was Codex.

- **Claude Code:** more specific, vivid and actionable (mean 27.2 / 30). It made every larger
  factual overreach: "every change", "every write path", the quiz claim, and "no Friday prompts".
- **Codex:** more measured and hedged, with fewer factual errors (mean 26.0 / 30). Its headlines
  and fun facts are more generic and templated.
- **Same engine, different run:** the two runs differ in wording, quote choice and one trait,
  but tone and level of detail stay consistent. The difference between engines is larger than
  the difference between runs, but the gap in totals is small. Six profiles per engine are far
  too few to call either engine better.
- **Sensitive inference:** no profile made one.

## Defect found and fixed

Claude r1 for night-owl-frontend wrote "You never send prompts on Fridays: 0 prompts there".
The pipeline's histogram was correct (Friday 5, Saturday 0). The model read the Monday-first
`weekdayHistogram` array as if it started on Sunday, even though `reduce.md` said index 0 is
Monday. The reduce step now receives `weekdayHistogram` and `activityGrid` keyed by weekday name
(`ANALYSIS_VERSION` 5, commit "fix(analysis): label weekday stats by name"). Two follow-up Claude
runs on that persona (6 calls, gitignored `eval-output/`) both named Saturday correctly. Two runs
show the error is less likely, not that it is gone.

The committed comparison profiles were produced with analysis version 4, before the fix.

## Decisions

- Keep the engine choice an advanced option (`--engine` / `--model`, unchanged). Neither engine
  is better on both groundedness and usefulness. Claude Code stays the default for
  auto-selection, as before; this study does not justify changing it.
- Over-generalisation ("every", "always", "never") is the main grounding risk across engines.
  The next prompt change worth testing is a reduce rule against universal quantifiers unless
  every relevant prompt supports them, with a new rubric check for it. That would bump
  `ANALYSIS_VERSION` and needs another budgeted run, so it is not done here.

## Limitations

- The reviewer is a Claude model reviewing outputs where one engine is Claude. The labels were
  hidden, but a same-family stylistic preference cannot be ruled out. No human review was done.
- Synthetic personas of 29–51 prompts are much smaller than real histories, and only one model
  per engine and two repeats were run.
- Codex's model is unknown (not reported by `codex exec --json`).
- The rubric and the review measure profile text, not whether people find a profile useful.

## Follow-up: analysis version 6 (plan 13)

`reduce.md` gained two rules after this comparison: say how often instead of "always", and
describe what the prompts show rather than what the person probably did elsewhere. A
before/after run on the personas checked whether the rules help:
`pnpm eval:compare --repeats 2 --budget 70 --out docs/ux/model-comparison/runs-v6`
([outputs](runs-v6/)). 16 analyses (four personas, including the new `weekend-data-engineer`),
56 of 70 calls, no retries. All 16 passed the persona rubrics.

| Universal claims (rubric count)                  | v4 (above) | v6  |
| ------------------------------------------------ | ---------- | --- |
| Claude Code, original three personas, 6 profiles | 14         | 9   |
| Codex, original three personas, 6 profiles       | 0          | 0   |
| Claude Code, weekend-data-engineer, 2 profiles   | –          | 9   |
| Codex, weekend-data-engineer, 2 profiles         | –          | 0   |

Read individually, almost every remaining v6 universal claim is true and comes from the
statistics: "every prompt between 22:00 and 02:59", "0% correction rate, so you never had to walk
the AI back", "none of your prompts on Friday–Sunday". The count is a rough signal, not a
defect count, so the rubric records it without a threshold.

The overreaches the blind review found in the v4 Claude profiles, checked one by one in v6:

| v4 claim                                            | v6                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| "Every change starts with a plan"                   | gone                                                                      |
| "fits someone who doesn't deploy on Fridays"        | gone                                                                      |
| "a rollback test for every write path"              | gone                                                                      |
| "You never send prompts on Fridays" (wrong weekday) | gone (also fixed in v5)                                                   |
| "you skip pleasantries"                             | gone                                                                      |
| "often keep going past 2 a.m."                      | gone                                                                      |
| "static export … keep breaking your build"          | gone                                                                      |
| "covered async with tokio and smol"                 | now "tokio vs smol", which matches the prompts                            |
| "quiz answers show you understand dispatch"         | softened to "a growing intermediate grasp of dispatch" in one of two runs |
| Tailwind in the stack                               | still listed in both runs                                                 |

No second blind review was run. The evidence is the rubric, the counts and the claim-by-claim
check above, all on synthetic personas.
