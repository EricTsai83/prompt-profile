# prompt-profile

根據你在 Claude Code、Codex 等 AI coding 工具中下過的 prompt，在本機分析並產生你的個人側寫報告。

Analyze your past prompts from AI coding agents (Claude Code, Codex) locally and generate a personal profile.

```bash
npx prompt-profile
# 或 / or
npm i -g prompt-profile && prompt-profile
```

產出 / Output（預設在 `./prompt-profile-report/`）：

- `report.html`：單一檔案、可離線開啟的報告（特質、五個面向、活動熱力圖、有趣的事實，每個結論都附上你的原文證據）
- `card.png`：1200 × 630 分享圖卡（**不含任何 prompt 原文**）
- `profile.json`：側寫的原始資料（可用 `prompt-profile render` 重新產生報告）

## 需求 / Requirements

- Node.js ≥ 22
- 已安裝並登入 [Claude Code](https://claude.com/claude-code)（`claude`）或 [Codex](https://github.com/openai/codex)（`codex`）其中一個
- **不需要 API key**：分析會在背景呼叫你自己已登入的 `claude -p` 或 `codex exec`，**會使用你的訂閱方案額度**。
  一次分析大約 10–30 次呼叫；執行前會先顯示預計呼叫次數並請你確認。

## 使用方式 / Usage

```bash
prompt-profile                 # 分析最近 6 個月並產生報告
prompt-profile --since 3m      # 1m / 3m / 6m / 1y / all
prompt-profile --engine codex  # 指定分析用的 CLI（預設自動偵測，優先 Claude Code）
prompt-profile --model <name>  # 指定模型（傳給 claude / codex）
prompt-profile --lang en       # 報告語言（預設依系統語系：zh-* → 繁體中文，其他 → English）
prompt-profile --out <dir>     # 輸出資料夾
prompt-profile --full          # 不抽樣，分析全部（較慢、較耗額度）
prompt-profile --no-cache      # 不使用分析快取
prompt-profile --yes           # 略過確認（非互動環境必須加上）
prompt-profile --dry-run       # 只把「會送給 LLM 的內容」寫到 --out，不呼叫 LLM
prompt-profile --verbose

prompt-profile stats                  # 只看統計數字，不呼叫 LLM（免費、快速）
prompt-profile render profile.json    # 從既有的 profile.json 重新產生報告
prompt-profile cache clear            # 刪除分析快取
```

Exit codes: `0` success · `1` error · `2` usage / needs `--yes` · `3` no data · `4` no usable LLM CLI ·
`5` rate limited · `130` interrupted (re-run resumes from the cache).

## 隱私 / Privacy

**會讀取的檔案**（只讀，不修改）：

| 來源        | 路徑（可用環境變數覆寫）                                                         |
| ----------- | -------------------------------------------------------------------------------- |
| Claude Code | `~/.claude/projects/*/*.jsonl`、`~/.claude/history.jsonl`（`CLAUDE_CONFIG_DIR`） |
| Codex       | `~/.codex/sessions/**/rollout-*.jsonl`、`~/.codex/history.jsonl`（`CODEX_HOME`） |

**送給 LLM 的內容**：只有你親手輸入的 prompt（排除系統訊息、工具輸出、子代理對話），並且：

- 貼上的程式碼 / log 會被摺疊成 `[貼上的程式碼 N 行]`
- API key、token、密碼、私鑰、連線字串、email、電話、身分證字號、信用卡號、內網網址、UUID / hash、
  家目錄路徑與你的使用者名稱，都會在**送出前**被遮蔽
- 專案只保留資料夾名稱，不送完整路徑
- 想確認實際送出什麼：`prompt-profile --dry-run`

送出的對象是**你自己的** Claude Code / Codex 帳號（`claude -p --no-session-persistence` / `codex exec --ephemeral`），
分析用的呼叫不會寫進你的 session 歷史，也不會觸發你設定的 hooks / MCP server。

**不會離開本機的東西**：原始 prompt、報告、`profile.json`、分析快取（`~/.cache/prompt-profile/`，權限 `0700`）。

**唯一的其他網路請求**：第一次產生中文圖卡時，從 GitHub（`notofonts/noto-cjk`，固定 commit）下載
Noto Sans TC 字型到 `~/.cache/prompt-profile/fonts/`，並以 SHA-256 驗證。下載失敗時只會略過圖卡。

## FAQ

**會花多少額度？** 預設最多分析 30 段（每段約 4 萬字元），加上一次整合，大約 10–31 次呼叫。
第二次執行時已分析的段落會直接從快取讀取。

**可以用 API key 嗎？** 目前不支援，設計上只借用你已登入的 CLI。

**報告準不準？** 每個特質與面向都附有原文證據，程式會檢查證據確實存在於你的 prompt 中，
無法對應的引用會被移除（報告頁尾會顯示驗證結果）。

**為什麼有些 prompt 沒被算進去？** 太短的確認語（「好」、「continue」）、重複送出的內容、
系統自動送出的通知，以及在多個 session 重複出現的長模板，都會被排除。執行時會顯示排除的數量。

prompt-profile 與 Anthropic、OpenAI 沒有任何關係，也未受其背書。
prompt-profile is not affiliated with or endorsed by Anthropic or OpenAI.

## 開發 / Development

見 [`AGENTS.md`](./AGENTS.md) 與 [`plans/`](./plans/README.md)。

## License

MIT
