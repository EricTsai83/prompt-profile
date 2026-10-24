# Blind review (written before the key was opened)

Reviewer: an independent Claude Code subagent with a fresh context. It read only `blind/*.md`
and each persona's `prompts.json` and `expected.md`, and was told not to open `key.json`,
`runs/` or the scripts. The reviewer comes from the same model family as one of the two
engines; see the limitations in [README.md](README.md). Reproduced from its report, lightly
formatted.

Scores 1–5: Spec = specificity, Fact = factual support, Use = usefulness, Contra = contradictions
(5 = none), Sens = sensitive inference (5 = none), Calib = calibrated language.

## curious-learner

|     | Spec | Fact | Use | Contra | Sens | Calib | Total |
| --- | ---- | ---- | --- | ------ | ---- | ----- | ----- |
| A   | 5    | 4    | 5   | 5      | 5    | 4     | 28    |
| B   | 5    | 3    | 4   | 5      | 5    | 4     | 26    |
| C   | 4    | 4    | 3   | 5      | 5    | 3     | 24    |
| D   | 4    | 5    | 3   | 5      | 5    | 4     | 26    |

Ranking A > B ≈ D > C. A covers nearly everything in `expected.md` (the "don't write it" tutoring,
why-questions, quizzes and notes, the topic progression, lowercase enthusiasm) and correctly says
there are no midnight sessions. B is as specific but overclaims once. D is accurate but bland and
misses the enthusiasm. C labels all four traits high, one of them on a single example.
`expected.md` says "late nights", but the latest local prompt is around 21:10; none of the profiles
claimed late nights.

## methodical-backend

|     | Spec | Fact | Use | Contra | Sens | Calib | Total |
| --- | ---- | ---- | --- | ------ | ---- | ----- | ----- |
| A   | 4    | 5    | 3   | 5      | 5    | 4     | 26    |
| B   | 5    | 3    | 5   | 5      | 5    | 3     | 26    |
| C   | 5    | 4    | 5   | 5      | 5    | 4     | 28    |
| D   | 4    | 5    | 3   | 5      | 5    | 5     | 27    |

Ranking C > D > B > A. C names the office-hours pattern with no weekends (checked: 26 of 36
prompts at 09:00 or 10:00) and the move to team process, and gives an actionable next step. B has
the same depth but generalises "always plan first" too far. A and D are almost identical:
accurate and calibrated, but more generic.

## night-owl-frontend

|     | Spec | Fact | Use | Contra | Sens | Calib | Total |
| --- | ---- | ---- | --- | ------ | ---- | ----- | ----- |
| A   | 5    | 4    | 5   | 5      | 5    | 4     | 28    |
| B   | 3    | 5    | 3   | 5      | 5    | 5     | 26    |
| C   | 4    | 5    | 4   | 5      | 5    | 4     | 27    |
| D   | 5    | 3    | 5   | 5      | 5    | 4     | 27    |

Ranking A > C > D > B. A captures the late-night pattern, blunt 不對 corrections that name the
real cause, accessibility, performance and the deferred Next.js fixes, with mild overstatement.
C is accurate and gives a good next step but is less vivid. D is as rich as A but has a hard
factual error and a mismatched quote. B is accurate but generic.

## Concrete errors and unsupported claims

| Persona            | Profile | Claim                                                                | Problem                                                    |
| ------------------ | ------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| curious-learner    | B       | "Your quiz answers show you understand static vs dynamic dispatch"   | The next prompt asks "what did I get wrong?"               |
| curious-learner    | A, B    | "covered / worked through async with tokio and smol"                 | The persona only asked about trade-offs                    |
| curious-learner    | C       | "Compilation is a milestone", rated high                             | One supporting prompt; the other two quotes do not show it |
| methodical-backend | B       | "Every change starts with a plan … only then lets the AI write code" | Several sessions start directly with a task                |
| methodical-backend | B       | "fits someone who doesn't deploy on Fridays"                         | No prompt is about deploy days                             |
| methodical-backend | C       | "a rollback test for every write path"                               | There is one rollback test                                 |
| methodical-backend | B, C    | Alerting-threshold quote used for explain-before-change              | It asks for a rationale, not a check before a change       |
| night-owl-frontend | D       | "You never send prompts on Fridays: 0 prompts there"                 | False: five prompts on Friday 01:30 local time             |
| night-owl-frontend | D       | Fix-it quote filed under "Pragmatic bail-out"                        | That prompt is the proper fix, not a fallback              |
| night-owl-frontend | D       | "you skip pleasantries"                                              | The persona writes 可以了，謝謝 (thanks)                   |
| night-owl-frontend | A       | "often keep going past 2 a.m."                                       | Sessions are short and start at different times            |
| night-owl-frontend | A       | Next.js static export "keep breaking your build"                     | It happened once                                           |
| night-owl-frontend | A, D    | Tailwind listed in the stack                                         | Only one passing style comparison                          |

No profile makes a sensitive inference. "Perfectionist" is the strongest personality label used.

## Variation observation

The reviewer judged the differences systematic. In each persona the profiles formed two pairs
with near-identical headlines and archetypes:

| Persona            | Group X | Group Y |
| ------------------ | ------- | ------- |
| curious-learner    | A, B    | C, D    |
| methodical-backend | B, C    | A, D    |
| night-owl-frontend | A, D    | B, C    |

Group X is vivid, persona-specific and actionable, with playful fun facts from the statistics. It
made all the larger factual overreaches. Group Y is measured and hedged, makes fewer errors, and
is more generic, with templated headlines and flat fun facts. Within a pair, the differences
(wording, which quotes were picked, one extra trait) look like ordinary run-to-run variation.
