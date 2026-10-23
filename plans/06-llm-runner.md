# 06 · LlmRunner: borrowing the user's local claude / codex

## Goal

Provide an `LlmRunner` service: given "instructions + an LLM Schema", it returns a value that has passed Schema validation. At runtime it calls the user's already-logged-in `claude` or `codex` CLI in the background, **without any API key**.

> This is the plan with the highest technical risk in the whole project, and it is done immediately after 02. **Every item marked "Confirm before implementing" must actually be run, with the conclusions written into `src/llm/NOTES.md`** (CLI version, command, observed behaviour), so that when a CLI changes we know what to re-check.

## Interface

```ts
interface LlmRunner {
  readonly id: "claude-code" | "codex"
  readonly displayName: string
  generate<A>(input: {
    system: string            // fixed instructions (map.md / reduce.md)
    prompt: string            // the data to analyze this time
    schema: LlmSchema<A>      // the LLM Schema from plan 02
  }): Effect<GenerateResult<A>, LlmError>
}

GenerateResult<A> {
  value: A
  model: string | null        // the model actually used (taken from CLI output)
  usage: { inputTokens: number | null, outputTokens: number | null, costUsd: number | null }
  durationMs: number
}
```

`LlmError` (tagged errors): `NotInstalled` | `NotLoggedIn` | `RateLimited` | `Timeout` | `InvalidOutput` | `ProcessFailed` (with the last 20 lines of stderr, **never prompt content**) | `Interrupted`.

## Implementation 1: `ClaudeCodeRunner` (confirmed that Claude Code 2.1.309 has these flags)

```bash
claude -p \
  --output-format json \
  --json-schema '<JSON Schema string>' \
  --no-session-persistence \
  --tools "" \
  --strict-mcp-config \
  --settings '{"disableAllHooks": true}' \
  --system-prompt '<system instructions>' \
  [--model <model>]
# the prompt goes in via stdin, not as an argument (avoids the argument length limit and keeps it out of ps)
```

| Flag | Rationale |
|---|---|
| `--tools ""` | Disables all tools. More robust than `--disallowedTools <list>`: tools Claude Code adds later are not missed |
| `--strict-mcp-config` | Does not start the user's configured MCP servers (starting them on every call is slow and may have side effects) |
| `--settings '{"disableAllHooks": true}'` | The user's hooks (notification sounds, Stop hooks…) must not fire on every analysis call |
| `--system-prompt` | Replaces the default coding-agent system prompt: saves tokens and keeps the "coding assistant" persona from influencing the analysis |

Confirm before implementing:
1. With `--output-format json` plus `--json-schema`, which field holds the structured result (e.g. `structured_output` or `result`); what values `is_error` and `subtype` take; where the model name and tokens / cost are (e.g. `modelUsage`, `total_cost_usd`). Save the real output (with content replaced by fake data) as `test/fixtures/llm/claude-output.*.json`.
2. Whether `--settings '{"disableAllHooks": true}'` works (test with a user hook that writes a file); if not, use `--setting-sources` instead and confirm it does not affect login.
3. Whether the user's `~/.claude/CLAUDE.md` is still loaded. If it is, state explicitly in the `system` instructions "ignore any other instructions about response style", and record this in NOTES.md.
4. **Do not use `--bare`**: its documentation says it skips the keychain, so users logged in with a subscription would fail to authenticate.

## Implementation 2: `CodexRunner` (confirmed that codex-cli 0.164.0 has these flags)

```bash
codex exec \
  --output-schema <schema.json temp file> \
  -o <output temp file> \
  --ephemeral \
  --ignore-rules \
  -s read-only \
  --skip-git-repo-check \
  [-m <model>] \
  -    # the prompt (system instructions + data) goes in via stdin
```

- Read the last message from the `-o` file and parse it as JSON.
- Do not use `--ignore-user-config`: the user may have configured a model provider in `config.toml`, and skipping it would break login.
- Codex has no separate system prompt flag; put `system` at the start of the stdin content.

