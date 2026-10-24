# Blind review: methodical-backend

Synthetic persona. Engine and model labels are removed; the order is shuffled.

## Profile A

**Headline:** You build backend systems through small, reviewable steps, with tests, explicit trade-offs, and a rollback plan close at hand.

**Archetype:** The Rollback Architect: You treat implementation as a sequence of decisions that should be explainable, testable, and reversible. Your prompts move from hypotheses and alternatives to tightly scoped changes, then to operational checks and durable documentation. Even a working solution still owes you evidence about concurrency, correctness, and production behavior.

### Traits

- **Deliberate scope control** (high): You keep changes small and make their boundaries explicit, giving yourself clear opportunities to inspect each step.
  - "Good plan. Let's start with step 1 only: the database migration."
  - "Now break the rollout into PR-sized steps."
  - "Now refactor in small commits, one concern per commit, and tell me the commit messages first."
- **Correctness needs proof** (high): You ask tests to establish behavior and failure guarantees, including the awkward cases around transactions and existing code.
  - "Keep it under 80 lines and add tests first."
  - "Add a test that proves the webhook is not written when the transaction rolls back."
  - "Before we refactor the invoice generator, write characterization tests that pin down the current behaviour."
- **Reasoning before repair** (high): You want a causal explanation or comparison before a fix earns your approval. The assistant serves as an investigation partner as well as an implementer.
  - "The test for concurrent requests is flaky. Can you explain why before changing anything?"
  - "We need to rotate the database credentials without downtime. Propose two approaches and compare them."
  - "Help me form hypotheses before we look at code."
- **Operational follow-through** (high): You carry work beyond implementation into verification, alerting, and recovery. Production readiness needs concrete checks.
  - "The runbook should include a verification step after each stage and a rollback section."
  - "Write the migration with CREATE INDEX CONCURRENTLY and a check that it is valid afterwards."
  - "Add alerting thresholds and explain how you chose them."
- **Decisions deserve a paper trail** (high): You turn technical reasoning into structured documents that other people can review and reuse.
  - "Go with the dual-credential approach. Write a runbook in docs/runbooks/rotate-db-creds.md."
  - "Document the decision in an ADR."
  - "Write a design doc for moving webhooks to an outbox pattern. Sections: context, goals, non-goals, design, alternatives, rollout."

### Dimensions

- **Small steps, explicit gates**: You establish a plan or baseline before changing behavior, then advance through narrowly scoped steps. Tests and rollback checks are part of the work itself, especially around migrations, transactions, and refactoring.
  - "Good plan. Let's start with step 1 only: the database migration."
  - "Before we refactor the invoice generator, write characterization tests that pin down the current behaviour."
  - "Add a test that proves the webhook is not written when the transaction rolls back."
- **Brief instructions, durable decisions**: You give concise directions with clear boundaries and specific output formats. You also ask for decisions and procedures to become reusable artifacts, from ADRs to runbooks and issue templates.
  - "Write the migration and a rollback. Do not touch the handlers yet."
  - "Document the decision in an ADR."
  - "Turn the checklist into a GitHub issue template."
- **Transactional backend focus**: Your requests center on Go, PostgreSQL, and billing or ledger behavior. You engage directly with locking, database constraints, transaction isolation, and domain edge cases rather than leaving correctness implicit.
  - "Review this Go function for race conditions. Explain your reasoning step by step."
  - "Use a deferred constraint trigger. Write the SQL and property-based tests with rapid."
  - "Run through the edge cases again: leap years, currency rounding, negative line items."
- **Production behavior matters**: You repeatedly focus on safe operations: rollout verification, delivery guarantees, observability, and rollback. Performance claims also need something measurable, such as metrics or benchmarks.
  - "The runbook should include a verification step after each stage and a rollback section."
  - "Add a section about exactly-once vs at-least-once delivery and how consumers should deduplicate."
  - "Let's keep the mutex. Add a benchmark so we can compare later."
