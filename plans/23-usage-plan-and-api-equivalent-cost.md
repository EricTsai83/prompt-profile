# Usage, plan and API-equivalent cost

Status: planned

## Objective

Show how much a person used Claude Code and Codex during the report period, side by side:
the subscription plan each tool runs on, token volumes, and what that usage would cost at public
API list prices. This is a requested report feature (owner, 2026-10-29). Subscription users are
not billed per token. The figure answers "what would this usage cost on the API?", not "what did
you pay?".

Everything comes from local files and the CLIs that are already installed. No API key, admin
key, account, network billing call or price download is required. This stays consistent with the
settled "no API key" decision in [README](README.md).

## Output model: factual report and identity report

The owner considers the current split between the HTML report and the PNG card unhelpful. Two
outputs are what matter:

- **Factual report:** a truthful, complete presentation of the information, with sources,
  denominators and unknowns. Usage, plan and API-equivalent cost belong here.
- **Identity report:** a fun, recognizable introduction of the person. It does not show plan
  names, token tables or monetary amounts.

Today the factual role is closest to the "Profile & evidence" view, and the identity role to the
visual overview and the card. Plan 23 places its content by role, not by file. Restructuring the
outputs themselves into these two reports belongs to [plan 21](21-report-content-and-ui-iteration.md).
Record this direction there when plan 21 continues. If plan 21 renames or merges views first,
follow its result.

## Data sources (verified on a real machine, 2026-10-29; structure only)

| Information           | Claude Code                                                                                                                                                                            | Codex                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan                  | `claude auth status --json` → `subscriptionType` (e.g. `team`), `authMethod`. Optional detail in `~/.claude.json` `oauthAccount`: `seatTier`, `userRateLimitTier`, `billingType` (undocumented) | `~/.codex/auth.json` → `tokens.id_token` JWT claim `https://api.openai.com/auth` → `chatgpt_plan_type` (e.g. `prolite`), `auth_mode` (undocumented)                                        |
| Tokens and model      | Each `assistant` line in `~/.claude/projects/**/*.jsonl`: `message.model`, `message.usage` with `input_tokens`, `output_tokens`, `cache_creation_input_tokens` (and `cache_creation` 5m/1h split), `cache_read_input_tokens` | Rollouts in `~/.codex/sessions/**/*.jsonl`: `event_msg` `token_count` with `info.total_token_usage` / `last_token_usage` (`input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens`, `reasoning_output_tokens`); model in `turn_context` |
| Cost                  | Not stored; computed from tokens × an embedded price table                                                                                                                             | Same                                                                                                                                                                                      |

Every field above is an external, undocumented or changeable format. Parse leniently, skip bad
lines and count them. When a value cannot be read, show "unknown"; never guess a plan or price.

## 1. Read usage without double counting

- [ ] Extend the Claude Code and Codex adapters (or a sibling reader in `adapters/`) to emit
      usage events: source, session id, timestamp, model, and token counts by kind. Never emit
      prompt or response text. Keep `adapters/` free of LLM knowledge.
- [ ] Claude Code can write the same response more than once. Deduplicate by message id and
      request id, following ccusage's approach. Include sidechain and subagent lines, and keep
      the model of each line: side tasks may use a different model.
- [ ] Codex `total_token_usage` is cumulative per session. Use per-turn deltas
      (`last_token_usage`) or the final total per session, never the sum of totals. Verify
      whether `output_tokens` already includes `reasoning_output_tokens` before pricing reasoning
      separately, and record the answer in a test fixture comment.
- [ ] Exclude prompt-profile's own analysis calls. Current runners use
      `--no-session-persistence` / `--ephemeral`, but older versions may have left sessions
      behind. Skip any session whose user prompt carries the analysis marker.
- [ ] Apply the same `--since` window and time zone as the prompt analysis, so usage and
      prompts describe the same period.
- [ ] Fixtures are hand-written with the real field layout, including duplicates, cumulative
      totals, unknown models, malformed lines and marker sessions. Add a smoke test on real data
      that prints only counts.

## 2. Detect the subscription plan safely

- [ ] Claude: read `subscriptionType` from `claude auth status --json`, which `llm/detect.ts`
      already runs. Optionally read `seatTier` / `userRateLimitTier` from `~/.claude.json`,
      treated as undocumented hints.