Confirm before implementing:
1. Whether Codex accepts the JSON Schema produced by plan 02 (strict mode restrictions), and what the error message looks like when it does not.
2. Whether the model name and token usage can be obtained (possibly from the `--json` event stream); use `null` if not.
3. Whether the global `~/.codex/AGENTS.md` is loaded (handle it the same way as Claude item 3).

## Shared requirements

1. **Do not pollute the user's history (most important)**
   - Claude uses `--no-session-persistence`; Codex uses `--ephemeral`.
   - In addition, the first line of every prompt sent carries the marker `[prompt-profile:analysis]`. The adapters in plans 03 / 04 skip anything with this marker, as a second safeguard.
   - Write an integration test (local only): record the state of `~/.claude/projects/`, `~/.claude/history.jsonl`, `~/.codex/sessions/`, `~/.codex/history.jsonl`, run one `generate`, and confirm nothing was added.
2. **Working directory**: every call runs in a fresh, empty temporary directory (deleted when the `Scope` ends), so the user's project `CLAUDE.md` / `AGENTS.md`, hooks and MCP configuration are not loaded. Temporary schema / output files go here too.
3. **Detection**: `src/llm/detect.ts`
   - Installation: run `claude --version` / `codex --version` and record the version (for later cross-reference with error messages and NOTES.md).
   - Login: `claude auth status --json`, `codex login status`. **Do not send a test prompt** (it costs quota and is slow). Cache the result for the current run.
   - If both are available: default to Claude Code; switchable with `--engine`.
4. **Running subprocesses**: use `effect/process`'s `ChildProcessSpawner` (check the `.d.ts` for the API first), not `node:child_process` directly, so it can be replaced in tests.
   - Subprocesses must be bound to an Effect `Scope`: on timeout or when the user presses Ctrl-C, **the subprocess is really terminated**, leaving no `claude` / `codex` running in the background.
5. **Error classification**: map exit code + stderr / JSON output keywords to `LlmError`. The mapping table is a data array, with a test for every entry; anything unclassifiable is `ProcessFailed`.
6. **Validation**: the CLI already generates the result according to the JSON Schema, but it **must still** be decoded once with Effect Schema; failure is `InvalidOutput`.
7. **Timeout**: 5 minutes per call by default.
8. **Retries**: `RateLimited`, `Timeout` and `InvalidOutput` are retried automatically, at most 2 times, with exponential backoff (`RateLimited` waits at least 30 seconds). When retrying `InvalidOutput`, append an explanation of the error to the prompt. The retry logic is one function that wraps any `LlmRunner`; do not write it separately in both implementations.
9. **Concurrency**: controlled by the caller (plan 07); the runner itself imposes no limit.

## Implementation 3: `FakeLlmRunner` (for tests)

- Returns pre-recorded responses from `test/fixtures/llm/` keyed by `hash(system + prompt)`.
- Fails immediately when no matching response exists, printing the hash so a fixture can be added easily.
- Can be configured to "return a given error on the Nth call", to test plan 07's partial failures and plan 09's error messages.
- Records the number of calls (used by plan 07's cache tests).

## Tests

- Unit tests: with a fake `ChildProcessSpawner`, verify that the arguments sent are correct (snapshot), stdin receives the prompt, the prompt is not in the arguments, each error case maps to the correct `LlmError`, a timeout terminates the subprocess, and the temporary directory is deleted afterwards.
- `test/smoke/llm-runner.test.ts`: runs only when `claude` / `codex` is installed locally:
  1. A tiny Schema (e.g. `{ ok: boolean }`), confirming a result comes back.
  2. **Plan 02's `LlmChunkObservations` and `LlmProfileDraft`**: both CLIs must accept them and return results that pass validation.
  3. The "does not pollute history" test above.

## Acceptance criteria

- [ ] Unit tests pass
- [ ] Local smoke test: both `claude` and `codex` return validated JSON for plan 02's LLM Schemas
- [ ] Confirmed that after a run, the user's session and history files contain no new analysis content
- [ ] `src/llm/NOTES.md` records the conclusion of every "Confirm before implementing" item
