# 05 · Pipeline：篩選、清理、遮蔽、統計

## 目標

把 adapter 輸出的 `PromptRecord` 變成：
1. **範圍內的 prompt**：依 `--since` 篩選，並去掉明顯是機器產生的 prompt
2. **乾淨的 prompt**：去掉沒有分析價值的雜訊
3. **安全的 prompt**：遮蔽敏感資訊，才能送給 LLM
4. **`Stats`**：不需要 LLM、每次結果都一樣的統計數字

處理順序固定為：

```
PromptRecord ──► filter ──► (排序) ──► clean ──► redact ──► SafePrompt[]
                   │                     │
                   └──── stats（總數）    └──── stats（其他特徵）
```

`--since` **只在這裡處理一次**，之後的 analysis 與 report 都不再自己篩選時間。

## 1. `src/pipeline/filter.ts`

- 依 `since` 篩選時間，並依 timestamp 排序（同時間再依 id 排序，確保結果穩定）。
- 排除機器產生的 prompt（不計入任何統計，只記錄排除數量）：

| 規則 | 理由 |
|---|---|
| 同一段長文字（> 200 字）出現在 3 個以上不同的 session | 自動化腳本、code review bot、模板 prompt |
| session 的第一筆 prompt 符合「AI 委派子任務」的特徵（清單，可擴充；例如 orchestrator 的固定開頭） | 桌面 app 的 child thread 是 AI 寫的 prompt |

- 第二條規則的特徵清單一開始可以是空的。實作時用 smoke test 印出「各 `client` 的 session 數與第一筆 prompt 的前 30 字的雜湊分佈」（**不印原文**），由你本人判斷要不要加入規則。

## 2. `src/pipeline/clean.ts`

排除下列 prompt（計入 `totalPrompts`，不計入 `analyzedPrompts`，另外記錄被排除的數量）：

| 規則 | 例子 |
|---|---|
| 去除前後空白後少於 3 個字元 | `cc`、`y`、`ok` |
| 只是確認 / 繼續的短句（中英文清單，可擴充） | `continue`、`yes`、`go`、`繼續`、`好`、`可以` |
| 同一個 session 內連續重複的同一句 | 重送 |

另外，依序做下列轉換：
1. 偵測「貼上的程式碼 / log / stack trace」區塊（code fence、連續多行帶有縮排或行號、`at …(file:line)` 等特徵），替換成 `[貼上的程式碼 N 行]`。分析的重點是使用者怎麼說話，不是貼了什麼。
2. 轉換後仍超過 4,000 字時截斷，保留開頭與結尾，中間標記 `[…省略 N 字…]`。

## 3. `src/pipeline/redact.ts`

送給 LLM **之前**一定要經過這一步。替換成固定的標記：

| 類型 | 替換成 |
|---|---|
| API key / token（`sk-…`、`ghp_…`、`gho_…`、`xox[bp]-…`、`AKIA…`、JWT、長度 ≥ 32 的高熵字串） | `[SECRET]` |
| `Bearer …`、`password=…`、`token: …` 這類鍵值 | `[SECRET]` |
| 私鑰區塊（`-----BEGIN … PRIVATE KEY-----`） | `[SECRET]` |
| 含帳號密碼的連線字串（`postgres://user:pass@…`） | `[SECRET]` |
| Email | `[EMAIL]` |
| 電話號碼（含台灣手機 `09xx-xxx-xxx` 格式） | `[PHONE]` |
| 台灣身分證字號、信用卡號（Luhn 檢查） | `[ID]` |
| 內網 IP、`localhost:port` 以外的私有網址 | `[INTERNAL_URL]` |
| 使用者家目錄路徑 `/Users/<name>/…`、`/home/<name>/…`、`C:\Users\<name>\…` | `~/…` |
| 目前作業系統的使用者名稱（`os.userInfo().username`，長度 ≥ 3 時） | `[USER]` |

- 遮蔽規則放在一個陣列中，每條規則都有名稱，方便測試與統計（例如「遮蔽了 12 個 SECRET」）。
- **寧可多遮，不要漏遮**。
- `project` 欄位只保留資料夾最後一層名稱，也經過遮蔽規則。

## 4. `src/pipeline/stats.ts`

依照 plan 02 的 `Stats` 格式計算：
- 時間相關的統計都用使用者本機的時區（從 `Intl.DateTimeFormat().resolvedOptions().timeZone` 取得，可由參數注入以便測試）。
- `totalPrompts`、`totalSessions`、`bySource`、`byOrigin`、時間分佈、`longestStreakDays`：用 **filter 之後、clean 之前**的資料。
- `promptLength`、`languageMix`、`correctionRate`、`imageRate`：用 **clean 之後**的資料。
- 在程式碼註解中寫清楚每個欄位用的是哪一份資料。
- `languageMix`：以字元判斷（CJK 字元比例 vs 拉丁字母比例），每筆 prompt 歸類為 zh / en / mixed，再算比例。
- `correctionRate`：prompt 開頭或內容含有糾正語（`不對`、`錯了`、`不是這樣`、`還是不行`、`no,`、`wrong`、`that's not`、`still broken`…）的比例。用可擴充的清單。
- `latestTime`：把 00:00–04:59 視為「前一天的延續」，找出所有日子中最晚的時間點。沒有落在 18:00–04:59 的紀錄時為 `null`。
- `topProjects`：只保留專案資料夾的最後一層名稱。

## 5. `src/pipeline/index.ts`

```ts
runPipeline(records: Stream<PromptRecord>, opts: { since: DateTime.Utc | null; now: DateTime.Utc; timezone: string })
  => Effect<{ prompts: SafePrompt[], stats: Stats, report: PipelineReport }>
```

- `SafePrompt` = 已清理、已遮蔽的 prompt：`{ id, sessionId, source, timestamp, project（只有資料夾名稱）, text }`。**`text` 就是之後送給 LLM 的文字，也是 plan 07 驗證 evidence 的比對對象。** 不包含原文，避免之後的模組誤用。
- `PipelineReport`：各規則排除了幾筆、各遮蔽規則觸發了幾次。在 CLI 上顯示給使用者看，讓他們放心。
- `now` 由外部傳入（不要在函式裡讀系統時間），測試才能固定。

## 測試

- filter：`since` 邊界、排序穩定、跨 session 重複的長文字。
- clean：每條規則 table-driven；程式碼區塊偵測至少涵蓋 code fence、stack trace、JSON、一般的多行中文段落（不該被當成程式碼）。
- redact：每種敏感資料至少 3 個「要遮」的例子，以及 3 個「不該遮」的例子（例如一般的英文長單字、UUID、git commit hash 是否要遮，要在測試中明確決定並寫下理由）。
- stats：用固定的假資料計算，並寫 snapshot；**時區要在測試中固定**（例如 `Asia/Taipei`），並測試跨午夜的 `latestTime`。

## 驗收標準

- [ ] 所有測試通過
- [ ] smoke test：對本機真實資料跑完整 pipeline，印出 `PipelineReport` 與 `Stats`（不印 prompt 內容）