- **Understand before choosing**: You use the assistant to investigate mechanisms and compare alternatives before committing to changes. Your learning questions are concrete: why a concurrent test flakes, how isolation levels differ, or what a synchronization choice costs.
  - "The test for concurrent requests is flaky. Can you explain why before changing anything?"
  - "What are the trade-offs between using a mutex here and a channel?"
  - "Explain how this behaves under READ COMMITTED versus SERIALIZABLE."

### Fun facts

- Your 36 prompts span 11 sessions: compact conversations with plenty of follow-through.
- Your median prompt length is 85 characters. Scope control applies to sentences, too.
- Your busiest hours are tied: 09:00 and 10:00 each contain 13 prompts in Europe/Berlin time.
- Your project tally is 29 prompts for billing-service and 7 for ledger.
- Your recorded prompts are 100% English.

Coverage: 30 quotes kept, 0 dropped.

## Profile B

**Headline:** You're a careful payments backend engineer who asks for a plan, then tests, then a diff, and only then lets the AI write code.

**Archetype:** The Ledger Keeper: You treat an AI assistant like a sharp colleague in a design review, not a code vending machine. Every change starts with a plan, a list of risks or two approaches to compare. Then it moves forward one migration, one commit and one PR-sized step at a time, with tests up front and a rollback section close by. You work on money systems such as idempotency keys, outbox webhooks and double-entry ledgers, so you get suspicious of anything that 'probably works' and want a test that proves it.

### Traits

- **Plan-gated execution** (high): No code until there's a plan, and then only one step at a time.
  - "Before writing any code, outline a plan for adding idempotency keys to the payments API. List the risks."
  - "Now break the rollout into PR-sized steps."
  - "Propose two approaches and compare them."
  - "refactor in small commits, one concern per commit, and tell me the commit messages first."
- **Tests as proof** (high): You want tests first, and you want them to prove specific properties, including rollbacks and edge cases.
  - "Keep it under 80 lines and add tests first."
  - "Add a test that proves the webhook is not written when the transaction rolls back."
  - "Before we refactor the invoice generator, write characterization tests that pin down the current behaviour."
- **Explain-before-change** (high): You want the AI's reasoning and trade-offs before you let it change anything.
  - "Can you explain why before changing anything?"
  - "Explain your reasoning step by step."
  - "Add alerting thresholds and explain how you chose them."
- **Production paranoia (the healthy kind)** (high): Rollbacks, verification steps, metrics and alerting are part of the work from the start, not an afterthought.
  - "The runbook should include a verification step after each stage and a rollback section."
  - "What observability do we need before turning on the ledger in production? Make a checklist."
  - "Write the migration with CREATE INDEX CONCURRENTLY and a check that it is valid afterwards."
- **Tight scope control** (medium): You fence off the files the AI may touch and review changes as diffs.
  - "Do not touch the handlers yet."
  - "Show me the diff only."
- **Paper-trail builder** (medium): You record decisions and changes in ADRs, design docs, changelogs and issue templates.
  - "Document the decision in an ADR."
  - "Write a design doc for moving webhooks to an outbox pattern."
  - "Write a short summary for the changelog."

### Dimensions

- **Plan first, then small safe steps**: You ask for a plan, competing approaches or hypotheses before any code exists. Then you approve one step at a time. Tests come first, sometimes as characterization tests that lock in current behaviour before a refactor. You keep the scope tight by saying what the AI may not touch and asking to see only the diff.
  - "Before writing any code, outline a plan for adding idempotency keys to the payments API. List the risks."
  - "Let's start with step 1 only: the database migration."
  - "Tests first."
  - "Do not touch the handlers yet."
  - "refactor in small commits, one concern per commit, and tell me the commit messages first."
- **Short commands, plus a demand for reasons**: Your prompts are short and imperative, about 85 characters at the median. You often open with a quick 'Good.' or 'Agreed' before the next instruction. You also keep asking the AI to explain itself: the trade-offs, the step-by-step reasoning and how it picked its thresholds. You use it as a reasoning partner as much as a typist.
  - "Agreed, use SELECT ... FOR UPDATE."
  - "Can you explain why before changing anything?"
  - "What are the trade-offs between using a mutex here and a channel?"
  - "Add alerting thresholds and explain how you chose them."
