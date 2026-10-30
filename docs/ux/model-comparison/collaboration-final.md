# Final collaboration workflow acceptance

Run on 2026-10-31 (Asia/Taipei), with fictional input only. This is bounded product
acceptance, not scientific validation, a reader study or proof of semantic correctness.

## Configuration and provenance

- Config: `experiments/plan20-final.json`.
- Ignored artifacts: `eval-output/comparisons/20261030-165329-1852/`.
- One contextual collaborator persona: 16 prompts, eight sessions, full analysis,
  English and Traditional Chinese, one repetition per engine, default model and effort.
- Profile schema 16, analysis 21, pipeline 4; render manifest 3, classic 14 / other looks 20.
- Claude Code CLI 2.1.314 and Codex CLI 0.166.0 were installed and logged in.
- Hard cap: 12 CLI attempts. Actual: eight attempts, four per engine; zero failed attempts,
  zero retries. Each case used map, draft, source review and translation. No image calls.

| Variant        | Reported model                 | Outline retained | Recurring moves | Complete role | Automated rubric |
| -------------- | ------------------------------ | ---------------- | --------------- | ------------- | ---------------- |
| Claude default | `claude-opus-5-5`              | Yes              | 2               | Withheld      | Passed           |
| Codex default  | Unknown; CLI did not report it | Yes              | 2               | Withheld      | Passed           |

Codex model identity remains null, including stage provenance. It is not inferred from this
agent, a CLI default or a model name requested elsewhere. Such reports cannot establish
model-matched longitudinal comparability. Automated rubric success is separate from the
manual findings below; its generalisation heuristic flagged one Claude string and zero Codex
strings, which does not measure semantic truth.

## Manual source review

Both cases retain both characteristic approaches on all four axes. Pacing and decision
ownership remain distinct: the API case delegates implementation with stepwise delivery,
while migration keeps exact design choices with whole-task delivery; the prototypes invert
those combinations. Each side has two independent sessions. Neither output forces a role
onto these contextual differences; default artwork is neutral.

Both extract a constrain/check sequence for backend tasks and an explore/refine sequence for
prototypes, tied to the same four two-turn episodes. Episode endings are unknown. Neither
case claims a measured benefit, cost, test pass or completed rollback. Both produce zero
improvement suggestions. Verification signals are explicitly requests; they do not establish
assistant execution or user expertise.

The Claude portrait opens with task context, follows the API and migration episodes, contrasts
prototype review, then explains that pacing and ownership vary separately. The API paragraph
explicitly says only requests are known. The Codex portrait similarly contrasts three concrete
contexts and ends with interface details left open for review. Both outlines survive reference,
quote and prose-alignment verification; their openings, chapter focus, nuance and closing
remain anchored to source evidence. Translations preserve chapter order, contextual sides,
null effects and unknown outcomes; source quotations stay unchanged.

Remaining semantic limits:

- Claude compresses the prototype move as “adjust or choose in the next turn”. The sources
  do contain a requested margin change and a flat-list choice, but the later refinement remains
  planned, not a demonstrated result. Its pattern wording can make that boundary less explicit
  than the main chapters. Structural verification alone cannot distinguish every tense/scope shift.
- Codex labels implementation delegation within a contract as a tool-boundary signal. This is
  defensible as an instruction boundary, but it does not demonstrate knowledge of a tool's
  capabilities. The UI keeps it as requested practice rather than an expertise grade.
- Natural language move names differ between engines, as expected for generated summaries.
  Both identify the same underlying episodes; exact names are not treated as stable identifiers.
- These two final cases are not a repeatability experiment. The preceding
  [six-case foundation run](collaboration-foundation.md) and
  [earlier repetitions](collaboration-roles.md) provide bounded repeatability evidence for the
  structured foundation. They do not establish repeatability for every new narrative sentence.

Owner feedback established the art direction: reduce human form, then continue with the
abstract geometric studies. No external comprehension study was conducted. The owner-facing
stages, concrete prose, expanded sources and categorical labels support inspection; they do
not prove that every reader interprets the report correctly.

## Workflow and artifact checks

Fictional renderer acceptance covers all seven looks and both languages, with 1280/390-pixel
pages in light/dark schemes and 20 exported cards. Ten cases include opt-out, hidden graphics,
long names and exclusions. Forty language/viewport combinations have no horizontal overflow.
Cards and page compositions were visually inspected. A stretched-symbol defect in document
cards was corrected and protected by a behavior test. Quotes remain absent from cards.

Library tests cover concurrent publication, interruption/index repair, retained legacy files,
private permissions, symlink/path rejection and render variants without analysis calls. Narrative
and historical fixtures cover evidence removal, invalid references, incomplete and overlapping
windows, reverse chronology, version/model mismatches and optional supported differences.
Re-rendering does not call an LLM or change source analysis. Model output review remains a
risk-reduction step, not a semantic certificate.

Usage and owner amendments are recorded in the [collaboration guide](../../collaboration-experience.md).
Final required checks include typecheck, lint, formatting, the full test suite, an installed npm
package and a native macOS ARM64 standalone binary, including embedded prompts/fonts/PNG output.
No release, commit, upload or publication is implied by this acceptance run.
