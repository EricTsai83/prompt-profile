# 02 · Domain and Schemas

## Goal

Define the data formats shared by the whole system with Effect Schema. Every later module depends on these formats. **`Profile` is the product's core format**: design it carefully and give it a version number.

`src/domain/` imports no other directory in the project.

## Serialization conventions

- All times are **ISO 8601 UTC strings** in JSON; internally use Effect's `DateTime.Utc` (via a Schema string ↔ DateTime transformation, not the JS `Date`).
- All "ratios" are decimals between 0 and 1, not percentages.
- Language codes: `"zh-TW" | "en"` (Traditional Chinese is specified explicitly so the LLM does not output Simplified Chinese). (Removed later: the product is English-only.)

## Files

Under `src/domain/`:

### `PromptRecord.ts`: the unified adapter output

```ts
PromptRecord {
  id: string              // `${source}:${sessionId}:${uuid or ordinal}`, must be stable (used by the cache and by evidence)
  source: SourceId        // "claude-code" | "codex" (see below)
  sessionId: string
  timestamp: DateTime.Utc
  project: string | null  // full cwd path (used locally only; only the last segment is kept before sending to the LLM, see plan 05)
  gitBranch: string | null
  text: string            // the user's original input (not yet redacted)
  hasImage: boolean
  origin: "interactive" | "sdk" | "exec" | "unknown"  // which kind of interface this prompt came from
  client: string | null   // the raw client marker, e.g. Claude's `entrypoint`, Codex's `originator` ("T3 Code", "codex_exec"…), for stats and debugging
}
```

`SourceId` is defined as a constant array from which the type is derived (`const SOURCE_IDS = ["claude-code", "codex"] as const`); adding a source only touches this and `adapters/registry.ts`.

### `SourceAdapter.ts`: the interface shared by all adapters

```ts
interface SourceAdapter {
  readonly id: SourceId
  readonly displayName: string                    // "Claude Code"
  readonly locations: Effect<string[]>            // which paths are searched (shown in error messages)
  readonly read: Stream<PromptRecord, never>      // no data → empty Stream; bad data → skipped and counted
  readonly diagnostics: Effect<AdapterDiagnostics> // after reading: how many records each filter rule excluded, how many bad lines
}
```

The interface lives in domain, plans 03 / 04 implement it, and plan 09 obtains all adapters through the registry. Adding sources such as Gemini CLI or opencode later only requires a new implementation.

### `Stats.ts`: statistics (produced by plan 05)

```ts
Stats {
  window: { since: DateTime.Utc | null, until: DateTime.Utc }  // analysis window (--since)
  timezone: string                  // e.g. "Asia/Taipei", used for time statistics
  totalPrompts: number              // prompts in the window that passed adapter filtering (before cleaning)
  analyzedPrompts: number           // prompts after cleaning
  totalSessions: number
  bySource: Record<SourceId, number>
  byOrigin: Record<"interactive" | "sdk" | "exec" | "unknown", number>
  dateRange: { from: DateTime.Utc, to: DateTime.Utc }   // the actual first and last records
  activeDays: number
  hourHistogram: number[24]         // by timezone
  weekdayHistogram: number[7]       // 0 = Monday
  promptLength: { median: number, p90: number }   // unit: characters (after cleaning)
  languageMix: { zh: number, en: number, mixed: number }   // ratios, summing to 1
  topProjects: { name: string, count: number }[]  // at most 5, folder name only, never the full path
  topSlashCommands: { name: string, count: number }[]   // at most 5; empty array when there is no data
  correctionRate: number            // share of prompts that correct the AI
  imageRate: number
  longestStreakDays: number
  latestTime: string | null         // latest working time, e.g. "03:12"; a "day" is split at 05:00, see plan 05
}
```

### `Profile.ts`: the final profile (core format)

