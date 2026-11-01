# Reusable instruction provenance

Short prompts can delegate requirements to skills and rule files. New analyses retain that
context without treating installed files or autonomous agent activity as user expertise.

## Purpose, selection and requirements

1. **Documented purpose:** names and descriptions from historical skill listings or recorded
   SKILL.md front matter identify what a skill is intended to do. No purpose is inferred
   from an impressive name alone. Description-only contexts remain useful metadata.
2. **Selection:** explicit user requests and supported attachments are distinguished from
   agent reads without an observed user request, automatically supplied rules and uncertain
   references. Selecting a method can describe a collaboration preference regardless of who
   wrote it.
3. **Requirements:** content actually present in historical tool results, skill expansion
   messages or supported attachments can supply specific adopted requirements. Missing
   content stays unavailable; current files are never substituted.

Authorship tracking is removed. Writing, installing or having a skill in a personal directory
does not affect the assessment. The report focuses on methods the person chooses and uses.

Synthetic example: "Use $review" plus a recorded description "Review a change for correctness"
can establish the selected method's documented purpose. It does not establish which checks
were requested or whether they ran. A recorded body requiring acceptance checks supplies
that concrete requirement. An agent reading the same file after "Fix the menu" cannot by
itself establish the user's active choice.

## Supported records

Claude supports explicit skill/slash invocations with an observed skill/read, Read results
matched by tool-use id, and skill expansion messages beginning with "Base directory for this
skill:". Expansion text is context, not another user prompt. Ordinary slash commands without
an observed instruction use retain their existing exclusion.

Codex supports explicit skill markers, direct read/use/apply requests and local Markdown
links in such requests; structured read calls; exact single-file cat commands and matching
results. Literal sequential exec-command wrappers can be aligned to ordered structured
results only when the entire wrapper and result count match the supported form. Historical
code is parsed as text, never executed.

Supported structured text-file attachments retain supplied filename/text when a user message
is present. Skill listings mean availability, not selection. Observed Codex AGENTS.md and
user-instruction injection blocks are labeled automatic.

Ambiguous aliases, arbitrary scripts, compound shell output, opaque attachments and unknown
injection formats remain incomplete evidence. Report links, quoted assistant messages,
delegated notifications and common shell variables do not establish adoption. Questioning
whether to adopt a rule remains uncertain.

"Agent read; no explicit user selection observed" describes the available record, not proof
that a person never selected the file outside it.

## Evidence and privacy

Each context records its own id, triggering prompt id, name/kind, recorded description,
selection, historical content and availability. The first captured version within the
turn is retained rather than replaced by later reads.

At most six contexts per triggering prompt are retained. Bodies over 100,000 characters are
left unavailable and counted as rejected contexts. Accepted bodies are redacted before
truncation to 6,000 characters. Final synthesis receives at most 20,000 characters of context
metadata/content, with eligible/omitted counts. Map chunks include their own context. For analysis, bodies of non-user-selected contexts are
omitted; their provenance remains visible, and the local report can retain their redacted
recorded excerpts.

Only explicitly selected recorded content can supply additional user-choice quotations.
Support belongs to the triggering conversation/period, not a new conversation. Automatic,
agent-selected and unknown contexts cannot supply user-claim quotes. Prompts distinguish
purpose, adoption, execution and outcomes. Lexical verification does not validate every
semantic inference.

Facts & evidence shows provenance separately from generated judgments. Quote exclusions hide
trigger/content excerpts. Custom-name exclusions hide the section and scrub known context
names from generated prose; project exclusions scrub known project names. Private atomic
writes, redaction and final output checks still apply.

## Compatibility and verification

Schema 26 stores purpose/selection/requirement contexts. Released schemas 8/14 and local
schemas 24/25 remain readable; old author fields are not interpreted or displayed. Render
cannot add new scores to old reports. Analysis 37 and pipeline 7 invalidate old caches; context content/provenance also affects chunk and frozen
experiment hashes.

Synthetic tests cover purpose metadata without authorship tracking, selection, recorded/error/
missing content, first-version retention, attachments, automatic rules, wrapped reads, quote
eligibility, privacy and report exclusions. Real-data smoke tests and free preflight exercise
extraction without new model calls.

An actual historical explicit skill request had its content inside a sequential exec wrapper.
The parser recovered the recorded body. This demonstrates recovery of a previously missed
requirement source, not calibrated ability scores. A new analysis and owner review are needed to judge the resulting report quality.

## Verification record: 2026-11-01

The final synthetic suite and type/lint/format gates pass. The real-data smoke suite passes
four files/four tests; preflight makes no LLM calls. A selected real-history preflight found
four explicit user selections, one with linked historical body content. Authorship is no
longer collected or used; it is not an assessment dimension. Counts depend on the selected history and
supported formats, not a completeness estimate.

A fictional provenance demonstration was rendered through the production renderer in English
and Traditional Chinese. It is explicitly labeled fictional and is not the owner's new score.
Previously generated personal reports remain unchanged; incorporating this evidence into
their judgments requires a new analysis.

The purpose-focused revision uses recorded descriptions to identify intended methods while keeping description-only material ineligible as user quotations or proof of executed requirements.