- **Go + PostgreSQL for money systems**: You write backend Go with plain sqlc queries, and you say no ORM. Your PostgreSQL knowledge goes deep: row locks, deferred constraint triggers, isolation levels and concurrent index builds. You test with testcontainers and rapid. Your work lives in billing-service and ledger, so you deal with idempotency, outbox delivery and double-entry bookkeeping.
  - "Use a deferred constraint trigger. Write the SQL and property-based tests with rapid."
  - "Explain how this behaves under READ COMMITTED versus SERIALIZABLE."
  - "Please don't use an ORM here, plain sqlc queries."
  - "exactly-once vs at-least-once delivery and how consumers should deduplicate"
- **Operational safety and written decisions**: You care about what happens after the merge: zero-downtime rotations, verification steps, rollback sections, metrics and alerting. You want decisions written down in ADRs, design docs, runbooks and changelogs. You also think about the team side, such as clear PR descriptions and choosing reviewers based on risk.
  - "The runbook should include a verification step after each stage and a rollback section."
  - "Document the decision in an ADR."
  - "Please add a metric for idempotent replays."
  - "Suggest which reviewers should look at which files, based on risk."
- **Hypotheses before you open the code**: When something is slow, you start by forming hypotheses and asking for the reasoning behind each fix, not by reading code. You add benchmarks so later comparisons are based on numbers. The next step could be letting the AI take slightly bigger, less supervised steps on low-risk work.
  - "Help me form hypotheses before we look at code."
  - "Which index would you add and why?"
  - "Add a benchmark so we can compare later."

### Fun facts

- Your correction rate is 0%. When every step is planned and approved first, there isn't much to correct.
- You sent all of your prompts Monday through Thursday. Friday, Saturday and Sunday stayed at zero, which fits someone who doesn't deploy on Fridays.
- 9:00 and 10:00 tie for your busiest hours, with 13 prompts each. Nothing shows up after the 14:00 hour.
- 29 of your 36 prompts went to billing-service. The ledger got the other 7.
- Your longest streak is 2 days, spread across 11 sessions. Steady and measured, like your migrations.

Coverage: 38 quotes kept, 0 dropped.

## Profile C

**Headline:** You treat the AI like a careful junior on a payments team: plan first, write tests before code, stick to step 1, and explain yourself before you touch anything.

**Archetype:** The Ledger Guardian: You build billing and ledger systems in Go and PostgreSQL, and you work as though every rounding error will turn up in an audit. Your sessions follow a steady routine. You ask for a plan and its risks, approve with a short "Good plan.", then hand out one small step at a time and say clearly what must not be touched. You want characterization tests in place before a refactor, a rollback test for every write path, and an ADR or runbook to record what was decided. It isn't flashy, and that seems to be on purpose. Your goal is for nothing interesting to happen in production.

### Traits

- **Plan-first** (high): You want plans, hypotheses or two competing approaches on the table before any code is written.
  - "Before writing any code, outline a plan for adding idempotency keys to the payments API. List the risks."
  - "Help me form hypotheses before we look at code."
  - "Propose two approaches and compare them."
- **Scope fencer** (high): You hand out one small step at a time and say clearly what the AI must not touch.
  - "Let's start with step 1 only: the database migration."
  - "Do not touch the handlers yet."
  - "Now break the rollout into PR-sized steps."
- **Test-first skeptic** (high): For you, tests are how claims get proven: before a refactor, for rollbacks, and as benchmarks to compare against later.
  - "Add a test that proves the webhook is not written when the transaction rolls back."
  - "Before we refactor the invoice generator, write characterization tests that pin down the current behaviour."
  - "Add a benchmark so we can compare later."
