# 03 · Claude Code adapter

## 目標

從使用者本機的 Claude Code 資料中，讀出**真的是使用者親手輸入的 prompt**，輸出 `Stream<PromptRecord>`。

## 資料位置與格式（已用真實資料確認過，2026-10，Claude Code 2.1.x）

根目錄：`$CLAUDE_CONFIG_DIR`，沒有設定的話用 `~/.claude`。

### 1. `projects/<編碼後的專案路徑>/<sessionId>.jsonl`（主要來源）

每一行是一個事件。只看 `type === "user"` 的行：

```jsonc
{
  "type": "user",
  "uuid": "…", "parentUuid": "…" | null,
  "sessionId": "…", "timestamp": "2026-…Z",
  "cwd": "/Users/…/project", "gitBranch": "main", "version": "2.1.309",
  "isSidechain": false,
  "entrypoint": "cli" | "sdk-ts" | "sdk-cli",
  "promptSource": "system" | "sdk" | undefined,
  "turnOrigin": "task_notification" | "sdk" | "scheduled" | "peer" | undefined,
  "message": { "role": "user", "content": "字串" | [ { "type": "text" | "tool_result" | "image", … } ] }
}
```

其他 `type`（`assistant`、`attachment`、`api-request`、`ai-title`、`mode`、`queue-operation`…）全部略過。

### 2. `history.jsonl`（補充來源）

```jsonc
{ "display": "prompt 文字", "pastedContents": {}, "timestamp": 1774954817129, "project": "/Users/…", "sessionId": "…" }
```

只有互動式 CLI 的輸入。用來補回 `projects/` 裡已經被刪掉的舊 session（Claude Code 預設會清掉 30 天前的 session 檔）。

注意：`display` 不是原文。貼上的長文字會變成 `[Pasted text #1 +42 lines]`，原文在 `pastedContents` 裡；斜線指令（`/clear`、`/model`…）也會出現在這裡。

## 過濾規則（哪些不是使用者親手寫的）

在真實資料中，`type: user` 且 content 為字串的紀錄約有 3,600 筆，其中**只有約 1/3 是真的人寫的**。必須排除：

| 排除條件 | 原因 |
|---|---|
| `isSidechain === true` | subagent 內部的對話 |
| `promptSource === "system"` 或 `turnOrigin === "task_notification"` | 系統自動送出的通知 |
| content 以 `<task-notification>`、`<local-command-caveat>`、`<local-command-stdout>`、`<command-name>`、`<system-reminder>` 開頭 | 工具或系統產生的內容 |
| content 是陣列且只包含 `tool_result` | 工具回傳結果，不是 prompt |
| 文字中含有 `[prompt-profile:analysis]` 標記 | **我們自己送出的分析 prompt**（見 plan 06），避免分析到自己 |

保留：
- content 為字串，或陣列裡 `type: "text"` 的部分（多個 text 用換行串接）。
- 陣列裡有 `type: "image"` → `hasImage: true`。
- `origin`：`entrypoint === "cli"` → `interactive`；`sdk-*` → `sdk`；其他 → `unknown`。`client` 存原始的 `entrypoint` 值。
- **`sdk` 來源一定要保留**：透過 T3 Code、Conductor 等桌面 app 使用 Claude 的人，親手輸入的 prompt 全部都是 `entrypoint: "sdk-ts"`。但這類 app 也會讓 AI 開子任務（例如 orchestrator 建立的 child thread），那些 prompt 是 AI 寫的。MVP 不在 adapter 判斷，交給 plan 05 的篩選規則處理，adapter 只要正確填好 `origin` 與 `client`。
- `<command-name>/xxx</command-name>` 這類 slash command 不當作 prompt，但**記錄指令名稱**給 stats 使用（例如最常用的 slash command）。可以先在 PromptRecord 之外另外輸出，或留到之後再做，在 PR 中說明。

## 合併與去重

- **以 session 為單位去重**：`history.jsonl` 中，`sessionId` 已經有對應 `projects/**/<sessionId>.jsonl` 的紀錄，**整筆略過**（不用比對文字，因為 `display` 會把貼上的內容換成佔位字串，文字比對一定會失敗）。
- 只有 `projects/` 中找不到的 session，才從 `history.jsonl` 補回。補回時：
  - 略過以 `/` 開頭的紀錄（斜線指令），但把指令名稱計入 slash command 統計。
  - `pastedContents` 有內容時，把 `[Pasted text #N …]` 換回原文（之後 plan 05 會把太長的貼上內容摺疊）。
  - `origin: "interactive"`、`client: "history"`、`gitBranch: null`。
- 同一個 `projects/` 檔案中，同一個 `uuid` 只保留一筆（resume / fork 時可能重複寫入）。不同檔案出現同一個 `uuid` 時也只保留一筆。
- `PromptRecord.id`：`claude-code:${sessionId}:${uuid}`；`history.jsonl` 來源的用 `claude-code:${sessionId}:h${timestamp}`。

## 實作要求

- 放在 `src/adapters/claude-code/`，實作 plan 02 的 `SourceAdapter` 介面，並登記到 `src/adapters/registry.ts`。
- 共用的 JSONL 逐行讀取放在 `src/adapters/common/jsonl.ts`：用 FileSystem + Stream 逐行讀；**單行解析失敗只計數並略過**，不能讓整個流程失敗（不要逐行印 warning，結束時由 `diagnostics` 統一回報）。
- 讀取時要容忍「正在被寫入的檔案」：最後一行可能不完整，視為壞行略過即可。
- 過濾規則（排除條件、注入內容的前綴）寫成資料陣列，每條規則有名稱，`diagnostics` 依名稱回報排除數量。
- 用 Effect Schema 定義「寬鬆」的輸入格式：只宣告會用到的欄位，其他欄位忽略，未知的 `type` 也要能通過。Claude Code 改版很頻繁。
- 資料夾不存在時回傳空的 Stream，不是錯誤。

## 測試

- `test/fixtures/claude-code/`：手寫的假 session 檔，涵蓋上面每一條過濾規則，以及一行壞掉的 JSON。
- 測試：每一條過濾規則各一個 case（table-driven）、session 層級去重、`pastedContents` 還原、斜線指令、重複 `uuid`、壞行被略過、資料夾不存在、`CLAUDE_CONFIG_DIR` 覆寫。
- snapshot：整個 fixture 目錄解析後的輸出。
- `test/smoke/claude-code.test.ts`：讀真實的 `~/.claude`，找不到就 skip；只檢查「能跑完、筆數 > 0、每筆都通過 Schema」，**不要把真實內容印出來或寫進 snapshot**。

## 驗收標準

- [ ] 所有測試通過；smoke test 在本機能讀出筆數，並印出各過濾規則排除的數量
- [ ] 解析使用者本機的全部資料在 5 秒內完成
