# Measured support for traits and habits

Status: Implemented (commits `960052b`–`b01f5bb`); awaiting a real run by the owner

## Problem

A trait's or habit's "support" counted the conversations behind the quotes the model chose to
cite, not how often the behaviour shows. In the owner's 2026-10-31 report every trait read
"3 quotes from 3 conversations, 3 analysed periods" and four of five traits were `high`
confidence: identical numbers carried no information.

## What was built

- A labelling pass after verification (`analysis/label.ts`, `prompts/label.md`): every
  analysed chunk is sent with the verified trait list; the program checks each label and
  counts, per trait, the distinct conversations that show it, overall and per project
  (`Trait.frequency`, `coverage.traitLabels`). One uncached call per chunk; a rate limit or a
  spent budget stops the pass and keeps the report.
- The report draws a trait radar (`report/radar.ts`): one axis per trait, 0–100% of analysed
  conversations, each trait counted on its own; small radars per project.
- Role image: the role name is checked (1–5 words, not a generic label) and informed by the
  measured axis balance; one fabricated quote no longer withholds the role; the role symbol
  falls back to the measured balance.

Linking traits to observations was rejected: observations keep only a few quotes each, so the
counts would stay near 0% and 100% could never be reached.

## Remaining

- [ ] A real run (owner's history): traits show different measured shares; compare with the
      cited-quote counts in the 2026-10-31 report.
- [ ] Decide whether confidence should follow the measured share instead of the cited spread.
- [ ] Habits (`collaboration.moves`) still count their selected episodes; decide whether to
      label them too.
- [ ] Decide whether the share card shows a small radar.

When these are done, delete this plan and its row in `plans/README.md`.
