# 04 · Codex adapter

## 目標

從使用者本機的 Codex 資料中，讀出真的是使用者親手輸入的 prompt，輸出 `Stream<PromptRecord>`。結構與 plan 03 相同，共用 `src/adapters/common/`。

## 資料位置與格式（已用真實資料確認過，2026-10，codex-cli 0.164.x）

根目錄：`$CODEX_HOME`，沒有設定的話用 `~/.codex`。

### 1. `sessions/YYYY/MM/DD/rollout-<時間>-<id>.jsonl`（主要來源）

每一行的外層是 `{ timestamp, ordinal, type, payload }`。會用到的：

```jsonc
// session 開頭的 metadata
{ "type": "session_meta", "payload": {
    "id": "…", "session_id": "…", "timestamp": "…", "cwd": "/Users/…",
    "originator": "codex_exec" | "codex_cli_rs" | "T3 Code" | …,
    "source": "exec" | "vscode" | "cli" | { "subagent": "…" },
    "cli_version": "0.164.0",
    "git": { "branch": "…", "commit_hash": "…", "repository_url": "…" }
} }

// 使用者訊息
{ "type": "response_item", "payload": {
    "type": "message", "role": "user",
    "content": [ { "type": "input_text", "text": "…" } | { "type": "input_image", … } ]
} }
```

其他 `type`（`event_msg`、`turn_context`、`token_usage_record`、`world_state`、`reasoning`、`custom_tool_call`…）全部略過。

### 2. `history.jsonl`（補充來源）

```jsonc
{ "session_id": "…", "ts": 1784658649, "text": "prompt 文字" }   // ts 是「秒」，不是毫秒
```

## 過濾規則

| 排除條件 | 原因 |
|---|---|
| `session_meta.payload.source` 是物件且有 `subagent` 欄位 → **整個 session 排除** | subagent 是 AI 自己發的指示 |
| `input_text` 以 `<environment_context>`、`<user_action>`、`<guardian_tool_descriptions>`、`<user_instructions>` 開頭 | Codex 自動注入的內容 |
| `input_text` 以 `# AGENTS.md instructions` 或 `# AGENTS` 開頭 | 自動注入的 AGENTS.md |
| 文字中含有 `[prompt-profile:analysis]` 標記 | 我們自己的分析呼叫 |

**`codex exec` 的 session 要特別處理**：真實資料中 `originator: "codex_exec"` 占了絕大多數，其中很多是其他工具（code review bot、自動化腳本）呼叫的，不是使用者親手輸入的。
- `origin`：`originator` 是其他 app（例如 T3 Code）→ `sdk`；否則 `source === "exec"` → `exec`；`vscode` / `cli` → `interactive`；其他 → `unknown`。`client` 存原始的 `originator` 值。
  - 判斷順序要寫清楚並測試：T3 Code 這類 app 有時也是透過 exec 模式執行，`originator` 比 `source` 更能代表「誰在打字」。
- MVP 預設**保留** `exec`，但在 stats 裡分開計數。plan 05 會再用啟發式規則過濾明顯是機器產生的 prompt。
- 若同一個 `input_text` 有多個區塊，把非注入的區塊用換行串接。

## 合併與去重

- 規則同 plan 03：**以 session 為單位**。`history.jsonl` 中 `session_id` 已經有 rollout 檔的紀錄整筆略過；只有找不到 rollout 檔的 session 才從 `history.jsonl` 補回。
- 一次 resume 可能把舊訊息重新寫進新的 rollout 檔：同一個 session 中，文字完全相同且 timestamp 相同的訊息只保留一筆。
- `PromptRecord.id`：`codex:${sessionId}:${ordinal}`；`history.jsonl` 來源用 `codex:${sessionId}:h${ts}`。

## 實作要求

- 放在 `src/adapters/codex/`，實作 plan 02 的 `SourceAdapter` 介面，並登記到 `src/adapters/registry.ts`。
- `ordinal` 欄位若不存在（舊版 Codex），改用該行在檔案中的行號。
- 遞迴尋找 `sessions/**/rollout-*.jsonl`；檔案可能有數百個，用有限的並行數量讀取（例如 8）。
- 寬鬆 Schema、壞行略過、資料夾不存在回傳空 Stream：規則同 plan 03。
- `src/adapters/registry.ts`：匯出全部 adapter 的陣列，以及 `readAll`：把各 adapter 的 Stream 合併。**排序交給 plan 05**（需要整批資料才能排序，不要在 Stream 層假裝能排序）。

## 測試

- `test/fixtures/codex/`：手寫的假 rollout 檔，涵蓋：一般互動 session、subagent session、exec session、各種注入內容、圖片、壞掉的行、秒為單位的 `history.jsonl`。
- table-driven 測試每一條過濾規則；snapshot 整個 fixture 目錄的輸出。
- `test/smoke/codex.test.ts`：同 plan 03 的規則。

## 驗收標準

- [ ] 所有測試通過；smoke test 印出各過濾規則排除的數量，以及各 `origin` 的筆數
- [ ] `readAll` 可以同時讀出兩種來源
