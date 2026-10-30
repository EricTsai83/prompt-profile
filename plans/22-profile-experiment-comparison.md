# Profile experiment comparison

Status: config, fixed-input execution, provenance, rendering, offline comparison, `--from` and
docs implemented with fake-runner tests ([usage](../docs/experiments.md)); local-history
snapshots remain

## Objective

Make it easy to answer: "Given the same prompt history, how do different engines, models and
analysis options change the profile, report and card?" Provide a repeatable local experiment
workflow with actual rendered outputs, structured differences and enough provenance to explain
what was compared. This is a developer evaluation tool, not a new default model policy.

## Existing foundation and scope

- `scripts/eval.ts` already supports one engine/model and fictional personas, runs the production
  analysis, and writes profiles and quality scores.
- `scripts/eval-compare.ts` already compares Claude/Codex across personas and repeats, with a
  shared CLI-attempt budget, input hashes and run metadata. It currently requests default models,
  writes JSON rather than a rendered comparison, and reuses output paths between invocations.
- Reuse `scripts/eval-personas.ts`, `scripts/eval-quality.ts`, production analysis, private writes,
  and production rendering. Consolidate shared behavior instead of building a second pipeline.
- Keep `pnpm eval:compare` as the main entry point. Preserve existing command usage or document
  an explicit migration. Keep real LLM execution opt-in and outside normal CI.
- The completed [collaboration foundation](../docs/collaboration-experience.md) owns profile semantics and longitudinal history; the completed plan 21 records guide report/card design.
  This tool consumes their current outputs without requiring either plan to finish. It compares
  alternate analyses of one input, which is different from a person's changes over time.

## 1. Define an explicit experiment matrix

Use a versioned JSON configuration with named variants. Engine and model form a pair: never
blindly apply Claude model names to Codex or silently substitute an engine/model after failure.
The following is proposed usage, not an existing interface:

```bash
pnpm eval:compare --config experiments/models.json --dry-run
pnpm eval:compare --config experiments/models.json --budget 40 --out eval-output/comparisons
pnpm eval:compare --from eval-output/comparisons/<experiment-id>
```

Example configuration (model IDs below are placeholders that the owner replaces):

```json
{
  "version": 1,
  "personas": ["methodical-backend", "curious-learner"],
  "repeats": 2,
  "baseline": "claude-default",
  "shared": {
    "timezone": "Asia/Taipei",
    "languages": ["en", "zh-TW"],
    "full": true,
    "look": "classic"
  },
  "variants": [
    { "id": "claude-default", "engine": "claude", "model": null },
    { "id": "claude-explicit", "engine": "claude", "model": "<claude-model-id>" },
    { "id": "codex-default", "engine": "codex", "model": null },
    { "id": "codex-explicit", "engine": "codex", "model": "<codex-model-id>" }
  ]
}
```

- [x] Validate config, unique safe IDs, baseline membership, supported options, persona names,
      positive repeats and budget before spending quota. Treat config as untrusted input; reject
      path traversal and conflicting options. Show useful English errors.
- [x] Start with engine/model comparisons. Allow explicit per-variant overrides for existing
      analysis options such as `full` and `languages`; show every changed factor. Do not invent
      temperature, seed or reasoning controls that the production runner does not expose.
- [x] Separate analysis factors from rendering factors. Render-only look/language-view comparisons
      reuse compatible saved profiles without an LLM call; a missing generated translation may
      require a separate analysis run and must never be silently synthesized by the renderer.
- [x] Explain `model: null`: the runner's CLI default, not a stable named model. Codex currently
      ignores user configuration, including its configured model. Preserve requested model and
      genuinely reported model separately; never label a requested value as independently verified.
- [x] Dry run prints expanded cases, effective options, prepared-input/chunk counts, expected
      minimum calls and the global attempt cap without sending prompts. Translation/retry costs
      must be included or explicitly described as uncertain; a budget is a cap, not a completion promise.

