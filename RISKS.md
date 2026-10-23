# 實作過程中的疑慮與風險

這份清單記錄實作 `plans/01`–`10` 時，依我的判斷先做了決定、但你應該知道（或之後需要你本人確認）的地方。
依嚴重程度排序。

## 🔴 高：發佈前一定要處理

1. **服務條款仍有灰色地帶**（詳見 [`docs/terms-check.md`](./docs/terms-check.md)）
   - Anthropic 官方條款明文允許「使用者用自己的訂閱登入**未修改的** Claude Code binary」，本工具正是這樣用；
     但也寫著訂閱 OAuth 是為了 "ordinary use"，且 2026 年起已封鎖多個第三方 harness 使用訂閱額度。
     本工具一次分析約 10–30 次自動呼叫，是否屬於 ordinary use 沒有明確定義，**之後可能被限制**。
   - OpenAI 沒有找到明文禁止或允許的條款。
   - 我只讀了官方條款頁與幾篇新聞，**不是法律意見**，發佈前請你本人讀原文。

2. **委派子任務（AI 寫的 prompt）的過濾清單目前是空的**（`src/pipeline/filter.ts` 的 `DELEGATION_PATTERNS`）
   - 你的資料中 Claude Code 的 prompt 有約 97% 是 `entrypoint: sdk-ts`（T3 Code 等桌面 app），
     其中可能混有 orchestrator 自動建立的 child thread prompt（不是你本人打的字）。
   - 依 plan 規定我**沒有看原文**，只用特徵判斷：開頭重複的 session 群組平均有 5–19 則後續 prompt，
     比較像你自己重複使用的工作流程句型，所以沒有加規則。
   - 建議：執行 `pnpm test:smoke`，看 `first-prompt prefix hashes` 的輸出，自己確認那幾個群組是不是 AI 委派的；
     是的話，把它們的固定開頭加進 `DELEGATION_PATTERNS`（並 bump `PIPELINE_VERSION`）。
   - 另外 `topSlashCommands` 目前沒有資料：`/usage`、`/status` 等指令只出現在 history，且不受 `--since` 篩選。

3. **側寫品質需要你本人評估**（plan 07 的人工驗收）
   - 已在你的真實資料（`--since 2w`，9 段）上用 Claude 從頭跑到尾成功：證據 40/40 通過驗證，第二次全數命中快取。
     結果在 `tmp/real/`（git ignore），**請閱讀 `tmp/real/report.html` 判斷準不準**，再調整
     `src/analysis/prompts/map.md` / `reduce.md`（改了要 bump `ANALYSIS_VERSION`）。
   - 我沒有用 6 個月的完整範圍或 `--full` 跑過（約 25 段、66 萬字元，考量你的額度）。
   - `pnpm eval --engine codex` 沒有跑過，只跑了 Claude。

4. **尚未 push，GitHub Actions 從未實際跑過**
   - 依你的指示全部 commit 在本機 `main`，沒有 push。CI（`.github/workflows/ci.yml`）與 release workflow 都沒有在 GitHub 上驗證。
   - Release 需要先在 npm 設定 Trusted Publishing（OIDC），並在 GitHub 上建立 release-please 用的權限。
   - 發佈必須用 `pnpm pack`：`npm pack` / `npm publish` 不認得 `catalog:` 版本，會產生壞掉的套件
     （release workflow 已處理，手動發佈時要注意）。

## 🟠 中：功能面的取捨

5. **依賴版本與供應鏈設定的例外**
   - `effect@4.0.6` 系列在建置前一天才發佈，違反 `minimumReleaseAge: 2880`（2 天），我用
     `minimumReleaseAgeExclude` 只對這幾個**精確版本**開例外。
   - `@types/node@22` 會帶入有 trust downgrade 的 `undici-types`，被 `trustPolicy: no-downgrade` 擋下，改用 `@types/node@24`。
   - `esbuild` 的 install script 明確設為不執行（`allowBuilds: esbuild: false`），目前運作正常。
   - `effect/cli`、`effect/process` 標示為 unstable，升級 Effect 時要一起檢查。

