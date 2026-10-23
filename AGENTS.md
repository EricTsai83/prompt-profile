# AGENTS.md

`prompt-profile` 是一個 CLI：讀取使用者本機的 Claude Code / Codex prompt 歷史，借用使用者已登入的
`claude` / `codex` CLI 當 LLM，在本機產出個人側寫報告（`profile.json` → HTML + PNG）。

完整的產品決策、架構與開發計畫見 [`plans/README.md`](./plans/README.md)。

## 目錄結構

```
src/
  bin.ts          唯一進入點，只呼叫 cli/main.ts
  cli/            effect/cli 指令定義與 UX（main.ts、run.ts、render-error.ts）
  domain/         Schema 與純函式（PromptRecord、Stats、Profile…），不 import 其他目錄
  adapters/       讀取各來源的本機資料 → PromptRecord（common/、claude-code/、codex/、registry.ts）
  pipeline/       filter → clean → redact → stats
  llm/            LlmRunner 介面 + claude / codex / fake 實作 + detect.ts（NOTES.md 記錄 CLI 行為）
  analysis/       chunk → map → verify → reduce，快取與 prompts/*.md
  report/         profile.json → HTML 報告 + PNG 圖卡
test/
  fixtures/       手寫假資料（不可含真實個資）
  smoke/          讀真實本機資料 / 呼叫真的 CLI，找不到時自動 skip
```

依賴方向：`cli → analysis → llm → domain`；`cli → pipeline / adapters / report → domain`。
`domain/` 不依賴任何其他目錄；`analysis/` 只依賴 `LlmRunner` 介面；`report/` 只吃 `Profile`。

## 指令

```bash
pnpm install
pnpm build        # tsdown → dist/bin.js
pnpm dev          # tsx src/bin.ts
pnpm typecheck
pnpm lint
pnpm format
pnpm test         # 單元測試（CI）
pnpm test:smoke   # 讀真實本機資料 / 呼叫真的 claude、codex（本機才跑）
```

每個階段完成前：`pnpm typecheck && pnpm lint && pnpm test` 必須全過。

## 規範

- **TDD**：先寫測試；測試只驗證行為，不驗證內部結構。
- **fixture 不放真實個資**：一律手寫假資料，但欄位結構照真實格式。smoke test 不印出、不 snapshot 真實內容。
- **Effect 4**：`effect@4.0.x`（精確版本）。寫 Effect 程式碼前先查 `node_modules/effect/dist/**/*.d.ts`
  的 JSDoc 範例，不要憑記憶寫 Effect 3 的 API（例如 `Context.Service`、`effect/cli`、`effect/process`）。
- 外部資料格式（Claude Code / Codex JSONL、CLI stdout）一律視為不可信：寬鬆 Schema，壞資料略過並計數。
- 寫到使用者磁碟的衍生資料（快取、報告）：資料夾 `0700`、檔案 `0600`，先寫暫存檔再 rename。
- 「可擴充的清單」（adapter、遮蔽規則、糾正語、注入前綴）都寫成資料陣列。
- 改到 profile 格式 / 分析 prompt / 清理規則時，bump 對應的版本號（見 `plans/README.md`「版本號」）。
- Commit 使用 Conventional Commits。