## 2. Hold the experiment input constant

- [x] Default to the hand-written fictional personas already in `test/eval/personas/`. Extend
      fixtures only for meaningful missing cases such as sparse or mixed evidence and bilingual input.
- [x] Prepare a persona once per experiment using a fixed clock, timezone, source selection and
      pipeline options. Reuse those prepared records across engine/model variants and repeats.
- [x] Record input hashes, selected prompt/chunk IDs, sampling coverage and preprocessing options.
      Engine/model-only comparisons must have identical prepared input and selected chunks.
      When sampling itself is the tested factor, show the resulting coverage difference explicitly.
- [ ] Support an explicit local-history mode as a second phase: collect and prepare history once,
      freeze the prepared input privately, then use that snapshot for all variants. Never repeatedly
      reread changing history during a matrix run. Do not commit personal snapshots or outputs.
- [x] Keep every repetition independent with analysis cache disabled and fresh per-case state.
      Interleave variants within each persona/repeat; record actual execution order and timestamps.
      Repeats expose stochastic variation; do not promise deterministic LLM output or a fixed seed.

## 3. Execute safely and preserve provenance

- [x] Execute sequentially by default to keep quota and rate-limit behavior understandable.
      Use existing runner isolation and retry behavior; count every underlying attempt, including
      retries and translation, against one global cap. Stop launching work when exhausted.
- [x] Detect required engines/login before execution. Record unavailable, failed, interrupted,
      budget-skipped and successful cases distinctly; preserve completed results on failure.
      Unsupported models fail visibly rather than falling back to defaults.
- [x] Create a unique experiment directory; never overwrite a previous run by default. Keep one
      case directory per persona, variant and repetition, with a manifest connecting all artifacts.
- [x] Record config and effective options, source revision/dirty state, package/CLI versions,
      pipeline/analysis/profile/render versions, input hashes, requested/reported model provenance,
      timestamps, attempt/retry counts, durations, available usage and error categories.
      Unknown usage/cost/model values remain unknown; subscription usage is not a dollar estimate.
- [x] Store `profile.json`, `quality.json` and `run.json` for each successful case. Write failure
      metadata even when no profile exists. Keep raw CLI output and personal prompt text out of
      routine terminal logs and failure summaries.
- [x] Use private atomic writes: created directories `0700`, files `0600`, no permission changes
      to pre-existing folders. Ignore generated experiment output in git. Fixture-based outputs
      also use the same safe write path so local-history mode cannot accidentally bypass it.
- [x] Define exit codes: successful execution with passing gates is zero; invalid configuration,
      required unavailable cases, execution failure, incomplete budget or failed quality gates is
      nonzero. Persist the summary before exiting and distinguish these outcomes in the manifest.

## 4. Render the actual results and build an offline comparison

- [x] Use the production renderer to generate each successful case's complete HTML report and
      PNG cards for requested supported languages. Keep all report views and real generated prose;
      a shortened mockup is not evidence of the final result.
- [x] Generate a local `index.html` with persona, variant, repetition and language selectors;
      baseline/candidate panes; visible engine/model/effective-option labels; card previews;
      and links to full reports, profiles and run metadata. Show failed/missing cases explicitly.
- [x] Show actual reports side by side on desktop and stacked on narrow screens, with independent
      scrolling and a way to open either full report. Use local relative artifacts, embedded assets
      and no server, external scripts, telemetry or network requirement.
- [x] Add a content comparison covering portrait/title, roles or dimensions, traits, evidence,
      suggestions, coverage and rubric results using fields available in the current profile schema.
      Distinguish changed wording, changed structured decisions and missing content. Preserve quote
      context; do not treat different prose length or more claims as inherently higher quality.
- [x] Escape generated content and error text, use safe paths, and preserve report CSP/privacy
      controls. Keep comparison UI copy English; reports retain their supported languages.
