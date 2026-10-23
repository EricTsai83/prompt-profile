# 02 · Domain 與 Schema

## 目標

用 Effect Schema 定義整個系統共用的資料格式。之後所有模組都依賴這些格式，**`Profile` 是產品的核心格式**，要謹慎設計並加上版本號。

`src/domain/` 不 import 專案中任何其他目錄。

## 序列化慣例

- 所有時間在 JSON 中都是 **ISO 8601 UTC 字串**；程式內部用 Effect 的 `DateTime.Utc`（用 Schema 的字串 ↔ DateTime 轉換，不要用 JS `Date`）。
- 所有「比例」都是 0–1 的小數，不是百分比。
- 語言代碼：`"zh-TW" | "en"`（明確指定繁體中文，避免 LLM 輸出簡體）。

## 檔案

`src/domain/` 下：

### `PromptRecord.ts`：adapter 的統一輸出

```ts
PromptRecord {
  id: string              // `${source}:${sessionId}:${uuid 或 ordinal}`，要穩定（快取與 evidence 都會用到）
  source: SourceId        // "claude-code" | "codex"（見下方）
  sessionId: string
  timestamp: DateTime.Utc
  project: string | null  // cwd 完整路徑（只在本機使用，送 LLM 前只留最後一層，見 plan 05）
  gitBranch: string | null
  text: string            // 使用者輸入的原文（尚未遮蔽）
  hasImage: boolean
  origin: "interactive" | "sdk" | "exec" | "unknown"  // 這筆 prompt 從哪種介面來
  client: string | null   // 原始的用戶端標記，例如 Claude 的 `entrypoint`、Codex 的 `originator`（"T3 Code"、"codex_exec"…），給 stats 與除錯用
}
```

`SourceId` 定義成一個常數陣列再推導出型別（`const SOURCE_IDS = ["claude-code", "codex"] as const`），新增來源時只改這裡與 `adapters/registry.ts`。

### `SourceAdapter.ts`：所有 adapter 共用的介面

```ts
interface SourceAdapter {
  readonly id: SourceId
  readonly displayName: string                    // "Claude Code"
  readonly locations: Effect<string[]>            // 會去哪些路徑找（錯誤訊息要顯示）
  readonly read: Stream<PromptRecord, never>      // 找不到資料 → 空 Stream；壞資料 → 略過並計數
  readonly diagnostics: Effect<AdapterDiagnostics> // 讀完後各過濾規則排除了幾筆、壞行幾行
}
```

把介面放在 domain，plan 03 / 04 實作，plan 09 透過 registry 取得全部 adapter。之後新增 Gemini CLI、opencode 等來源只需要新增一個實作。

### `Stats.ts`：統計結果（plan 05 產生）

```ts
Stats {
  window: { since: DateTime.Utc | null, until: DateTime.Utc }  // 分析範圍（--since）
  timezone: string                  // 例如 "Asia/Taipei"，計算時間統計時使用
  totalPrompts: number              // 範圍內、通過 adapter 過濾的 prompt 數（清理前）
  analyzedPrompts: number           // 清理後的 prompt 數
  totalSessions: number
  bySource: Record<SourceId, number>
  byOrigin: Record<"interactive" | "sdk" | "exec" | "unknown", number>
  dateRange: { from: DateTime.Utc, to: DateTime.Utc }   // 實際有資料的第一筆與最後一筆
  activeDays: number
  hourHistogram: number[24]         // 依 timezone
  weekdayHistogram: number[7]       // 0 = 星期一
  promptLength: { median: number, p90: number }   // 單位：字元（清理後）
  languageMix: { zh: number, en: number, mixed: number }   // 比例，總和為 1
  topProjects: { name: string, count: number }[]  // 最多 5 個，只放資料夾名稱，不放完整路徑
  topSlashCommands: { name: string, count: number }[]   // 最多 5 個；沒有資料時為空陣列
  correctionRate: number            // 糾正 AI 的 prompt 比例
  imageRate: number
  longestStreakDays: number
  latestTime: string | null         // 最晚的工作時間，例如 "03:12"；「一天」以 05:00 為分界，見 plan 05
}
```

### `Profile.ts`：最終側寫（核心格式）

