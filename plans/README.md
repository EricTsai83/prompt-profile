# prompt-profile 開發計畫

## 產品一句話

一個 CLI 工具：讀取使用者本機的 Claude Code / Codex prompt 歷史，**借用使用者已登入的 `claude` 或 `codex` CLI 當 LLM**（不需要 API key），在本機產出「你是什麼樣的人」的側寫報告（HTML + PNG 圖卡）。

```bash
npm i -g prompt-profile   # 或 npx prompt-profile
prompt-profile
```

## 已確定的產品決策

| 項目 | 決定 |
|---|---|
| 形式 | 單純的 CLI 工具，發佈到 npm；之後再加獨立執行檔 / Homebrew（不改程式碼） |
| LLM | 不用 API key。在背景執行使用者本機的 `claude -p` 或 `codex exec` |
| 資料來源（MVP） | Claude Code、Codex |
| 隱私 | 全部在本機處理；送給 LLM 前先遮蔽敏感資訊；分析用的呼叫不寫入使用者歷史 |
| 輸出 | `profile.json`（核心格式）→ HTML 報告 + PNG 分享圖卡 |
| 客製化 | 盡量少，只留必要選項 |
| 不做（目前） | skill / plugin、網頁分享連結、帳號、API key 模式 |

## Tech Stack

| 部分 | 選擇 |
|---|---|
| 語言 / 執行環境 | TypeScript、Node.js ≥ 22（ESM） |
| 套件管理 | pnpm（啟用 catalogs 與供應鏈安全設定，參考 ccusage） |
| 核心框架 | **Effect 4**（`effect@4.0.x`）：`effect/cli`、Schema、Stream、FileSystem、`effect/process` |
| Node 平台層 | `@effect/platform-node` |
| 打包 | tsdown |
| 測試 | vitest + `@effect/vitest`，fixture + snapshot（參考 ccusage） |
| Lint / Format | oxlint + oxfmt |
| 圖卡 | satori + @resvg/resvg-wasm |

> `effect/cli` 在 Effect 4 標示為 `@stability unstable`：**鎖定精確版本**，升級時一起處理。
> 寫 Effect 程式碼前，先查 `node_modules/effect/dist/**/*.d.ts` 裡的 JSDoc 範例，不要憑記憶寫 Effect 3 的 API。

## 架構

```
本機資料 ──► adapters ──► pipeline ──────────► analysis ──────► report
            (claude-code,  (clean → redact →    (chunk → map →   (profile.json →
             codex)         stats)               reduce, cache)    HTML + PNG)
                                                     │
                                                 LlmRunner
                                           (ClaudeCodeRunner | CodexRunner)
```

```
src/
  bin.ts          # 唯一的進入點（tsdown entry），只呼叫 cli/main.ts
  cli/            # effect/cli 指令定義與 UX（main.ts、run.ts、render-error.ts）
  domain/         # PromptRecord、Stats、Profile 等 Schema（不依賴任何其他目錄）
  adapters/
    common/       # 共用：SourceAdapter 介面、JSONL 串流讀取、去重
    claude-code/
    codex/
    registry.ts   # 所有 adapter 的清單；新增來源只要改這裡
  pipeline/       # filter.ts、clean.ts、redact.ts、stats.ts
  llm/            # LlmRunner 介面 + claude / codex / fake 實作 + detect.ts
  analysis/       # chunk.ts、map.ts、reduce.ts、verify.ts、cache.ts、prompts/
  report/         # html.ts、card.tsx、i18n.ts、fonts/
test/
  fixtures/       # 每個 adapter 的假資料（不可含真實個資）
  smoke/          # 讀真實本機資料 / 呼叫真的 CLI，CI 上自動 skip
```

### 模組邊界（長期維護的關鍵）

依賴方向只能往右，不能反過來：

```
cli ──► analysis ──► llm ──► domain
  │        │                   ▲
  ├──► pipeline ───────────────┤
  ├──► adapters ───────────────┤
  └──► report ─────────────────┘
```