- [x] `--from` rebuilds renders/comparison from saved artifacts with zero LLM calls. Validate
      saved versions, use supported migrations, and report incompatible cases without overwriting
      original profiles. Record the renderer version used for each regenerated view.

## 5. Compare quality, variability and practical tradeoffs

- [x] Reuse the existing persona rubric and report exact failures, evidence retention and coverage.
      Identify heuristic checks as heuristics; passing them does not establish portrait quality.
- [x] Present per-run values and repeat ranges for durations, attempts, retries and available token
      usage. Include compact charts with labeled units/sample sizes where they clarify comparisons.
      Do not infer statistical significance from a few repetitions or rank all models from one persona.
- [x] Show within-variant structured agreement and between-variant differences separately so a
      single unusual output is not automatically attributed to model choice. Do not use raw prose
      equality as a quality metric. Require an explicit baseline rather than an implicit winner.
- [x] Include a manual review template: fidelity to evidence, specificity, contradictions, usefulness,
      language quality, report readability, card fit and preferred output with reasons. Link notes
      to exact cases. No LLM judge or additional hidden model calls in the first implementation.
- [x] Document a small starter experiment and how to expand it. Treat findings as local evidence
      for a future default-model decision; this plan does not change production model defaults.

## Implementation and acceptance

- [ ] Implement in stages: config/preparation/provenance; runner matrix and artifacts; production
      rendering/offline comparison; then local-history snapshots and manual review documentation.
      Keep reusable orchestration testable outside script entry points, without reversing module
      dependencies or making `report/` depend on evaluation/analysis internals.
- [x] Use TDD for behavior: fake runners prove model/options forwarding, fixed inputs, independent
      repeats, budget including retries, partial failures, no accidental fallback, safe paths and
      unique output preservation. Verify each new test fails before its implementation.
- [x] Test offline artifact generation with fictional profiles, including bilingual/sparse content,
      hostile text, missing cases and saved-version incompatibility. Rebuilding from saved output
      must make zero LLM calls. Avoid tests that merely mirror markup or arbitrary CSS values.
- [x] Run a bounded opt-in real comparison with at least two engine/model variants on one identical
      persona; use two repetitions to inspect variability. Record unavailable CLIs/models honestly.
      Inspect full HTML reports and PNG cards, selectors/links, narrow layout and offline loading.
      No real-history content or screenshots enter committed fixtures or documentation.
- [x] Deliver usage documentation, a fictional config example and manual review template. A user
      can run one command and open a comparison showing what the final results actually look like,
      with traceable inputs and no silent engine/model substitutions.
- [x] Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`; judge tests by exit
      code and Test Files count. Run smoke checks only when the corresponding production adapter,
      pipeline rule or CLI invocation changes. Bump production versions only if their contracts change.
- [ ] When all acceptance boxes are complete, remove this plan and its index row in the same change
      and repair incoming links. Keep durable tool documentation outside `plans/`.

## Real comparison — 2026-10-29

`experiments/starter.json` on the fictional `curious-learner` persona: Claude Code 2.1.312 and
codex-cli 0.165.0, each with its default model, two repetitions, English and Traditional Chinese.
Outcome `passed` (exit 0), 20 of 40 attempts, no retries or failures. Claude reported
`claude-opus-5-5`. Codex reported no model, and the page shows "not reported". Claude cases
took 83–86 s; Codex cases took 127–138 s with about three times the input tokens. Every report
and every en/zh-TW card rendered.

Structured decisions differed between the engines: 5 traits and 54 verified quotes for Claude,
3 traits and 43 quotes for Codex. They also differed within each engine: the closure and control
axes were unresolved in one of the two repetitions, and the improvement counts varied. No
complete role was assigned in any case. These are observations on one persona, not a ranking.

The comparison page was inspected in headless Chromium at desktop and 390 px widths:
selectors, links, embedded reports, cards and stacked layout all worked, with no horizontal
overflow, external request or console error. Output stays in ignored `eval-output/`.

