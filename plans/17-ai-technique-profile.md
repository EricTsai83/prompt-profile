# 17 · AI technique profile: how someone works with AI

Status: implemented (2026-10-24); the layout of "How I work with AI" waits for the owner's
choice between four review variants (`docs/ux/review/`).

## Goal

Show other people, and the owner, how they work with AI agents — not only who they are — and
track whether the suggested improvements stick. Everything comes from local metadata and the
prompt text; no new LLM calls.

## What is measured

| Kind | Techniques | Source | Shown as |
| --- | --- | --- | --- |
| Workflow | subagents, skills, plan mode, MCP, web, background tasks, questions to the user, worktrees, pull requests | Tool **names** and line types in Claude Code transcripts (`tool_use` names, `permissionMode`, `pr-link` deduplicated by URL hash, `worktree-state` once per session); Codex tool-call names | Share of **covered** sessions |
| Prompt craft | plan first, error context, file paths, constraints, acceptance, examples, verification, structure, why, output format | Regex heuristics over cleaned prompts (`pipeline/techniques.ts`, a data list) | Share of prompts |
| Parallel work | most sessions at once, days with overlap | Session spans from prompts and events | Callout |
| Progress | corrections, terse prompts, night share, technique shares, last suggestions | The previous `profile.json` in the output folder | "Since your last report" (private) |

**Coverage.** Claude Code deletes old transcripts, while `history.jsonl` keeps the prompts. Each
session with a transcript emits one `transcript` event; workflow shares use these covered
sessions as the denominator, months without transcripts are drawn as "no data", and "since
<month>" is only shown when a technique started after the data did. On the owner's data, May–July
have prompts but no transcripts.

## Rules

- Never read tool inputs or outputs, PR URLs or MCP server names into the profile; only
  technique categories and counts. Subagent (sidechain) lines are the agent's own steps and are
  skipped; events of sessions excluded by the filters (automated, delegated) are dropped.
- Prompt-craft heuristics are approximate and labelled with their definition on hover; they are
  never combined into a score.
- The section is shown on the share page too (counts only); progress is private.
- Profile `schemaVersion` 7 (`stats.techniques`) and 8 (`previous`); older files decode without
  them and the report leaves the sections out. Monthly technique data is not sent to the LLM.

## Review variants

`pnpm review:variants <profile.json> <dir>` renders every layout; `docs/ux/review/build.mjs`
adds screenshots and a side-by-side page. A: badges · B: bars · C: adoption timeline ·
D: highlights. The default is B until the owner chooses; then the others are removed.