6. **安裝體積大**：tarball 只有 111 KB，但安裝後 `node_modules` 約 **117 MB**（effect、satori、resvg wasm），
   `npx prompt-profile` 第一次下載會比較久。`--version` 冷啟動約 0.9 秒。

7. **CLAUDE.md / AGENTS.md 可能影響分析**：實測 cwd 的 `CLAUDE.md` 會被 `claude -p` 載入。
   我們在空的暫存資料夾執行，並在 system prompt 要求忽略其他指示，但使用者**全域**的
   `~/.claude/CLAUDE.md`、`~/.codex/AGENTS.md` 仍可能影響輸出風格（best effort）。

8. **速率限制的辨識是推測的**：本機無法重現 rate limit，`classify.ts` 依 HTTP 429/529 與關鍵字判斷，
   Codex 的 rate-limit fixture 是依錯誤格式手寫的，不是真實擷取。誤判時會變成 `ProcessFailed`（exit 1）而非 exit 5。

9. **Codex 拿不到實際模型名稱**：`codex exec --json` 沒有回報模型，報告中 Codex 的 model 會是 `null`（除非用 `--model`）。

10. **遮蔽規則是「寧可多遮」**，有誤判與漏判的可能：
    - 刻意遮蔽 UUID（`[UUID]`）與 32+ 位 hex（`[HASH]`，含 git commit hash）。你的資料中 UUID 有約 800 處。
    - 電話規則可能把某些數字串誤判成電話；身分證規則沒做檢查碼驗證。
    - 高熵字串規則已排除 kebab-case 名稱（branch / worktree），但仍可能漏掉格式特殊的金鑰。
    - 建議發佈前用 `--dry-run` 看一次實際送出的內容。

11. **抽樣與分段的細節**
    - 週的「月份」以 ISO 週的星期四判定（跨月週歸到星期四所在的月份），plan 沒有規定。
    - 抽樣後實際段數可能 **少於** 30（每個時間區間最多選一段）。

## 🟡 低：與 plan 有出入、或尚未完成的小項目

12. **Schema 微調**：`Stats` 新增 `activityGrid`（7×24，熱力圖需要星期×小時的聯合分佈，原本只有兩個獨立直方圖）；
    `Stats.dateRange` 改成可為 `null`（範圍內沒資料時）。因為尚未發佈，`schemaVersion` 仍為 1。
13. **分析標記只比對開頭**：plan 寫「文字中含有 `[prompt-profile:analysis]` 就略過」，我改成「以它開頭才略過」，
    否則你在開發這個工具時提到這個字串的真實 prompt 會被誤刪。
14. **Claude Code 額外的過濾規則**（plan 未列，但在真實資料中發現）：`isMeta`、`isCompactSummary`（AI 產生的對話摘要）、
    `origin.kind: task-notification`、`turnOrigin: scheduled / peer`；並且不讀 `subagents/` 底下的檔案。
15. **eval persona 比規格小**：3 個 persona 各 31–45 筆 prompt（plan 要求 50–150 筆）。
16. **報告只在 Chrome（headless）檢查過淺色 / 深色**，沒有在 Safari 實際開啟。
17. **「乾淨環境（Docker）+ `npx prompt-profile` 從頭跑到尾」與 npm provenance** 尚未驗證（需要先發佈）。
18. **字型來源**：Noto Sans TC 從 GitHub raw（固定 commit `165c01b`）下載並驗證 SHA-256；若 GitHub 調整 raw 網址政策，
    中文圖卡會無法產生（報告不受影響）。Inter 字型以 OFL 授權內嵌在套件中。
19. **oxfmt 會改寫 `html\`\``模板**：已在`.oxfmtrc.json`關閉`embeddedLanguageFormatting`，日後更新 oxfmt 要留意。
20. **獨立執行檔（bun compile）尚未考慮**：`map.md`、字型、resvg wasm 都是執行時從檔案系統讀取，打包成單一執行檔時需要另外處理。