- `domain/` 只放 Schema 與純函式，不 import 任何其他目錄。
- `adapters/` 不知道 LLM 的存在；`analysis/` 只依賴 `LlmRunner` **介面**，不知道是 claude 還是 codex。
- `report/` 只吃 `Profile`，所以 `render` 子指令可以不跑任何分析。
- 「可擴充的清單」（adapter、runner、遮蔽規則、糾正語、注入內容的前綴）都是**資料**（陣列），新增項目不需要改流程程式碼。

### 版本號

有三個獨立的版本號，改了就要 bump，快取與 `render` 依賴它們：

| 版本號 | 位置 | 何時 bump |
|---|---|---|
| `Profile.schemaVersion` | `domain/Profile.ts` | `profile.json` 的格式改變（`render` 要能拒絕看不懂的版本） |
| `ANALYSIS_VERSION` | `analysis/version.ts` | `map.md` / `reduce.md`、chunk 格式、LLM Schema 改變（作為快取 key 的一部分） |
| `PIPELINE_VERSION` | `pipeline/version.ts` | clean / redact 規則改變（作為快取 key 的一部分） |

## 執行順序

每份 plan 都可以獨立交給 Claude Code / Codex 執行，例如：「執行 `plans/01-project-setup.md`，完成後跑驗收標準」。

| # | Plan | 產出 | 依賴 |
|---|---|---|---|
| 01 | [專案初始化](./01-project-setup.md) | 可 build、test、lint 的空專案 + AGENTS.md | – |
| 02 | [Domain 與 Schema](./02-domain-schemas.md) | `PromptRecord`、`Profile` 等格式 | 01 |
| 06 | [LlmRunner](./06-llm-runner.md) | 透過 `claude` / `codex` 取得結構化 JSON | 02 |
| 03 | [Claude Code adapter](./03-adapter-claude-code.md) | 讀出乾淨的 Claude Code prompt | 02 |
| 04 | [Codex adapter](./04-adapter-codex.md) | 讀出乾淨的 Codex prompt | 02 |
| 05 | [Pipeline：篩選、清理、遮蔽、統計](./05-pipeline.md) | `Stats` + 可安全送出的 prompt | 03（04 完成後再接上） |
| 07 | [分析流程](./07-analysis.md) | `profile.json` | 05, 06 |
| 08 | [報告輸出](./08-report.md) | HTML 報告 + PNG 圖卡 | 02 |
| 09 | [CLI 整合與 UX](./09-cli.md) | 完整的 `prompt-profile` 指令 | 05, 07, 08 |
| 10 | [發佈](./10-release.md) | npm 套件 + CI | 09 |

**06 排在最前面**：「借用使用者的 `claude` / `codex` 產生結構化 JSON」是整個產品最大的技術風險（Schema 相容性、hooks / MCP 干擾、歷史汙染）。先做完 06 的 smoke test，確認兩個 CLI 都能吃下 plan 02 產生的 JSON Schema，再投入其他 plan。若 06 證明某個 CLI 不可行，回頭調整 02 的 LLM Schema。

02 之後，03 / 04 / 06 / 08 彼此獨立，可以平行進行。

### 第一個里程碑：walking skeleton

03 + 05 + 07 完成時（還沒做 04、08），先用 `pnpm dev --out tmp` 從真實的 Claude Code 資料跑出一份 `profile.json`，由你本人閱讀。**側寫品質不好時先調 `map.md` / `reduce.md`，不要急著做報告的版面。**

## 每份 plan 的共同規範

- 先寫測試（TDD），測試只驗證行為，不驗證內部結構。
- **fixture 不可以放真實的 prompt 內容**，一律用手寫的假資料，但欄位結構要照真實格式。
- 讀真實本機資料的 smoke test 放在 `test/smoke/`，找不到資料時自動 skip（CI 上一定會 skip）。
- 每份 plan 完成時：`pnpm typecheck && pnpm lint && pnpm test` 必須全過。
- 外部資料格式（Claude Code / Codex 的 JSONL、CLI 的 stdout）一律視為**不可信、會改版**：用寬鬆 Schema 解析，失敗時略過並計數，不要讓整個流程失敗。
- 任何會寫到使用者磁碟的衍生資料（快取、報告）都含有個人資訊：資料夾權限 `0700`、檔案 `0600`，寫入時先寫暫存檔再 rename（避免中斷時留下壞檔）。
- Commit 使用 Conventional Commits，一份 plan 可以拆成多個小 commit。
