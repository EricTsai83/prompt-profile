# 17 · AI technique profile: how someone works with AI

Status: implemented (2026-10-24). After reviewing four layouts (badges, bars, timeline,
highlights) the owner asked for a deeper view of skills and AI capability; the chosen layout is
a fifth one, the **capability map**, and the other four were removed.

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

## Capability map (the chosen layout)

An adoption timeline, then five stages — plan, delegate, extend, verify, ship — each with its
measures and a named breakdown:

- **Skills:** name, origin (built-in, plugin, personal, project), the skill's own description
  from its `SKILL.md` front matter (or the built-in list), sessions and first–last use. Only the front
  matter is kept: the skill body is never stored, and the arguments it was called with are never
  read.
- **Subagent types**, **MCP servers** (from `mcp__<server>__…` tool names) and **models**, with
  session counts; background and worktree runs of subagents count under their techniques.
- **Share page:** built-in and plugin skills, built-in subagent types, well-known MCP servers and
  model names are shown; personal and project skills, custom agent types and other servers are
  only counted ("2 custom skills"), and their descriptions are not shown. Lists in
  `report/techniques.ts`.

## Review variants (removed)

Badges, bars, an adoption timeline and highlights were rendered side by side for review (commit
`856db54`). None showed which skills were used; the capability map replaced them, keeping the
timeline.
