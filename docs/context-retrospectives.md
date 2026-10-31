# Project retrospectives

Select one project with `prompt-profile --project label:my-app --since 1m`.
A label is the exact final directory name in source metadata, not a filesystem path.
If multiple paths have that label, use `--project path:/absolute/project/path`.
Paths are matched exactly; renamed paths are separate contexts. No repository is inspected.
Missing metadata is excluded and counted, never inferred from another prompt in the session.
Time filtering uses the existing inclusive `--since` window ending at the run time.

The existing analysis budget, evidence verification and renderer apply to selected records.
Read observations within this context first. Task labels are interpretations of prompt evidence;
this release does not classify debugging, design or learning automatically. Sparse evidence
cannot establish a stable preference. Different task mixes or source coverage do not prove growth.

Selection coverage counts source records in the time window before cleaning. The existing
pipeline still counts unusable records. Short acknowledgements are retained only after a
substantive prompt in the same source/session in project mode; they are context, not intent
or evidence of completion. Sessions crossing project boundaries are split by explicit record
metadata; missing metadata is never inherited. Existing adapter deduplication still applies.

The report stores a SHA-256 identity of the exact matched path, never the raw selector or
excluded project names. This identity is also part of analysis cache keys. It is a local
comparability identifier, not an anonymization guarantee. Project names in selected prompts
still pass through normal redaction and report exclusions. Renaming a directory creates a
new scope; aliases are not inferred. Offline rendering works with stored selection coverage;
legacy profiles omit it. Repeated reviews use the existing history policy, including overlap,
window length, source coverage, model and analysis version checks, plus matching scope.
An unscoped legacy report cannot establish a comparable baseline for a scoped report.

Account usage and session-level tool events cannot reliably be attributed to records in a
selected project, especially when a session crosses contexts. Scoped reports omit account
usage and do not import those events. No extra LLM calls or separate analysis engine are added.
Task category inference is deliberately deferred until authored cases support reliable labels.

## Verification record (2026-10-31)

Behavioral regressions were demonstrated before implementation: project selection initially
failed to load its missing module; contextual acknowledgement retention then failed with the
acknowledgement absent. The final typecheck, lint, format check and full test run all exited 0
(88 test files, 810 tests). Local data smoke checks exited 0 (4 files, 4 tests), without printing
prompt content or invoking an LLM. Tests cover mixed/missing/ambiguous and renamed metadata,
source identities, follow-ups, cache separation, legacy decoding, exclusions, bilingual coverage
and historical scope comparability. Existing history tests cover overlapping windows and
analysis-version differences; existing adapter tests cover source deduplication.

A synthetic classic HTML report was rendered and inspected at desktop width. The new coverage
text wraps within the existing header and leaves episode evidence available below it. This is
limited layout evidence, not owner aesthetic acceptance or evidence that an LLM correctly
classifies task contexts. The new analysis instruction constrains future analyses; offline
rendering does not rewrite existing generated prose. No task-category evaluation or live LLM
quality evaluation was performed, so automatic task taxonomy remains deferred.
