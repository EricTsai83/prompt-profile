# Security policy

Only the latest published version receives fixes. Update before reproducing a security issue.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/EricTsai83/prompt-profile/security/advisories/new)
when available. If private reporting is unavailable, open an issue asking for a private contact
channel, without including exploit details or personal data. Do not post credentials, real
prompts, reports, caches, dry-run files or unredacted CLI output in a public issue.

Include affected versions, OS, a minimal synthetic reproduction, the expected boundary and the
observed behavior. No response-time guarantee is currently offered.

## Data boundaries

The application reads local history and cleans and redacts it locally. Selected prompt text,
project basenames, usage statistics and intermediate observations are then sent through the
borrowed CLI to its model service. Redaction is best-effort: arbitrary names, proprietary text
and unknown secret formats can remain. Use `--dry-run` to review the selected chunks before an
analysis. It previews map data, not the subsequently generated merge/reduce requests or retries.

Reports, dry-run exports and analysis caches can contain sensitive text. Created folders use
`0700` and files use `0600`; existing folder permissions are left unchanged. File replacement is
atomic, but a multi-file report update is not a filesystem transaction. The old card is removed
before new report data is published, preventing it from being mistaken for the current card.
Do not run two report writers against the same output folder at once.

The share card excludes evidence quotes, but generated descriptions and activity statistics can
still be personal. Inspect it before sharing. Cache clearing does not delete reports, dry-run
exports, backups, or the borrowed CLI's own logs. Cache deletion failures produce a nonzero exit
code; successful deletion is not secure erasure of storage media.

## Borrowed CLI limitations

Claude uses safe mode, no built-in tools, strict MCP configuration, disabled hooks and ephemeral
sessions. Codex ignores user `config.toml`, disables lifecycle hooks and notifications, and uses
an ephemeral read-only session in a fresh temporary folder. Codex authentication still uses its
normal home, but custom providers and model defaults from user config do not apply; use `--model`.
These controls are checked against specific CLI versions, not every historical or future release.

Administrator-managed policy, environment variables, authentication helpers, provider retention
and CLI diagnostics remain under the CLI/provider's control. Ephemeral sessions do not guarantee
that the CLI or provider keeps no logs. A read-only sandbox is not a guarantee of no file reads,
no tool use or no network requests. See [runner notes](src/llm/NOTES.md) for observed behavior.

There is no application telemetry or direct model API integration. The report renderer uses
bundled fonts and makes no network requests. The borrowed CLI controls its own network traffic.
