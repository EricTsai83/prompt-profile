# LLM runner notes

Observed behaviour of the CLIs we borrow. **Re-check these whenever Claude Code / Codex
ship a major release** (`pnpm test:smoke:llm` covers the critical paths; it calls the real
CLIs and uses subscription quota).

Verified on 2026-10-24 with **Claude Code 2.1.309** and **codex-cli 0.164.0** (macOS).

## Claude Code (`claude -p`)

Command: see `claudeArgs` in `claude.ts`. Prompt is sent on stdin (never in argv).

1. **Output location** (`--output-format json` + `--json-schema`)
   - Structured result: `structured_output` (object). `result` holds the same JSON as a string;
     we fall back to parsing it if `structured_output` is missing.
   - Errors: `is_error: true`, `subtype` stays `"success"` even on API errors(!),
     `terminal_reason: "api_error"`, `api_error_status` (e.g. `404` for an unknown model),
     `result` holds the human-readable message, exit code `1`.
   - Usage: `usage.input_tokens` (+ `cache_creation_input_tokens` + `cache_read_input_tokens`),
     `usage.output_tokens`, `total_cost_usd`.
   - Model: `modelUsage` is keyed by model id (e.g. `claude-opus-5-5[1m]`, plus a Haiku entry
     used for side tasks). We pick the entry with the most output tokens and use its
     `canonicalModel`.
   - Fixtures: `test/fixtures/llm/claude-output.*.json` (content replaced with fake data).
2. **`--settings '{"disableAllHooks": true}'` works**: tested with a project-level
   `UserPromptSubmit` hook that touches a file — fires without the flag, not with it.
   (Managed/enterprise policy hooks may still be enforced; not testable here.)
3. `--system-prompt` alone does not isolate CLAUDE.md: a file in the cwd changed the answer
   in the original probe. We now also use `--safe-mode`, which the installed CLI describes as
   disabling user customizations (including memory, skills, plugins, hooks and MCP). Every call
   still runs in a fresh empty directory. Managed policy can remain; the system preamble is
   defense in depth, not an isolation boundary.
4. **Do not use `--bare`**: it skips the keychain, so subscription logins fail.
5. `--disable-slash-commands` is added to keep skills out of the context.
6. `claude auth status --json` → `{ "loggedIn": boolean, ... }`. The output also contains the
   user's email / org — we only read `loggedIn` and never log the rest.
7. `--no-session-persistence`: verified no new content in `~/.claude/projects/` or
   `~/.claude/history.jsonl` (smoke test greps for a per-run nonce).

## Codex (`codex exec`)

Command: see `codexArgs` in `codex.ts`. System text + prompt on stdin (no system flag).

1. **Strict-mode schema**: Codex accepted both `LlmChunkObservations` and `LlmProfileDraft`.
   A non-strict schema fails with exit code `1` and a `turn.failed` event whose message is an
   embedded JSON string: `Invalid schema for response_format 'codex_output_schema':
   'schema.additionalProperties' is required to be supplied and to be false when strict is
   true.` (`code: invalid_json_schema`, `status: 400`). Fixture:
   `codex-events.schema-error.jsonl`.
2. **Usage / model**: with `--json`, the `turn.completed` event has
   `usage.{input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens}`.
   **The model name is not reported** → `model` is the `--model` we passed, else `null`.
   Unknown model with a ChatGPT login: `status: 400`, "The 'x' model is not supported when using
   Codex with a ChatGPT account."
3. `~/.codex/AGENTS.md` (global) is loaded by Codex; same mitigation as Claude (#3).
   Not separately verified because the local file is empty.
4. The final message is written to the `-o` file and also printed to stdout without `--json`.
   Without `--json`, Codex echoes the prompt to **stderr** — we always use `--json` and also
   strip prompt lines from the stderr tail (`sanitizeStderr`).
5. `codex login status` prints `Logged in using ChatGPT` (exit 0) **on stderr** (stdout is
   empty), so detection reads both streams.
6. `--ephemeral`: verified no new rollout file / history line (nonce grep).
7. We now pass `--ignore-user-config`: the installed CLI explicitly states that auth still
   uses `CODEX_HOME`. Custom providers and model defaults from `config.toml` are intentionally
   not inherited. `--model` still works. `features.hooks=false` also disables adjacent hook
   files, and `notify=[]` prevents notification commands. Administrator configuration and
   inherited environment variables can still apply; read-only does not remove all tools.

## Isolation regression probes

`test/smoke/llm-isolation.test.ts` passed on 2026-10-24 with the versions above. Each probe
uses a synthetic hook and a minimal stdio MCP server that create separate marker files.
The positive control starts both, then the production isolation flags prevent both markers.
Claude's probe uses explicit synthetic settings and a project MCP file; Codex uses a temporary
`CODEX_HOME` with synthetic config/hooks and a symlink to the existing login. No user config is
modified. Both probes require successful CLI completion, so an auth failure cannot be mistaken
for isolation. The history/schema probes also passed after the flag changes (8 tests total).

Codex settings reference: [official configuration reference](https://developers.openai.com/codex/config-reference)
and [hooks guide](https://learn.chatgpt.com/docs/hooks). CLI help for codex-cli 0.164.0 is the
source for `--ignore-user-config` retaining authentication. CLI help for Claude Code 2.1.309
is the source for safe mode. Re-run these probes when changing flags or upgrading supported
CLI versions. Results do not establish isolation from enterprise-managed policy or CLI logs.

## Rate limits

Not reproduced locally. Classification relies on HTTP status `429`/`529` and keywords
(`rate limit`, `usage limit`, `too many requests`, `quota exceeded`, `limit reached`,
`overloaded`) in `classify.ts`. The Codex fixture `codex-events.rate-limit.jsonl` is
**hand-written** based on the error event shape, not captured from a real rate limit.
