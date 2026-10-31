---
name: prompt-profile-explain-reports
description: Improve prompt-profile reports so readers can understand collaboration patterns, charts, evidence and uncertainty quickly. Use for report copy, analysis writing prompts, charts, explanatory interactions and report templates; not for generic frontend styling or unrelated prose.
---

# Explain collaboration reports

Use this skill from the prompt-profile repository. Read its AGENTS.md and relevant report,
profile and analysis contracts before editing. Optimize reader understanding, not the number
of charts, animations or words. Keep existing template choices and privacy controls.

## Choose the explanation before the medium

For each section, identify the reader's question, the supported answer, the source field and
the uncertainty. Remove or subordinate sections with no useful answer. Provide a quick scan
and a connected deeper read, rather than repeating the same claim in every section.

Choose the least demanding format that conveys the answer:

- Short text for observations, qualifications and precise distinctions.
- A chart for a meaningful quantitative comparison; a diagram for a supported relationship.
- Offline HTML interactions when selection or inspection reveals useful detail. Understanding
  must not require opening every excerpt; evidence starts visible.
- Animation or narrated video only when change/process is central and actual data supports it,
  or the user asks. Offer pause/skip, captions/transcript and a static/reduced-motion equivalent.
  Do not require external narration services, API keys or video generation for normal reports.

These are choices, not a ladder where each newer medium is automatically better. A beautiful
but unexplained chart is not an explanation. Do not copy reference branding or name templates
after reference products. Preserve required licenses if actual code or assets are reused.

## Plain descriptive writing

Use ASD-STE100 as inspiration, not a certification or a mandatory aerospace dictionary.
The official reference is https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf
(section 6 covers descriptive writing). Do not reproduce its dictionary or imply compliance.

- Lead with the concrete observation. Give one main idea per sentence and one topic per
  paragraph. Prefer short active sentences and stable terms; explain unfamiliar technical names
  at first use. Aim for roughly 25 words or fewer in English descriptive sentences when useful,
  but preserve meaning and qualifiers over mechanical word limits.
- Write connected descriptions of observed collaboration in the requested narration voice (`--voice`): first or second person. Default to second person (you/your; 你/你的). Prefer specific verbs
  over abstract personality adjectives. Keep the person recognizable without hype or diagnosis.
- Distinguish a request from an action, a completed outcome and expertise. A request to test
  is not proof that tests passed. A tool event is not proof of user mastery.
- Keep frequency, confidence, scope and contrary evidence. Do not make a thin sample sound
  like a stable habit. Suggestions are optional experiments, not discovered facts.
- Preserve exact source quotes, identifiers, numbers, units and chronology. Never simplify a
  quote or add a transition that invents an episode. Distinguish interpretation from source text.
- Translate naturally into Traditional Chinese using Taiwan vocabulary. Preserve all claim
  strength and numbers. Do not apply English word counts to Chinese or make it sound like a
  maintenance procedure. Fixed bilingual UI copy belongs in src/report/messages.ts.

Example (synthetic): "You exhibit a verification-oriented disposition" becomes
"You ask for checks before accepting a change." Add the sample limit nearby when necessary:
"This appears in two conversations; other tasks may differ."

## Explain quantitative and categorical visuals

Every chart needs a readable question/title, source, units, denominator and adjacent takeaway
or interpretation aid. Compute claims from data; do not invent a distinctive conclusion.

- Tool-use session shares use sessions with tool metadata, not all sessions. Prompt technique
  shares use cleaned prompts as defined by the existing pipeline. Categories may overlap;
  say so instead of implying a partition that sums to 100%.
- Show useful coverage counts where available. Zero observed use, zero coverage and missing
  metadata are different states. Hide meaningless bars for missing denominators and explain
  what is unknown. Do not infer that missing metadata means no tools were used.
- Prefer sorted, directly labeled comparisons. Select a small useful overview and keep complete
  breakdowns accessible in detail. Do not hide contrary categories to strengthen a story.
- Preference poles are categories, never numeric strength, percentiles or psychological scores.
  Give mixed/unknown evidence a deliberate textual state, not a measured midpoint.
- Use a diagram only for a relation the data supports. Arrows must not imply causal direction,
  chronological sequence, AI replies or successful outcomes that the profile does not contain.
- Provide text equivalents and redundant labels, keyboard focus and adequate contrast. Check
  narrow mobile, both languages, dark/light and print. No essential hover-only explanation.

## Apply without changing evidence or privacy

Renderer changes may select and arrange existing profile content but must not silently rewrite
stored generated prose or require another analysis call. Improve future generated descriptions
through analysis prompts; bump ANALYSIS_VERSION when changing them. Existing profiles retain
their wording until explicitly reanalyzed. Keep Profile version unchanged unless its format changes.

Project visibility is user-controlled for BOTH report and card: normal mode may show names;
--exclude projects (also in --exclude personal) anonymizes known names in generated text too.
Preserve the other existing exclusions, source Profile immutability, escaping, CSP, offline
assets and private atomic writes. Cards contain no prompt quotes. Keep their text within the
fixed export bounds without shortening the full report.

## Prove the improvement

Use synthetic data and behavior-first tests; establish red before production fixes. Test
source/denominator calculations, missing versus zero, quote integrity, exclusions, independent
view/language controls and legacy fallbacks. Prompt literal matches alone do not prove writing
quality: record a concrete before/after example and remaining uncertainty; never fabricate an
LLM evaluation or reader-study result. Run repository-required checks and inspect real rendered
full pages/cards, including below the fold. Record which changes work via render and which
apply only to future analysis. Do not claim aesthetic acceptance from passing tests.
