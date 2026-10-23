# 04 · Codex adapter

## Goal

From the user's local Codex data, read the prompts the user actually typed themselves and output a `Stream<PromptRecord>`. The structure mirrors plan 03 and shares `src/adapters/common/`.

## Data location and format (verified against real data, 2026-10, codex-cli 0.164.x)

Root directory: `$CODEX_HOME`, or `~/.codex` if unset.

### 1. `sessions/YYYY/MM/DD/rollout-<time>-<id>.jsonl` (primary source)

The outer shape of each line is `{ timestamp, ordinal, type, payload }`. The parts used:

```jsonc
// session metadata at the start of the file
{ "type": "session_meta", "payload": {
    "id": "…", "session_id": "…", "timestamp": "…", "cwd": "/Users/…",
    "originator": "codex_exec" | "codex_cli_rs" | "T3 Code" | …,
    "source": "exec" | "vscode" | "cli" | { "subagent": "…" },
    "cli_version": "0.164.0",
    "git": { "branch": "…", "commit_hash": "…", "repository_url": "…" }
} }

// user message
{ "type": "response_item", "payload": {
    "type": "message", "role": "user",
    "content": [ { "type": "input_text", "text": "…" } | { "type": "input_image", … } ]
} }
```

All other `type`s (`event_msg`, `turn_context`, `token_usage_record`, `world_state`, `reasoning`, `custom_tool_call`…) are skipped.

### 2. `history.jsonl` (supplementary source)

```jsonc
{ "session_id": "…", "ts": 1784658649, "text": "prompt text" }   // ts is in seconds, not milliseconds
```

## Filter rules

| Exclusion condition | Reason |
|---|---|
| `session_meta.payload.source` is an object with a `subagent` field → **exclude the whole session** | Subagent instructions are issued by the AI itself |
| `input_text` starts with `<environment_context>`, `<user_action>`, `<guardian_tool_descriptions>`, `<user_instructions>` | Content injected automatically by Codex |
| `input_text` starts with `# AGENTS.md instructions` or `# AGENTS` | Automatically injected AGENTS.md |
| text contains the `[prompt-profile:analysis]` marker | Our own analysis calls |

**`codex exec` sessions need special handling**: in real data, `originator: "codex_exec"` accounts for the vast majority, and many of those are invoked by other tools (code review bots, automation scripts) rather than typed by the user.
- `origin`: `originator` is another app (e.g. T3 Code) → `sdk`; otherwise `source === "exec"` → `exec`; `vscode` / `cli` → `interactive`; anything else → `unknown`. `client` stores the raw `originator` value.
  - Spell out and test the order of these checks: apps like T3 Code sometimes run through exec mode too, and `originator` says more about "who is typing" than `source` does.
- The MVP **keeps** `exec` by default but counts it separately in stats. Plan 05 additionally filters prompts that are obviously machine-generated with heuristics.
- If one `input_text` has multiple blocks, join the non-injected blocks with newlines.

## Merging and dedup

- Same rules as plan 03: **per session**. Records in `history.jsonl` whose `session_id` already has a rollout file are skipped entirely; only sessions without a rollout file are recovered from `history.jsonl`.
- A resume may rewrite old messages into a new rollout file: within one session, messages with identical text and identical timestamp are kept only once.
- `PromptRecord.id`: `codex:${sessionId}:${ordinal}`; records from `history.jsonl` use `codex:${sessionId}:h${ts}`.

## Implementation requirements

- Lives in `src/adapters/codex/`, implements plan 02's `SourceAdapter` interface, and is registered in `src/adapters/registry.ts`.
- If the `ordinal` field is missing (older Codex versions), use the line number in the file instead.
- Find `sessions/**/rollout-*.jsonl` recursively; there may be hundreds of files, so read them with bounded concurrency (e.g. 8).
- Lenient Schema, bad lines skipped, missing directory returns an empty Stream: same rules as plan 03.
- `src/adapters/registry.ts`: exports the array of all adapters and `readAll`, which merges each adapter's Stream. **Sorting is left to plan 05** (sorting needs the whole batch; do not pretend the Stream layer can sort).

## Tests

- `test/fixtures/codex/`: hand-written fake rollout files covering: a normal interactive session, a subagent session, an exec session, the various injected contents, images, broken lines, and a `history.jsonl` with second-based timestamps.
- Table-driven tests for every filter rule; snapshot the output of the whole fixture directory.
- `test/smoke/codex.test.ts`: same rules as plan 03.

## Acceptance criteria

- [ ] All tests pass; the smoke test prints how many records each filter rule excluded and the count per `origin`
- [ ] `readAll` can read both sources together
