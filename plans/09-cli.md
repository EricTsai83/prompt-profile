# 09 · CLI 整合與使用者體驗

## 目標

把前面的模組串成完整的 `prompt-profile` 指令。預設情況下**不需要任何參數和設定**就能跑完。

## 指令設計

```bash
prompt-profile                 # 主要用法：分析並產出報告
prompt-profile --since 3m      # 分析範圍（預設 6m；支援 1m / 3m / 6m / 1y / all）
prompt-profile --engine codex  # 指定用哪個 CLI 分析（預設自動偵測，優先 claude）
prompt-profile --model <name>  # 指定模型（傳給 claude / codex）
prompt-profile --lang en       # 報告語言（預設依系統 locale：zh-* → zh，其他 → en）
prompt-profile --out <dir>     # 輸出資料夾
prompt-profile --full          # 不抽樣，分析全部（較慢、較耗額度）
prompt-profile --no-cache
prompt-profile --yes           # 略過確認步驟（給自動化使用）
prompt-profile --dry-run       # 只跑到分段為止，把「會送給 LLM 的內容」寫到 --out，不呼叫 LLM
prompt-profile --verbose       # 顯示完整錯誤與每次 LLM 呼叫的耗時
prompt-profile --version / --help

prompt-profile stats           # 只顯示統計數字，不呼叫 LLM（快速、免費）
prompt-profile render <profile.json>  # 從既有的 profile.json 重新產生報告
prompt-profile cache clear     # 刪除分析快取（裡面有 prompt 節錄）
```

- `stats` 也接受 `--since`、`--out`，輸出 `stats.json`。
- `--dry-run` 輸出 `chunks/*.txt` 與 `plan.json`：讓重視隱私的使用者確認會送出什麼，也方便調整 `map.md`。
- 選項以「少」為原則，新增選項前先問：預設值能不能直接做對？

## 主要流程與畫面

```
◆ prompt-profile v0.1.0

● 讀取資料
  Claude Code   3,412 筆 prompt · 207 個 session
  Codex           812 筆 prompt · 273 個 session
● 清理與遮蔽
  排除雜訊 2,104 筆（太短 / 系統訊息 / 重複）
  遮蔽敏感資訊 37 處（SECRET 12 · EMAIL 9 · 路徑 16）
● 分析範圍：最近 6 個月 · 1,980 筆 prompt → 18 段
  使用 Claude Code（已登入）分析，預計呼叫 19 次，會使用你的訂閱額度

? 要繼續嗎？ (Y/n)

● 分析中 ████████░░░░ 12/18 段（3 段來自快取）
● 整合側寫…
● 驗證證據：保留 41 / 44 筆

✔ 完成！
  報告   ./prompt-profile-report/report.html（已在瀏覽器開啟）
  圖卡   ./prompt-profile-report/card.png
  資料   ./prompt-profile-report/profile.json
```

- 確認步驟用 `effect/cli` 的 `Prompt`（查 `.d.ts` 確認 API）。確認畫面顯示 plan 07 的 `AnalysisPlan`（段落數、快取命中、預計呼叫次數）。
- **非 TTY 環境（例如 CI、pipe）且沒有 `--yes` 時，直接結束並提示加上 `--yes`**。不要自動視為同意：這個指令會花使用者的訂閱額度，不應該在使用者沒注意時執行。
- 進度顯示：非 TTY 時改成每一步一行的純文字。
- 完成後用系統預設瀏覽器開啟 HTML（macOS `open`、Linux `xdg-open`、Windows `start`），開啟失敗不算錯誤。非 TTY 時不開啟。
- **Ctrl-C**：中斷所有進行中的 LLM 子程序（plan 06），已完成的段落保留在快取中，印出「已中斷，重跑會從快取繼續」，exit code 130。

## 錯誤訊息（要友善、要告訴使用者下一步）

| 情況 | 訊息重點 |
|---|---|
| 找不到任何 prompt 資料 | 說明會去哪些路徑找，以及 `CLAUDE_CONFIG_DIR` / `CODEX_HOME` 可以覆寫 |
| 沒有安裝 claude 也沒有 codex | 說明需要其中一個，附上安裝連結；提示 `prompt-profile stats` 不需要 LLM |
| 已安裝但沒有登入 | 提示執行 `claude` 或 `codex login` |
| 速率限制 | 已分析的部分都在快取中，稍後重跑會從中斷處繼續 |
| 部分段落失敗 | 仍產出報告，並說明略過了幾段 |

所有錯誤都是型別化的 Effect 錯誤，在 CLI 最外層（`src/cli/render-error.ts`）用一個窮舉的對應表轉成訊息；新增錯誤型別時 TypeScript 會強制補上訊息。除錯用的完整錯誤只在 `--verbose` 時顯示。

Exit code：`0` 成功（含部分段落失敗）、`1` 一般錯誤、`2` 參數錯誤、`3` 找不到資料、`4` 沒有可用的 LLM（未安裝 / 未登入）、`5` 速率限制、`130` 使用者中斷。

## 實作要求

- `src/cli/main.ts`：定義指令；`src/cli/commands/*.ts`：每個指令一個檔案，串接 adapters → pipeline → llm → analysis → report；`src/cli/steps.ts`：指令共用的步驟；`src/cli/options.ts`：flag 值的解析。
- commands 與 steps 只做串接，不放業務邏輯；任何判斷（要不要抽樣、要不要重試）都屬於前面的模組。
- 用 Layer 組合所有 service；所有環境相關的東西（家目錄、環境變數、時區、現在時間、是否為 TTY、`PATH`）都透過 service 取得，測試時可以替換。
- 測試時換成 fixture adapter + `FakeLlmRunner` + 記憶體快取。
- 不要把 Effect 的 stack trace 直接丟給使用者。

## 測試

- E2E：fixture 資料 + `FakeLlmRunner` → 跑完整的 `prompt-profile --yes --out <暫存資料夾>`，確認三個檔案都產生。
- 每一種錯誤情況各一個測試，對輸出訊息做 snapshot。
- `stats`、`render`、`cache clear`、`--dry-run` 各一個測試；`render` 讀到不認得的 `schemaVersion` 時顯示明確訊息。
- 非 TTY 且沒有 `--yes` 時拒絕執行。
- 中斷（用 `FakeLlmRunner` 模擬一個不會結束的呼叫，再 interrupt）：exit code 130、快取保留已完成的段落。

## 驗收標準

- [ ] 所有測試通過
- [ ] 手動：在本機執行 `pnpm build && node dist/bin.js`，從頭到尾跑完，產出的報告由你本人確認
- [ ] 手動：把 `claude` 從 PATH 移除後執行，看到正確的提示