```ts
Profile {
  schemaVersion: 1
  generatedAt: DateTime.Utc
  engine: { runner: "claude-code" | "codex", model: string | null, analysisVersion: string }
  language: "zh-TW" | "en"
  coverage: Coverage
  headline: string                  // 一句話描述這個人
  archetype: { name: string, description: string }   // 例如「深夜架構師」
  dimensions: Dimension[]           // 固定 5 個，每個 key 剛好一次
  traits: Trait[]                   // 3–6 個最鮮明的特質
  funFacts: string[]                // 給圖卡用的有趣事實（只能使用 stats 中的數字）
  stats: Stats
}

Coverage {                          // 由程式填入，不由 LLM 產生；報告用來誠實說明分析範圍
  chunksTotal: number
  chunksAnalyzed: number
  chunksFromCache: number
  chunksFailed: number
  sampled: boolean                  // 是否因為超過上限而抽樣
  sessionsAnalyzed: number
  promptsAnalyzed: number
  evidenceKept: number
  evidenceDropped: number
}

Dimension {
  key: "work_style" | "communication" | "tech_profile" | "interests" | "growth"
  title: string
  summary: string
  evidence: Evidence[]              // 至少 1 筆（驗證後不足時，summary 保留但標記為證據不足，見 plan 07）
}

Trait {
  name: string
  description: string
  confidence: "high" | "medium" | "low"
  evidence: Evidence[]              // 至少 2 筆
}

Evidence {
  promptId: string                  // 對應 PromptRecord.id
  quote: string                     // 已遮蔽的原文節錄，最多 200 字
}
```

`profile.json` 由 `encode` 產生、由 `decode` 讀回（`render` 子指令會用到）。`schemaVersion` 不認得時要回傳明確的錯誤（`UnsupportedProfileVersion`），不要嘗試猜測。

### `ChunkObservations.ts`：分析的中間結果（plan 07 使用）

```ts
ChunkObservations {
  chunkId: string
  observations: { dimension: Dimension["key"], claim: string, evidence: Evidence[] }[]
}
```

## 給 LLM 用的 Schema（`src/domain/llm/`）

**內部格式與「LLM 輸出格式」分開定義**，兩者之間用純函式轉換。理由：

- Codex（OpenAI structured outputs 的 strict 模式）對 JSON Schema 有限制；Claude 的 `--json-schema` 也不保證支援所有關鍵字。
- 內部格式可以自由演進，不受 LLM 限制。

LLM Schema 只能使用**兩邊都支援的最小子集**：

- 每個 object 都是 `additionalProperties: false`，**所有屬性都列在 `required`**；可以沒有的值用 `T | null`。
- 只用 `string`、`number`、`boolean`、`array`、`object`、`enum`、`null`。
- **不使用** `format`、`pattern`、`minLength` / `maxLength`、`minItems` / `maxItems`、`minimum` / `maximum`、`oneOf`、`$ref`（產生器若輸出 `$defs` / `$ref`，要展開成 inline）。
- 長度、數量等限制寫在 prompt 的說明中，並在 decode 成內部格式時檢查（例如 quote 超過 200 字就截斷，trait 不足 3 個就由 plan 07 處理）。

需要的 LLM Schema：

| LLM Schema | 轉換成 | 由程式補上的欄位 |
|---|---|---|
| `LlmChunkObservations` | `ChunkObservations` | `chunkId` |
| `LlmProfileDraft` | `Profile` | `schemaVersion`、`generatedAt`、`engine`、`language`、`coverage`、`stats` |

提供 `toLlmJsonSchema(schema)`：產生 JSON Schema，並**在測試中檢查**產出結果符合上面的子集規則（寫一個小的 validator 走訪整個 JSON Schema 樹，遇到禁用關鍵字就失敗）。這樣之後有人改 Schema 時，不會不小心破壞相容性。

- 先確認 Effect 4 產生 JSON Schema 的 API 名稱（查 `node_modules/effect/dist/` 的 `.d.ts`）。

## 要求

- `Evidence.promptId` 必須是真的存在的 id：這個驗證放在 plan 07，不在 Schema 層。
- 測試用的 sample 資料（`test/fixtures/profile.sample.zh-TW.json`、`profile.sample.en.json`）在這個 plan 一起建立，plan 08 會用到。

## 驗收標準

- [ ] 每個 Schema 都有「合法資料可以 decode」與「不合法資料會失敗」的測試
- [ ] `Profile` 可以 encode → JSON → decode 回到相同的值（round-trip 測試）
- [ ] 不認得的 `schemaVersion` 會得到 `UnsupportedProfileVersion`
- [ ] `LlmChunkObservations`、`LlmProfileDraft` 可以轉出 JSON Schema，通過子集檢查，並有 snapshot 測試
- [ ] `pnpm typecheck && pnpm lint && pnpm test` 全過
