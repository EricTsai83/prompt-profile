# Content contract and reading outline

Status: reusable research, not a schema change. Copy in the three prototypes is fictional;
quotes are verbatim from `test/fixtures/portrait.sample.json`. The proposed role title is a
writing study, not an approved classification. All directions use identical text and source IDs.

## Three reading speeds

- First screen, about five seconds: a collaborator who invites route suggestions while retaining
  direction decisions. Character recognition is tested with a labeled slot, not promised art.
- Visual scan, about thirty seconds: three supported requests, a categorical decision pattern,
  and the unresolved control preference. No intensity, rank or comparison is implied.
- Deep read, about three minutes: see the actual requests, their limits and contrary evidence;
  distinguish asking for verification from proof of successful work.

## Candidate matrix

Lengths are editorial budgets, not truncation rules. Exclusions refer to existing renderer
visibility policies; prototype controls do not implement production privacy settings.
The supported report exclusions are exactly `quotes`, `projects`, `dates`, `coaching`,
`funfacts`, and `custom-names` (`personal` expands to all six). There is no report-level
portrait, role, stats, tools/skills, metadata or previous-profile exclusion. `--card-hide`
accepts `traits/stats/graphic` for the PNG card only; it does not hide report sections.

In the matrix, **P** means applying the existing project-name scrubber to all displayed
generated text (including translated identity, portrait, signature and diagram labels), and
to displayed excerpts. Known project names become localized Project A/B labels; summaries
remain. This is the existing name substitution, not general entity redaction: short project names are included when project names are excluded, in both report and card. **D** means replacing displayed exact date/range
metadata with month precision, removing the daily calendar and exact skill-use ranges, while
retaining aggregate counts. It does not invent dates for evidence or promise to scrub arbitrary
dates inside prose. These policies must be carried into each new presentation surface.

| Block / reader question                     | Source field                                       | Takeaway                              | View / position             | Length                                      | Fallback                                                                   | Exclusion                                                                                                               |
| ------------------------------------------- | -------------------------------------------------- | ------------------------------------- | --------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Identity: who is this?                      | archetype + portrait.introduction                  | A specific collaboration introduction | Overview hero               | title 3–8 words, line 25 words              | headline if supported, otherwise neutral “Collaboration snapshot”          | P; retain introduction when `quotes` is excluded (only excerpts disappear)                                              |
| Character: what should I recognize?         | Proposed plan 20 D role asset reference            | Symbolic introduction                 | Hero secondary              | one asset + short label                     | Explicit placeholder in study; neutral symbol in future                    | No existing role hide option; P for label; no inferred physical likeness                                                |
| Signatures: what do they do?                | portrait.chapters + evidence, traits with evidence | 2–3 concrete requests                 | Overview after hero         | 12–25 words each                            | fewer items; no evidence means no signature claim                          | P; retain supported summaries with `quotes` excluded; omit source excerpts                                              |
| Decision pattern: where is agency?          | portrait.axes explanation and quotes               | Direction vs implementation choices   | Overview middle             | 3 categorical labels + caveat               | Unresolved narrative; no axis bars                                         | P; retain categorical synthesis with `quotes` excluded; no new portrait option                                          |
| Mixed / sparse evidence: what is uncertain? | axes.pole, evidence, counterEvidence               | Evidence has boundaries               | Overview before detail link | 40–65 words                                 | All four unclear: “No stable preference established”; no four empty gauges | P; keep mixed/limited-evidence caveats even when `quotes` is excluded                                                   |
| Activity / tools: what is relevant?         | stats, engine metadata                             | Context only                          | Supporting footer or detail | one selected signal with unit               | Missing tool metadata: omit; no expertise claim                            | P + D; `custom-names` hides private inventory names/descriptions, not aggregate tool counts                             |
| Counts / sampling: what is covered?         | coverage, stats                                    | Scope, not achievement                | Supporting methodology      | 2–4 facts                                   | “Coverage unavailable”; show partial analysis when known                   | Counts remain (no report stats exclusion); D for dates; retain material uncertainty                                     |
| Introduction: how does this fit?            | portrait.introduction                              | Connected portrait                    | Detail opening              | 60–100 words                                | legacy dimensions, explicitly limited                                      | P; introduction remains when `quotes` is excluded                                                                       |
| Interaction: what happened?                 | chapters and evidence                              | Choice / boundary / verification      | Detail body                 | 3 sections, 60–100 words each               | Existing undated excerpts in fixture order; no invented turns              | P; retain narrative with `quotes` excluded, remove excerpt blocks and their source labels                               |
| Evidence: why believe it?                   | evidence.promptId / quote                          | Request in its own words              | Detail, open by default     | original <=200 characters per quote         | Explicit “No verified excerpt”                                             | `quotes` removes supporting/contrary excerpts and associated source labels; P when shown                                |
| Exceptions: what complicates it?            | axes.counterEvidence                               | Different decisions can coexist       | Detail separate section     | 60–90 words                                 | “No contrary excerpt supplied” is not universal agreement                  | P; `quotes` removes contrary excerpts, not the narrative uncertainty or caveat                                          |
| Recurrence / chronology: is this repeated?  | traits.support; proposed dated episodes            | Scope of recurrence only              | Detail context              | sessions/weeks if available                 | No dates in Evidence: no timeline, trends or duration                      | Counts remain; D for date metadata; plan 20 B/C provenance and its privacy contract pending                             |
| Skills / tools: used for what?              | stats.techniques, dimensions.tech_profile          | Observed use, not mastery             | Detail secondary            | selected purpose links + optional inventory | “No verified tool-to-purpose link”; omit inventory if absent               | P + D; `custom-names` removes private skill/agent/server names/descriptions; retain public entries and aggregate counts |
| Next experiment: what could help?           | improvements with evidence                         | Optional actionable next step         | Detail end                  | one 30–60 word experiment                   | omit rather than generic coaching                                          | `coaching` removes experiments, suggestions, rewrites and their evidence; P otherwise                                   |
| History: what changed?                      | previous; proposed plan 20 history                 | Future comparison                     | Reserved integration only   | no prototype navigation                     | No history UI until contract exists                                        | Existing `previous` summary uses P + D; `coaching` removes prior suggestions; archive privacy contract pending plan 20  |
| Engine / generation: how made?              | engine, generatedAt                                | Provenance                            | Footer/methodology          | short definition list                       | “Not available”                                                            | D for generatedAt; engine/model remain (no metadata exclusion)                                                          |

