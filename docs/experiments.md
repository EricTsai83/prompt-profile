# Profile experiments

`pnpm eval:compare` answers: given the same prompt history, how do different engines, models and
analysis options change the profile, the report and the card? It is a developer evaluation tool.
It does not change any production default.

Each experiment runs the production analysis on hand-written fictional personas
(`test/eval/personas/`). It then renders every result with the production renderer and writes
an offline comparison page.

## Quick start

```bash
# 1. See what would run and how many CLI calls it needs. Sends nothing.
pnpm eval:compare --config experiments/starter.json --dry-run

# 2. Run it. Uses your Claude Code / Codex subscription quota, capped at --budget attempts.
pnpm eval:compare --config experiments/starter.json --budget 40

# 3. Open the page it prints: eval-output/comparisons/<experiment-id>/index.html

# 4. Re-render from saved results (new renderer, other looks). Zero LLM calls.
pnpm eval:compare --from eval-output/comparisons/<experiment-id> --looks classic,prism
```

The starter compares the Claude Code and Codex defaults on one persona, with two repetitions and
English plus Traditional Chinese: 4 cases, at least 20 calls.

## Configuration

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
    "looks": ["classic", "prism"]
  },
  "variants": [
    { "id": "claude-default", "engine": "claude", "model": null },
    { "id": "claude-explicit", "engine": "claude", "model": "<claude-model-id>" },
    { "id": "codex-default", "engine": "codex", "model": null },
    { "id": "codex-sampled", "engine": "codex", "model": null, "full": false }
  ]
}
```

- `engine` and `model` form a pair. A model is passed only to its own engine. If a model is
  unsupported, the case fails; the tool never substitutes the default.
- `model: null` means the CLI's own default. That is not a stable named model. Codex runs with
  `--ignore-user-config`, so it ignores your configured Codex model too. Codex never reports
  which model it used: when you request one, the page shows it as _echoed (unverified)_.
  Claude Code reports its model, and the page shows that reported name.
- Variants may override `full` and `languages`. The page lists every factor that differs from
  the baseline. Temperature, seed and reasoning settings are not offered because the production
  runners do not expose them.
- `timezone` (optional) applies to every persona. If you leave it out, each persona uses its own
  time zone.
- `looks` (or a single `look`) is a render-only factor. Every successful case is drawn once per
  look, with no extra LLM calls. A language must be requested at analysis time: the renderer
  never makes up a missing translation.
- The file is validated before any quota is spent. The tool rejects unknown keys, unsafe or
  duplicate ids, a baseline that is not a variant, unknown personas, looks or languages,
  conflicting options, and model ids that could be read as CLI flags.

The legacy flags still work: `--engines claude,codex --repeats 2` runs every persona with each
CLI's default model. They cannot be combined with `--config`. **Migration:** output now goes to
a new `eval-output/comparisons/<id>/` folder (or `--out <dir>/<id>/`). The old
`docs/ux/model-comparison/runs/` layout is no longer written.

## How a run works

- **Fixed input.** Each persona is prepared once, with a fixed clock. All variants and
  repetitions get exactly the same cleaned prompts. The manifest records the persona file hash,
  a hash of the prepared prompts, and the chunk and prompt ids each case analysed. If `full`
  differs between variants, the coverage difference is shown.
- **Independent repetitions.** The analysis cache is never read. Every case gets a fresh
  runner. Execution order interleaves the variants: persona, then repetition, then variant.
  Timestamps are recorded. Repetitions show variation; LLM output is not deterministic.
- **One budget.** `--budget` (default 60) caps every CLI attempt, including retries, merges and
  translations. A case that cannot fit its minimum calls is `budget-skipped`. A case that hits
  the cap mid-run is `budget-exhausted` (even when the analysis carried on without a
  translation), and no new work starts after that. The cap stops work;
  it does not promise completion.
- **Sequential.** Cases run one after another. Within a case, the analysis uses its normal
  concurrency. Engines are detected (installed, logged in) before anything runs. An unusable
  engine's cases are marked `unavailable`.
- **Interruptions.** On Ctrl-C, the running case and every unstarted case are recorded as
  `interrupted`, and the manifest is saved.
- **Never overwrites.** Each run creates a new folder. Folders are created `0700` and files
  `0600`, written atomically. Generated output is ignored by git. Terminal output and failure
  records hold error categories only, never CLI output or prompt text.

## Output

```
eval-output/comparisons/<experiment-id>/
  manifest.json     config, provenance, every case, every render
  index.html        offline comparison page
  review.md         manual review template (never overwritten by --from)
  cases/<persona>/<variant>/r<n>/
    run.json        status, options, input hashes, attempts, usage, model provenance
    profile.json    the analysed profile (successful cases)
    quality.json    persona rubric result
    render/<look>/  report.html and card.png / card.<lang>.png from the production renderer
```

The manifest records:

- the source revision and whether the working tree was dirty
- the package, Node and CLI versions, and login state
- the pipeline, analysis, profile, render-manifest and look versions
- for each case: the requested, reported and echoed model; attempts and failed attempts; error
  categories; durations; and token usage

Usage the CLI did not report stays `null` (unknown). Subscription usage is never converted
into a dollar estimate.

`--from` validates the saved manifest first: an unknown look, or a case whose ids or folder do
not match, stops it before anything is read or written.

`index.html` needs no server and makes no network requests:

- **Selectors:** persona, repetition, candidate variant, language and look.
- **Two panes:** the baseline and the candidate, side by side on wide screens and stacked on
  narrow ones. Each pane has its labels, card, links to the full report, profile and run
  metadata, and the embedded report.
- **Failed or missing cases** are shown, not hidden.
- **Content comparison:** split into structured decisions (role, axis poles, counts, verified
  quotes), wording, and missing content.
- **Per-variant ranges** of duration, attempts and tokens, plus _within-variant agreement_:
  how often each decision repeated. This is shown separately from differences between variants.

## Exit codes

| Code | Outcome                                                                        |
| ---- | ------------------------------------------------------------------------------ |
| 0    | Every case succeeded and passed its rubric (or `--dry-run` / a clean `--from`) |
| 1    | Unexpected error, or `--from` could not render some case                       |
| 2    | Invalid configuration or command-line usage; nothing ran                       |
| 3    | A required engine is unavailable                                               |
| 4    | A case failed or the run was interrupted                                       |
| 5    | Incomplete: some cases were skipped or stopped by the budget                   |
| 6    | Every case ran, but a persona rubric failed                                    |

When several apply, the lowest of codes 3–6 wins. The manifest stores the outcome before exit.

## Reading results

- The rubric is a set of deterministic heuristics: required concepts, forbidden inferences,
  evidence retention and empty dimensions. Passing it does not establish portrait quality.
- Longer prose or more claims is not better. Equal wording is not a quality metric. The tool
  shows differences against an explicit baseline and never picks a winner.
- A few repetitions on one persona show variation, not statistical significance. Do not rank
  models on that basis.
- Use `review.md` for the judgement: fidelity to evidence, specificity, contradictions,
  usefulness, language quality, report readability, card fit and preferred output, each with
  reasons and case ids. There is no LLM judge.

To expand an experiment, add personas or repetitions first. That separates model effects from
one unusual output. Add explicit-model variants one at a time, and treat the findings as local
evidence for a future default-model decision.

## Not yet available

A frozen snapshot of your own local history, as an experiment input, is planned (plan 22,
§2). Until then, experiments use only the fictional personas.
