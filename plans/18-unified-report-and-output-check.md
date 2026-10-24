# 18 · One report, chosen parts and a final output check

Status: implemented (2026-10-24). Replaces the share page of [plan 15](./15-profile-storytelling.md).

## Problem

Every run wrote two pages: `report.html` (everything) and `share.html` (no quotes, no project
names, no exact dates, no coaching). The owner found the split confusing — which file may be
shown to someone? — and the share page too thin without quotes. Nothing checked the final output:
prompts are redacted before the LLM sees them, but generated text (traits, fun facts, rewrites)
can bring back a path, an email or a secret, and the user would not know before sharing.

## Decisions (owner, 2026-10-24)

- **One report.** No `share.html`; an old one in the output folder is removed, so a stale page
  is never left behind. By default the report shows everything, quotes included: it stays on
  the user's machine, and the risky moment is sharing it.
- **Parts are chosen with flags**, not a config file: `--exclude` on `analyze` and `render`.
- **A final check runs before anything is written**, with tiers; the default masks and lists,
  never blocks.

## Parts (`--exclude`, an extensible data list in `report/looks.ts`)

| Part | Left out |
| --- | --- |
| `quotes` | Evidence quotes and the before / after rewrites |
| `projects` | Real project names: shown as "Project A / B" in charts and generated text |
| `dates` | Exact dates: the calendar, day-level dates; the data period by month |
| `coaching` | "Improve your prompts": improvements, signals, "since your last report" |
| `funfacts` | Fun facts |
| `custom-names` | Names and descriptions of personal / project skills, custom agent types and other MCP servers (counted instead) |
| `personal` | Shorthand for all of the above (what the old share page showed) |

`render profile.json --exclude …` writes to `variants/<look>[-no-<card parts>][-without-<parts>]/`
like other non-default renders, so the full report is kept. `render.json` (version 2) and the
report's "How this was measured" record the parts left out. The card never has quotes; it shows
project names only when `projects` is not excluded.

## Final check (`pipeline/audit.ts`)

Runs on every displayed string of the profile (generated text, quotes, rewrites, names,
descriptions) after the parts are applied, and before `profile.json`, the report or the cards
are written. Reuses the redaction rules of `pipeline/redact.ts`, in two tiers:

| Tier | Rules | Behaviour |
| --- | --- | --- |
| Secret | private key, connection string, bearer, key–value secret, API token, JWT, high-entropy token | Always masked, whatever `--check` says; `--allow` cannot release them |
| Personal | email, home path, username, internal URL, Taiwan national ID, credit card, phone | `--check mask` (default): masked and listed. `--check warn`: kept and listed. `--check strict`: nothing is written, the command fails (exit 1) and lists every finding, secrets included |

- `--allow <rule,…>` releases personal rules (e.g. `--allow email` for a public address); a
  secret rule there is a usage error (exit 2). Allowing `home-path` alone still masks the
  username inside the path (`username` is its own rule).
- Masked text uses the redaction placeholders (`[SECRET]`, `[EMAIL]`, `~` for a home folder…),
  as in quotes redacted before the LLM, so the reader sees that something was there.
- Machine fields (dates, ids, numbers, model ids) are not checked. Rules that only flag
  identifiers in prompts (UUID, long hex hash) are left out of the check: generated text and
  names do not carry them, and they would only produce noise.
- The masked profile is what is written: `profile.json`, the report and the cards agree.

## Terminal summary

After writing, the CLI lists what the report contains and what the check found — location,
rule and count, **never the text** (terminal output gets pasted into issues and chats):

```
  Contains  34 quotes · 8 project names · exact dates · 4 improvements · 3 fun facts
  Check     3 masked: email (Traits › 2), home path (Fun facts › 1, Improvements › 3)
  Before sharing, skim the quotes yourself: the check is rule-based.
  To leave parts out: prompt-profile render <profile.json> --exclude personal
```

## Not in scope

A config file, an interactive per-item review, changes to the analysis prompts (no
`ANALYSIS_VERSION` bump) or to the `profile.json` format (no schema bump).

## Steps

1. This plan.
2. One report and `--exclude` (remove the share page; `Visibility` replaces the audience).
3. `pipeline/audit.ts`, `--check`, `--allow`, masking before writes.
4. Terminal summary, README and `docs/` samples.
5. Cross-model review; fixes.

## Acceptance

- [x] No `share.html` is written, and an old one is removed.
- [x] Each part of `--exclude` removes exactly its content; `personal` leaves out everything the
      old share page did (its privacy test is kept for `--exclude personal`).
- [x] A secret in generated text is masked under every `--check` mode and cannot be allowed.
- [x] `--check strict` writes nothing when a personal finding exists; `warn` keeps the text.
- [x] The terminal never prints a matched value.
- [x] On the owner's real profile the check reports no false positive in normal text.