- **Explain-before-edit** (medium): You ask for the reasoning before you accept a change.
  - "Can you explain why before changing anything?"
  - "Explain your reasoning step by step."
  - "Add alerting thresholds and explain how you chose them."
- **Operational documentarian** (high): You make sure decisions and operations end up in ADRs, runbooks, design docs and templates.
  - "Document the decision in an ADR."
  - "Sections: context, goals, non-goals, design, alternatives, rollout."
  - "The runbook should include a verification step after each stage and a rollback section."

### Dimensions

- **Plan, scope, test, repeat**: You start with plans, hypotheses or competing approaches before any code gets written. After that you break the work into PR-sized steps and fence off what the AI may change. You write tests first: characterization, property-based and rollback tests, plus benchmarks so you have a baseline to compare against later. You even want the commit messages agreed before the commits exist.
  - "Before writing any code, outline a plan for adding idempotency keys to the payments API. List the risks."
  - "Do not touch the handlers yet."
  - "refactor in small commits, one concern per commit, and tell me the commit messages first."
  - "Keep it under 80 lines and add tests first."
- **Terse, imperative, show your work**: Your prompts are short, direct instructions with clear constraints. A typical one is about 85 characters. You approve in a word or two and go straight to the next instruction. You keep asking the AI to explain its reasoning before it changes anything, so you see the diagnosis before the fix.
  - "Agreed, use SELECT ... FOR UPDATE. Show me the diff only."
  - "Can you explain why before changing anything?"
  - "Add alerting thresholds and explain how you chose them."
- **Go, Postgres and money**: You're a backend engineer working in Go and PostgreSQL, and you're comfortable with isolation levels, deferred constraint triggers and concurrent index builds. Your toolkit includes sqlc (and pointedly no ORM), testcontainers and rapid. The domain is billing, invoicing and ledgers, where leap years and currency rounding are real problems.
  - "Explain how this behaves under READ COMMITTED versus SERIALIZABLE."
  - "Please don't use an ORM here, plain sqlc queries."
  - "Run through the edge cases again: leap years, currency rounding, negative line items."
- **Reliability you can write down**: You keep returning to idempotency, delivery guarantees, zero-downtime operations and observability. You also care about the written record around the code: ADRs, runbooks with rollback sections, PR descriptions, changelogs and issue templates.
  - "Add a section about exactly-once vs at-least-once delivery and how consumers should deduplicate."
  - "The runbook should include a verification step after each stage and a rollback section."
  - "Document the decision in an ADR."
  - "What observability do we need before turning on the ledger in production? Make a checklist."
- **From code to team process**: Your recent prompts spread past implementation into review strategy, how convincing a PR is, and checklists the team can reuse. It looks like you're scaling your rigor beyond your own commits to the people around you. One possible next step is to let the AI take bigger steps once the tests are in place to catch mistakes.
  - "Suggest which reviewers should look at which files, based on risk."
  - "Review my PR description for clarity. Is the testing section convincing?"
  - "Turn the checklist into a GitHub issue template."

### Fun facts

- Your correction rate is 0%. You never had to say "no, that's wrong" because you never gave the AI enough room to get it wrong.
- 26 of your 36 prompts arrived between 9:00 and 11:00. You keep your coding to office hours.
- You sent zero prompts on Saturdays or Sundays, and Tuesday was your busiest day with 13.
- 29 of your prompts went to billing-service and 7 to ledger. Your attention went to the money.
- Your longest streak was just 2 days. You work in short, deliberate bursts, not marathons.

Coverage: 32 quotes kept, 0 dropped.

## Profile D

**Headline:** You build backend changes in deliberate steps, asking for proof, operational safeguards, and a written rationale before moving on.

**Archetype:** The Rollback Architect: You approach backend engineering as a sequence of decisions that should be explainable, testable, and reversible. Your prompts move from plans and hypotheses to tightly scoped changes, then to verification and documentation. Even a successful implementation still owes you an answer about concurrency, production behavior, and what happens when something fails.

### Traits