## Two-view outline and sample-copy decisions

Overview: role wording → one-line portrait → three supported behaviors → categorical decision
pattern → mixed-evidence caveat → evidence link. A large activity clock is removed: it answers
when prompts happened, not who makes which decisions. No overview chart earns a default slot in
this fictional portrait: there is no distinctive statistical claim needed to understand it.

Detail: connected introduction → planning checkpoint → delegated implementation → verification
request from a separate task → contrary control evidence → missing skills context → optional
experiment. The full realistic copy is shared verbatim by `poster.html`, `route.html`, and
`index.html`. The last experiment is explicitly product-authored, not a discovered habit.

Quotes retain original English. Context names a fictional interface task and source ID; IDs
provide traceability, not dates. Fixture array order is presentation order only. The same quote
is not duplicated in full: the contrary section references its earlier full excerpt. Repetition
across axes must be consolidated without losing owner associations in future renderer work.

## Available now versus plan 20 dependencies

Available: introduction, chapters, verified quotes, categorical axes and counterevidence,
traits/support, stats/coverage, independent view/language switches in the current renderer.
Presentation may shorten/select existing text but must not manufacture stronger claims.

Plan 20 B/C: episode membership, timestamps, turning points and cross-session recurrence
provenance; no chronology from prompt IDs. Plan 20 E: calibrated role semantics and richer
narrative; title “The boundary setter” remains proposed copy. Plan 20 D owns all character
assets/mapping: the same arrow placeholder is a layout slot, not a parallel avatar catalog.

Sparse contract: with no portrait, show the supported legacy headline and selected evidenced
traits; without either, show a neutral snapshot and coverage. With all axes unclear, retain
behaviors and a single uncertainty paragraph. With `--exclude personal`, retain identity, supported portrait/signature summaries, aggregate
coverage and uncertainty; apply P + D, remove all excerpts, coaching and fun facts, and hide
private custom inventory names/descriptions while retaining public entries and aggregate counts.
`funfacts` removes the fun-fact block independently wherever it appears; it does not hide traits.
A neutral title is for missing supported identity, not an effect of the current exclusions. Do not
fill whitespace with fabricated skills. These are implementation requirements for phase 4/5,
not claims that the phase 3 mockups implement every exclusion combination.

## Proposed visibility capabilities (not implemented or selected)

Hiding the entire portrait/role, all report statistics, all tool inventories, engine metadata,
or a future archive entry would require a new product decision and contract. None is implied
by `--exclude personal` or `--card-hide`, and phase 4/5 must not add those options silently.
If later adopted, define how dependent signatures/diagrams and fallback copy behave before
implementation. This study's sparse-content layout is a missing-data fallback, not evidence
that these extra switches exist.
