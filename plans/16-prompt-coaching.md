# 16 · Prompt coaching: from "who you are" to "how to prompt better"

Status: implemented (2026-10-24); a budgeted persona run to validate the improvements is pending the owner's approval. Owner request: the report should not only describe; it should
show where the owner's prompts can improve.

## Two sources, both evidence-based

1. **Signals (deterministic).** Rules over `stats`, each with a threshold and a fixed tip, kept
   as a data array (`report/signals.ts`): corrections, very short prompts, very long sessions,
   openings reused across many sessions. Only triggered signals are shown, with their number.
   They are always correct about the number; the tip is a suggestion.
2. **Improvements (LLM, verified).** The map step also records `prompting` observations: concrete,
   recurring ways the prompts could be clearer (missing context or expected result, several asks
   in one prompt, constraints given only after a wrong answer, correction loops, boilerplate).
   The reduce step turns them into 2–4 `improvements`: title, pattern, impact, suggestion,
   evidence, and a rewrite of one of the evidence prompts (`before` = the verified quote,
   `after` = the suggested prompt, in the original language). Verification drops improvements
   without verified evidence and rewrites whose prompt is not among the verified evidence.

## Rules

- No improvement without a verified quote; the impact sentence may only describe what the
  prompts show (e.g. the follow-up corrections), never guess at time lost.
- Tone: constructive and specific; no scores or grades.
- Improvements and signals contain quotes or private patterns: **private report only**; the share
  page and card never show them.
- The rewrite is labelled as a suggestion and is not translated (it is a prompt to copy).
- Profile `schemaVersion` 6 (`improvements`, `stats.promptHabits`); older files decode with
  none. `ANALYSIS_VERSION` 9 (map and reduce prompts, LLM schemas).
- Evaluation: persona rubrics gain `minImprovements`; a budgeted persona run checks that
  improvements appear, cite verified quotes and match each persona's `expected.md`.
