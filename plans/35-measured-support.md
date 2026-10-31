# Measured support for traits and habits

Status: Planned; owner requested on 2026-11-01

## Problem

A trait's or habit's "support" counts the conversations behind the quotes the model chose to
cite, not how often the behaviour shows. The model cites about three quotes per item, so in
the owner's 2026-10-31 report every trait read "3 quotes from 3 conversations, 3 analysed
periods", four of five traits were `high` confidence, and three of four habits had the same
"3 conversations, 3 periods". Identical numbers carry no information, and `high` confidence
mostly means "the model cited three quotes". Habits (`collaboration.moves`) are bounded
further: they can only cite the episodes that were selected for the report (at most 8).

The axis scale already fixed the same artefact for the four axes (commit `a0a8ec1`): the map step labels prompts and the program counts them per conversation.

## Outcome

Each trait and habit shows how many analysed conversations show it, counted by the program
from verified labels across the analysed sample, separately from the quotes picked to
illustrate it. Confidence follows that measured spread. Items with the same number of quotes
no longer look equally common.

## Recommended approach

Traits and habits are only named in the reduce step, so the map step cannot label prompts
against them. Instead:

1. Give every input observation a stable id in the reduce input (observations already carry
   verified evidence from many chunks; keep each observation's full, uncapped prompt ids for
   counting, as `retainOmittedEvidence` already keeps omitted evidence).
2. Ask reduce to return, for each trait and habit, the ids of every observation that supports
   it (`observationIds`), in addition to the quotes it cites.
3. The program unions the verified prompt ids of those observations and counts distinct
   conversations and analysed periods. Unknown ids are rejected and counted. Habits use the
   same count instead of the selected episodes only.
4. The report shows "seen in N of M analysed conversations" next to the cited quotes; the
   confidence rule uses the measured count.

Alternative considered: one extra labelling call per chunk after reduce, against the final
trait list. More accurate, but it multiplies calls (22+ more per run); keep it as a fallback
if the observation links prove too coarse.

## Acceptance

- [ ] Tests first: counting from observation links, rejected unknown ids, distinct
      conversations, and a report that shows different counts for differently common traits.
- [ ] `ANALYSIS_VERSION` and `Profile.schemaVersion` bumped; released profiles still render
      with their stored support.
- [ ] A real run (owner's history) shows traits with different measured counts; compare with
      the cited-quote counts in the 2026-10-31 report.
- [ ] Both report languages state that the count is of analysed conversations (a sample),
      not the whole history.

Follow the repository TDD and verification gates.
