# 15 · From activity dashboard to a profile that says who you are

Status: implemented (2026-10-24) after the owner chose the full scope and kept the rule that
shared artifacts never contain quotes. Not done: share-page visibility flags (`--share-show`);
the share page always hides project names, quotes and exact dates.

> Superseded by [plan 18](./18-unified-report-and-output-check.md): one report, with parts left
> out through `--exclude`; there is no separate share page any more.

## Diagnosis of the current report (plan 14)

The report is now a good **activity dashboard**, but most of it would look the same for any
developer, and the parts that are actually personal are hidden or text-heavy.

| Area | Problem | Evidence |
| --- | --- | --- |
| Order | Identity (traits, dimensions) comes after nine activity panels | Page order: hero, KPIs, calendar, hour, weekday, heatmap, projects ×2, language/source/habits, then traits |
| Redundancy | The same 24-hour data appears three times (hero graphic, hour bars, heatmap) and the weekday data twice; "Peak hour" is both a KPI and a chart note | `html.ts` hero graphic, `hourChart`, `weekdayChart`, `heatmap` |
| Generic numbers | KPIs are volume counts (prompts, active days, streak, peak hour) that describe usage, not a person | KPI row |
| Misleading label | "Typed / App / SDK / Scripted" reads as "how much you typed", but `origin` is the client: prompts typed in a desktop app (T3 Code, Claude desktop) count as "App / SDK" | Owner's data: 30 interactive vs 1,854 sdk, so "Typed 2%" would be wrong |
| Hidden self | Quotes in your own words, the most personal content, are behind clicks; dimension summaries are collapsed, leaving rows like "WORK STYLE · Work style" | Accordion + trait `<details>` |
| Trust | All six real traits are "high confidence", so the meter carries no information | Plan 13 item 10 |
| Projects | "Other" can dominate the project charts and hide what you worked on | Sample: Other 61% |
| Plumbing | Source split and client split matter to the tool, not to a reader | "Where you prompt" panel |

## Principles for the redesign

1. **Identity first, evidence close, telemetry last.** Who you are → why we think so (your own
   words) → when and on what you work → details.
2. **Measured, not scored.** Only deterministic, defined measurements (e.g. "median prompt 86
   characters", "41% of prompts after 22:00", "1 correction in 8 prompts") or verified LLM claims.
   No invented personality scores, percentiles or "vs other developers" without a real baseline.
3. **One chart per question.** Remove duplicates; every chart answers a question a reader has.
4. **Two audiences, two artifacts.** The private report can show quotes and projects; what you
   show others must be designed for sharing, not a stripped private report.

## Proposed private report

1. **Identity:** archetype, one-line headline, and a **signature rhythm**: a 24-hour radial clock
   with a computed chronotype label ("Mostly 22:00–02:00"). Replaces the duplicate hero bars.
2. **Signature traits:** the top three traits, each with **one verified quote visible** and the
   evidence count; the rest of the traits below. Confidence shown only once it is calibrated
   (plan 13 item 10).
3. **Measured signature:** four defined metrics that differ between people, each with a one-line
   definition on hover: night share (22:00–05:00), median prompt length, correction rate, prompts
   per session. Replaces the volume KPIs (volume moves to the calendar caption).
4. **Rhythm:** one heatmap with marginal bars (hour totals on top, weekday totals on the right)
   instead of three charts; the daily calendar stays.
5. **Chapters:** a timeline of the dominant project per period ("May–Jun drawstuff → Aug–Oct
   prompt-profile"), computed from `stats.activity`, plus the project ranking. "Other" becomes
   "N other folders" and never takes a colour that competes with named projects.
6. **Five dimensions:** each row shows its one-sentence summary without opening; quotes stay
   collapsed.
7. **Details:** language mix, client mix (relabelled "Terminal / Desktop app & SDK / Scripted"),
   habits and coverage, collapsed under one "How this was measured" section.

## Proposed sharing: a share page, not only a card

- `prompt-profile share` (or `--share`) writes `share.html` + the card: identity, signature
  rhythm, top traits **without quotes**, measured signature, chapters with project names hidden
  by default ("Project A/B/C"), no exact dates. Same languages and look as the report.
- Privacy controls as flags, previewed before saving: `--share-show projects`, rounding of
  counts, hide time-of-day. The share page is checked like the card: no quote, prompt text or
  hidden project name may appear in it (test searches the serialized file).
- The card follows the same story: archetype, chronotype line, three traits, one measured
  metric and the radial rhythm.
- **Owner decision needed:** an opt-in "in my own words" quote on the share page/card would
  break the current guarantee that shared artifacts never contain quotes. Keep the guarantee
  unless the owner explicitly chooses otherwise, and then only for a quote the owner selects.

## Order of work

1. Fix the misleading client label and the "Other" handling (small, no format change).
2. Restructure the private report (sections 1–7); new deterministic metrics in `Stats` with
   definitions (schema bump), not sent to the LLM unless a rubric shows it helps.
3. Confidence calibration in `verify` (plan 13 item 10), then show the meter again.
4. Share page and card redesign, with a privacy test like the card's.
5. Screenshot review at 360 / 768 / 1280 px, light and dark, both languages; then real data.
