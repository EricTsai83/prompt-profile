# Optional collaboration experiments

The coaching section offers one primary suggestion. Other suggestions are collapsed beneath
it. New analyses can attach `experiment.when` and `experiment.observe` to an existing
improvement; its `suggestion` is the single action and its verified `evidence` supplies the
observed basis. Zero suggestions is a valid result. Existing profiles keep their prose and
legacy improvements; render does not invent missing experiment fields.

The pattern and reported cost describe the source history. The suggested action and next
observation are proposals, not demonstrated effects. Later correction rates never establish
that an experiment worked. Clear short follow-ups, bilingual text and contextual differences
are not shortcomings by themselves. The existing analysis/review calls check this contract;
there is no additional default model call. Quote matching verifies authenticity, not semantic
truth; generation and review can still make mistakes.

Original quotes and rewrites retain their source language. Translations include the generated
experiment context and observation. Suggested wording is inert text in a labelled read-only
text area: Tab to it, then Ctrl/Cmd+A and Ctrl/Cmd+C. This native offline fallback needs no
clipboard API or script permission. The report's CSP continues to prohibit scripts. Print
uses a wrapping text paragraph instead of the scrollable text area. `--exclude coaching`
removes the section; `--exclude quotes` removes both original and proposed prompt wording.
Cards contain neither prompt quotes nor experiments. Sharing uses the same renderer/exclusions.

## Scope

Experiments are optional suggestions in the report. There is no selection command, feedback
form, result tracking or experiment-notes store. Readers decide whether to use a suggestion;
the application does not ask them to record an outcome or infer one from later reports.

## Delivery evidence and limits

Plan 27 extends the existing improvements contract (profile schema 17, analysis version 22).
The report regressions were first run red, then green. Synthetic tests cover
missing/removed evidence, incomplete contracts, empty suggestions, bilingual rendering,
escaping proposed HTML, exclusions and legacy improvements.
Existing fictional calibration cases cover sparse, clear, contradictory and short contextual
histories; these are authored checks, not a new real-model evaluation or reader study.

A local Chrome check inspected the coaching section at 390px and 1280px, confirmed native
keyboard selection and print visibility. The generated sample is fictional. Browser captures
are local under `tmp/plan27/`; they are not source fixtures. No actual productivity outcome or
human comprehension result was measured. Broader visual polish and owner feedback remain
possible without changing this contract.

## Owner scope decision — 2026-10-31

The product delivers a useful HTML report from the available history. The report can explain
an observed collaboration pattern, suggest an action or instruction, and show how a prompt
could be rewritten, with evidence and uncertainty where available. Readers do not need to
accept or reject the suggestions inside the product.

Plan 28's separate reviewed-preference export workflow was removed by owner decision.
Do not require a review file, selection, approval, export or agent configuration installation
to obtain value from these suggestions. Existing report improvements and suggested rewrites
already provide the intended surface; this decision adds no new analysis or report fields.
Suggestions remain proposals, not established user preferences or demonstrated improvements.