```ts
Profile {
  schemaVersion: 1
  generatedAt: DateTime.Utc
  engine: { runner: "claude-code" | "codex", model: string | null, analysisVersion: string }
  language: "zh-TW" | "en"
  coverage: Coverage
  headline: string                  // one sentence describing the person
  archetype: { name: string, description: string }   // e.g. "The Midnight Architect"
  dimensions: Dimension[]           // exactly 5, each key exactly once
  traits: Trait[]                   // the 3–6 most distinctive traits
  funFacts: string[]                // fun facts for the card (may only use numbers from stats)
  stats: Stats
}

Coverage {                          // filled in by code, not produced by the LLM; the report uses it to state the analysis scope honestly
  chunksTotal: number
  chunksAnalyzed: number
  chunksFromCache: number
  chunksFailed: number
  sampled: boolean                  // whether sampling was applied because a limit was exceeded
  sessionsAnalyzed: number
  promptsAnalyzed: number
  evidenceKept: number
  evidenceDropped: number
}

Dimension {
  key: "work_style" | "communication" | "tech_profile" | "interests" | "growth"
  title: string
  summary: string
  evidence: Evidence[]              // at least 1 (if too few remain after verification, the summary is kept but marked as lacking evidence, see plan 07)
}

Trait {
  name: string
  description: string
  confidence: "high" | "medium" | "low"
  evidence: Evidence[]              // at least 2
}

Evidence {
  promptId: string                  // matches PromptRecord.id
  quote: string                     // redacted excerpt of the original text, at most 200 characters
}
```

(Changed later: the product is English-only, so the `language` field was removed and `schemaVersion` became 2.)

`profile.json` is produced by `encode` and read back by `decode` (used by the `render` subcommand). An unrecognized `schemaVersion` must return an explicit error (`UnsupportedProfileVersion`); do not try to guess.

### `ChunkObservations.ts`: intermediate analysis results (used by plan 07)

```ts
ChunkObservations {
  chunkId: string
  observations: { dimension: Dimension["key"], claim: string, evidence: Evidence[] }[]
}
```

## Schemas for the LLM (`src/domain/llm/`)

**The internal format and the "LLM output format" are defined separately**, with pure functions converting between them. Reasons:

- Codex (OpenAI structured outputs in strict mode) restricts JSON Schema; Claude's `--json-schema` is not guaranteed to support every keyword either.
- The internal format can evolve freely without being constrained by the LLMs.

The LLM Schema may only use **the minimal subset both sides support**:

- Every object has `additionalProperties: false` and **lists every property in `required`**; values that may be absent use `T | null`.
- Only `string`, `number`, `boolean`, `array`, `object`, `enum`, `null`.
- **Do not use** `format`, `pattern`, `minLength` / `maxLength`, `minItems` / `maxItems`, `minimum` / `maximum`, `oneOf`, `$ref` (if the generator emits `$defs` / `$ref`, inline them).
- Length and count limits are stated in the prompt instructions and checked when decoding into the internal format (e.g. quotes over 200 characters are truncated; fewer than 3 traits is handled by plan 07).

Required LLM Schemas:

| LLM Schema | Converted to | Fields filled in by code |
|---|---|---|
| `LlmChunkObservations` | `ChunkObservations` | `chunkId` |
| `LlmProfileDraft` | `Profile` | `schemaVersion`, `generatedAt`, `engine`, `language`, `coverage`, `stats` |

Provide `toLlmJsonSchema(schema)`: it produces a JSON Schema, and **a test checks** the output against the subset rules above (write a small validator that walks the whole JSON Schema tree and fails on any forbidden keyword). This way nobody can accidentally break compatibility when changing a Schema later.

- First confirm the name of Effect 4's JSON Schema generation API (check the `.d.ts` files in `node_modules/effect/dist/`).

## Requirements

- `Evidence.promptId` must be an id that really exists: this check lives in plan 07, not in the Schema layer.
- The sample test data (`test/fixtures/profile.sample.zh-TW.json`, `profile.sample.en.json`) is created in this plan; plan 08 uses it. (Removed later: the product is English-only.)

## Acceptance criteria

- [ ] Every Schema has tests for "valid data decodes" and "invalid data fails"
- [ ] `Profile` can go encode → JSON → decode back to the same value (round-trip test)
- [ ] An unrecognized `schemaVersion` yields `UnsupportedProfileVersion`
- [ ] `LlmChunkObservations` and `LlmProfileDraft` can be converted to JSON Schema, pass the subset check, and have snapshot tests
- [ ] `pnpm typecheck && pnpm lint && pnpm test` all pass