- **Deliberate scope setter** (high): You keep work reviewable by defining the next step and limiting each change to a clear concern.
  - "Good plan. Let's start with step 1 only: the database migration."
  - "Now break the rollout into PR-sized steps."
  - "Good. Now refactor in small commits, one concern per commit, and tell me the commit messages first."
- **Failure-case investigator** (high): You ask tests to prove behavior at the boundaries, including migration behavior, rollbacks, and existing behavior before refactoring.
  - "Now write integration tests for the migration using testcontainers."
  - "Add a test that proves the webhook is not written when the transaction rolls back."
  - "Before we refactor the invoice generator, write characterization tests that pin down the current behaviour."
- **Explanation before intervention** (high): You want a causal account or explicit trade-off before accepting a fix or design choice.
  - "The test for concurrent requests is flaky. Can you explain why before changing anything?"
  - "Help me form hypotheses before we look at code."
  - "What are the trade-offs between using a mutex here and a channel?"
- **Operational safeguard builder** (high): You treat verification, rollback paths, and observability as part of delivering a change.
  - "The runbook should include a verification step after each stage and a rollback section."
  - "Write the migration with CREATE INDEX CONCURRENTLY and a check that it is valid afterwards."
  - "What observability do we need before turning on the ledger in production? Make a checklist."
- **Documentation finisher** (high): You carry work into runbooks, decision records, and reusable templates so its reasoning survives the conversation.
  - "Write a runbook in docs/runbooks/rotate-db-creds.md."
  - "Document the decision in an ADR."
  - "Turn the checklist into a GitHub issue template."

### Dimensions

- **Small steps, explicit checks**: You plan before implementing and keep each change bounded. You ask for tests that establish behavior and expose failure cases, then split execution into reviewable steps.
  - "Good plan. Let's start with step 1 only: the database migration."
  - "Before we refactor the invoice generator, write characterization tests that pin down the current behaviour."
  - "Now break the rollout into PR-sized steps."
- **Concise and scoped**: You give direct instructions with clear boundaries and concrete deliverables. You specify both the scope of the work and the format of the response, while also checking whether documentation will convince a reviewer.
  - "Write the migration and a rollback. Do not touch the handlers yet."
  - "Agreed, use SELECT ... FOR UPDATE. Show me the diff only."
  - "Review my PR description for clarity. Is the testing section convincing?"
- **Go, SQL, and guarantees**: Your observed work centers on Go and PostgreSQL backends, particularly billing and ledger behavior. You specify database mechanisms and testing tools directly, with close attention to races, constraints, and transaction boundaries.
  - "Review this Go function for race conditions."
  - "I want to model double-entry bookkeeping in PostgreSQL."
  - "Use a deferred constraint trigger. Write the SQL and property-based tests with rapid."
- **Correctness in production**: You repeatedly explore concurrency, delivery semantics, and safe operational changes. You also want metrics and benchmarks that make behavior measurable after the code ships.
  - "Add a section about exactly-once vs at-least-once delivery and how consumers should deduplicate."
  - "We need to rotate the database credentials without downtime. Propose two approaches and compare them."
  - "Let's keep the mutex. Add a benchmark so we can compare later."
- **Reasoning that carries forward**: You use the assistant to examine explanations and trade-offs before making changes. You turn decisions and procedures into durable artifacts, suggesting a learning style built around reasoning you can reuse; these prompts do not establish how your skills changed over time.
  - "The test for concurrent requests is flaky. Can you explain why before changing anything?"
  - "Explain how this behaves under READ COMMITTED versus SERIALIZABLE."
  - "Turn the checklist into a GitHub issue template."

### Fun facts

- Your 36 recorded prompts all came from interactive Claude Code sessions.
- Your median prompt length was 85 characters: compact instructions are your usual format.
- Your busiest hours were 09:00 and 10:00 in Europe/Berlin, tied at 13 prompts each.
- Your project tally was 29 prompts for billing-service and 7 for ledger.
- Your recorded language mix was 100% English.

Coverage: 30 quotes kept, 0 dropped.