- [ ] Codex: decode only the payload of `tokens.id_token` locally and keep only
      `chatgpt_plan_type` and `auth_mode`. **Never** store, log, cache, hash or send any token,
      email, account id or other claim. Add tests that fail if any credential field reaches a
      profile, cache, error message or terminal output.
- [ ] An API-key login or a missing or unreadable file gives "API key" or "unknown", not an
      error. Plan detection never blocks report generation.
- [ ] Respect module boundaries: whichever folder owns this (adapters for files, `llm/detect`
      for the CLI call), `domain/` gets only a schema, and `report/` only consumes the profile.

## 3. Price at API list prices, reproducibly

- [ ] An embedded, versioned price table for the models seen: input, output, cache write
      (5-minute and 1-hour where they differ) and cache read for Anthropic; input, cached input
      and output for OpenAI. Record each price's source and as-of date. It is a data array, not
      flow code.
- [ ] Add a `PRICING_VERSION` to the "Versions" table in `plans/README.md`. A model missing
      from the table gets an unknown cost and is listed. Its tokens are still shown, and its
      cost is never borrowed from a similar model.
- [ ] Compute the cost when the profile is created and store it with the pricing version. A
      later `render` then shows the same numbers. Optionally offer an explicit re-price, which
      makes no LLM calls and records the new version.
- [ ] Always label the amount as "API list-price equivalent", in every language. Do not
      hard-code subscription fees: seat, team and regional prices vary. If a comparison with the
      fee is wanted, the user supplies the fee, and the report shows it as user-provided.

## 4. Profile format and analysis boundary

- [ ] Add a usage section to `Profile`: per source plan info, totals, and a breakdown by month
      and by model (tokens by kind, cost or unknown, pricing version, skipped-line counts).
      Bump `Profile.schemaVersion` and migrate older profiles to "not measured", which is
      distinct from zero.
- [ ] Do not send usage, plan or cost to the LLM: keep them out of `statsForReduce` and the
      chunk text. No `ANALYSIS_VERSION` bump is needed unless that boundary changes.
- [ ] Add `usage` to `REPORT_PARTS` (and the `personal` group) so `--exclude usage` removes it
      from the report, `profile.json` output checks and every derived file. The final output
      check (`pipeline/audit.ts`) must treat plan names and amounts as personal.

## 5. Present it in the factual report

- [ ] A "Usage during this period" section: Claude Code and Codex side by side, with plan,
      total tokens split by kind, API list-price equivalent, and the share of each tool. Include
      a monthly trend and a per-model breakdown where data exists.
- [ ] Every number states its unit, period and source. Unknown plan, unknown model price,
      unreadable logs and "not measured" (legacy profile) are four distinct, explained states.
      A single tool, or no usage data at all, has a designed layout.
- [ ] Do not rank the person by spending, call high usage impressive, or compare them with
      other users. No cost on the identity report or card.
- [ ] English and Traditional Chinese fixed text goes in `src/report/messages.ts`. Apply the
      accessibility, print, offline, CSP and visibility rules of the existing report. Bump the
      affected look and render versions.

## 6. Optional: reuse in experiments (plan 22)

- [ ] Plan 22 experiments record per-call tokens but have no Codex cost. Once the price table
      exists, its experiment pages may show the API list-price equivalent for every case, with
      the pricing version. This is optional and must not delay this plan.

## Acceptance

- [ ] TDD for parsing, deduplication, cumulative-total handling, marker exclusion, pricing,
      unknown states, migration and exclusion. Each new test fails before its change.
- [ ] Credential-safety tests prove that no Codex token or other auth claim, and no email,
      reaches any output, cache or log.
- [ ] Spot-check totals against ccusage (or the CLI's own usage view) on the owner's machine for
      one month. Record the agreement or explain the difference. Print counts only; commit no
      real numbers or plan data.
- [ ] Render fictional examples of both tools, a single tool, unknown plan, unknown price and a
      legacy profile, in English and Traditional Chinese, desktop and mobile. Inspect them
      visually.
- [ ] `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`, plus `pnpm test:smoke`
      because adapters change. Judge by exit code and the Test Files count.
- [ ] Update usage documentation and the README privacy notes (which files are read, what is
      never stored). When every box is ticked, remove this plan and its index row, and fix
      incoming links.
