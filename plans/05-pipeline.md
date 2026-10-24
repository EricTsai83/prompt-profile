# 05 · Pipeline: filter, clean, redact, stats

Status: implemented; `PIPELINE_VERSION` 4. The final output check reuses its redaction rules (plan 18). Acceptance checked 2026-10-24.

## Goal

Turn the `PromptRecord`s produced by the adapters into:
1. **In-scope prompts**: filtered by `--since`, with obviously machine-generated prompts removed
2. **Clean prompts**: noise with no analytical value removed
3. **Safe prompts**: sensitive information redacted, so they can be sent to the LLM
4. **`Stats`**: deterministic statistics that need no LLM

The processing order is fixed:

```
PromptRecord ──► filter ──► (sort) ──► clean ──► redact ──► SafePrompt[]
                   │                     │
                   └──── stats (totals)  └──── stats (other features)
```

`--since` **is handled exactly once, here**; later analysis and report steps never filter by time themselves.

## 1. `src/pipeline/filter.ts`

- Filter by `since` and sort by timestamp (ties broken by id so the result is stable).
- Exclude machine-generated prompts (they count toward no statistics; only the number excluded is recorded):

| Rule | Rationale |
|---|---|
| The same long text (> 200 characters) appears in 3 or more different sessions | Automation scripts, code review bots, template prompts |
| A session's first prompt matches the signature of "the AI delegating a subtask" (a list, extensible; e.g. an orchestrator's fixed opening) | Desktop apps' child threads are prompts written by the AI |

- The signature list for the second rule may start empty. During implementation, have a smoke test print "the number of sessions per `client` and the hash distribution of the first 30 characters of each session's first prompt" (**never the original text**), and decide yourself whether to add rules.

## 2. `src/pipeline/clean.ts`

Exclude the following prompts (they count toward `totalPrompts` but not `analyzedPrompts`; the number excluded is recorded separately):

| Rule | Examples |
|---|---|
| Fewer than 3 characters after trimming whitespace | `cc`, `y`, `ok` |
| Short acknowledgements / "continue" phrases (Chinese and English list, extensible) | `continue`, `yes`, `go`, `繼續`, `好`, `可以` |
| The same sentence repeated consecutively within one session | Resends |

Additionally, apply these transformations in order:
1. Detect "pasted code / log / stack trace" blocks (code fences, many consecutive indented or line-numbered lines, `at …(file:line)` and similar signatures) and replace them with `[pasted code: N lines]`. The analysis is about how the user talks, not what they pasted.
2. If the text still exceeds 4,000 characters after that, truncate it, keeping the beginning and end and marking the middle with `[… N characters omitted …]`.

## 3. `src/pipeline/redact.ts`

This step is mandatory **before** anything is sent to the LLM. Replace with fixed markers:

| Type | Replaced with |
|---|---|
| API keys / tokens (`sk-…`, `ghp_…`, `gho_…`, `xox[bp]-…`, `AKIA…`, JWTs, high-entropy strings of length ≥ 32) | `[SECRET]` |
| Key-value pairs like `Bearer …`, `password=…`, `token: …` | `[SECRET]` |
| Private key blocks (`-----BEGIN … PRIVATE KEY-----`) | `[SECRET]` |
| Connection strings containing credentials (`postgres://user:pass@…`) | `[SECRET]` |
| Email | `[EMAIL]` |
| Phone numbers (including the Taiwanese mobile format `09xx-xxx-xxx`) | `[PHONE]` |
| Taiwanese national ID numbers, credit card numbers (Luhn check) | `[ID]` |
| Internal IPs, private URLs other than `localhost:port` | `[INTERNAL_URL]` |
| User home directory paths `/Users/<name>/…`, `/home/<name>/…`, `C:\Users\<name>\…` | `~/…` |
| The current OS username (`os.userInfo().username`, when its length is ≥ 3) | `[USER]` |

- Redaction rules live in one array, each with a name, for easy testing and statistics (e.g. "redacted 12 SECRETs").
- **Prefer over-redacting to missing something**.
- The `project` field keeps only the last folder segment and also goes through the redaction rules.

## 4. `src/pipeline/stats.ts`

Compute according to plan 02's `Stats` format:
- All time-related statistics use the user's local timezone (from `Intl.DateTimeFormat().resolvedOptions().timeZone`, injectable as a parameter for tests).
- `totalPrompts`, `totalSessions`, `bySource`, `byOrigin`, time distributions, `longestStreakDays`: use the data **after filter, before clean**.
- `promptLength`, `languageMix`, `correctionRate`, `imageRate`: use the data **after clean**.
- Document in code comments which data set each field uses.
- `languageMix`: decided by characters (share of CJK characters vs Latin letters); each prompt is classified as zh / en / mixed, then ratios are computed.
- `correctionRate`: the share of prompts that start with or contain a correction phrase (`不對`, `錯了`, `不是這樣`, `還是不行`, `no,`, `wrong`, `that's not`, `still broken`…). Use an extensible list.
- `latestTime`: treat 00:00–04:59 as "a continuation of the previous day" and find the latest time across all days. `null` when no record falls within 18:00–04:59.
- `topProjects`: keep only the last segment of the project folder name.

## 5. `src/pipeline/index.ts`

```ts
runPipeline(records: Stream<PromptRecord>, opts: { since: DateTime.Utc | null; now: DateTime.Utc; timezone: string })
  => Effect<{ prompts: SafePrompt[], stats: Stats, report: PipelineReport }>
```

- `SafePrompt` = a cleaned, redacted prompt: `{ id, sessionId, source, timestamp, project (folder name only), text }`. **`text` is exactly what is later sent to the LLM, and also what plan 07 verifies evidence against.** It does not contain the original text, so later modules cannot misuse it.
- `PipelineReport`: how many records each rule excluded and how many times each redaction rule fired. Shown to the user in the CLI to reassure them.
- `now` is passed in from outside (do not read the system clock inside the function) so tests can pin it.

## Tests

- filter: `since` boundaries, stable sorting, long text repeated across sessions.
- clean: table-driven per rule; code block detection covers at least code fences, stack traces, JSON, and ordinary multi-line Chinese paragraphs (which must not be treated as code).
- redact: for each kind of sensitive data, at least 3 "must redact" examples and 3 "must not redact" examples (e.g. whether ordinary long English words, UUIDs and git commit hashes are redacted must be decided explicitly in the tests, with the reasoning written down).
- stats: compute from fixed fake data and snapshot it; **pin the timezone in tests** (e.g. `Asia/Taipei`) and test a `latestTime` that crosses midnight.

## Acceptance criteria

- [x] All tests pass
- [x] Smoke test: run the full pipeline on real local data and print `PipelineReport` and `Stats` (without printing prompt content)
