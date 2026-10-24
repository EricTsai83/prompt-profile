# Terms of service check (pre-release)

> First checked on 2026-10-24; re-checked before the release on 2026-10-24 (second pass, below). **This is not legal advice**; it is a preliminary summary made during development. Please read the originals yourself again before the official release.

## Question

prompt-profile runs the user's **self-installed, self-logged-in** `claude -p` / `codex exec` as a subprocess on the user's machine,
sending redacted prompts to be analyzed. The tool itself does not read, store or forward any credentials or tokens, and provides no login flow.
Is this kind of usage allowed?

## Anthropic (Claude Code)

Source: [Claude Code — Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) (read 2026-10-24)

- Supporting passage (Authentication and credential use):
  > "Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription …"
- Conditions this tool meets:
  - It runs the **unmodified** Claude Code binary and does not remove or restrict any login method (we also deliberately avoid `--bare`).
  - It does not "offer Claude.ai login", and does not collect / store / intermediate credentials or session tokens.
  - Usage is billed to the user's own plan; the tool does not pay for, resell or proxy it.
- Points to watch / uncertainties:
  - "OAuth authentication … is designed to support **ordinary use** of Claude Code";
    "Advertised usage limits for Pro and Max plans assume **ordinary, individual usage**".
    One analysis run makes about 10–30 calls, which is individual use, but whether "automated bulk calls" count as ordinary use is not clearly defined.
  - News reports (not official texts) say that from 2026 Anthropic began blocking third-party harnesses from using subscription OAuth,
    and from 2026-04 subscription quota no longer covers some third-party automation tools (e.g. OpenClaw). Most of those tools **obtain
    the OAuth token themselves and call the API**, unlike this tool, which "calls the original CLI", but where the line is drawn in practice may change again.
    - https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/
    - https://roboin.io/article/en/2026/04/04/claude-bans-third-party-tools-requires-api-keys/
  - Names and trademarks: the README may only state in plain text that it "calls your local Claude Code", and must not imply endorsement by Anthropic.

- Second pass (2026-10-24, before the release):
  - The Legal and compliance page still has the passage above and the same "ordinary use"
    wording. New on the page: preinstalling or running Claude Code **in your own product or
    hosted service** needs the Commercial Terms. That does not apply here: the user installs
    both tools on their own machine; we host nothing.
  - [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
    (notice of 2026-10-07): "You can still use the Claude Agent SDK, claude -p, and third-party
    apps with your subscription limits." The change announced for 2026-06-15 (moving this usage
    to a separate monthly credit) is paused; Max and Team plans now also include monthly API
    credits covering `claude -p`. This is the most direct official statement so far, and it
    supersedes the news reports above.
  - Precedent: T3 Code and Zed drive the user's own logged-in Claude Code the same way, in the
    open.

**Preliminary conclusion**: the current design falls within what the terms explicitly allow (users using the unmodified CLI with their own subscription), but
the interpretation of "ordinary use" is a risk. The README must be honest that subscription quota is used, and by default the user is asked to confirm first.

## OpenAI (Codex)

Source: [Codex and ChatGPT accounts](https://help.openai.com/articles/11369540)

- When signing in to Codex with a ChatGPT account, the ChatGPT Terms of Use apply (enterprise plans are covered by the corresponding service agreement).
- No terms were found that explicitly forbid "a local tool calling the user's own `codex exec`", nor any explicit statement allowing it.
- `codex exec` is the officially provided non-interactive mode; this tool runs it with `--ephemeral` and does not read `~/.codex/auth.json`.

- Second pass (2026-10-24): the help article now only covers plans, limits and which terms
  apply; nothing about `codex exec` or third-party tools either way. Scripted runs draw down plan
  limits faster, which the README already says.

**Preliminary conclusion**: no prohibiting terms were found, but there is no explicit official endorsement either; the README likewise needs to explain that ChatGPT plan quota is used.

## Pre-release to-dos

- [ ] Read the latest original texts of Anthropic's Consumer Terms / Commercial Terms, Usage Policy, and OpenAI's Terms of Use yourself.
- [ ] If the terms are unclear, consider contacting Anthropic sales (the channel provided on the terms page) to confirm.
- [ ] If the terms forbid this in the future, the fallback is a "user's own API key" mode (the current product decision is not to build it).
