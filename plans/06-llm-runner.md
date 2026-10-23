# 06 · LlmRunner：借用使用者本機的 claude / codex

## 目標

提供一個 `LlmRunner` service：輸入「指示文字 + LLM Schema」，輸出通過 Schema 驗證的值。實際執行時在背景呼叫使用者已登入的 `claude` 或 `codex` CLI，**不使用任何 API key**。

> 這是整個專案技術風險最高的 plan，排在 02 之後立刻做。**每一個標示「實作前先確認」的項目都要實際跑過，把結論寫進 `src/llm/NOTES.md`**（CLI 版本、指令、觀察到的行為），之後 CLI 改版時才知道要重新確認什麼。

## 介面

```ts
interface LlmRunner {
  readonly id: "claude-code" | "codex"
  readonly displayName: string
  generate<A>(input: {
    system: string            // 固定的指示（map.md / reduce.md）
    prompt: string            // 這次要分析的資料
    schema: LlmSchema<A>      // plan 02 的 LLM Schema
  }): Effect<GenerateResult<A>, LlmError>
}

GenerateResult<A> {
  value: A
  model: string | null        // 實際使用的模型（從 CLI 輸出取得）
  usage: { inputTokens: number | null, outputTokens: number | null, costUsd: number | null }
  durationMs: number
}
```

`LlmError`（tagged errors）：`NotInstalled` | `NotLoggedIn` | `RateLimited` | `Timeout` | `InvalidOutput` | `ProcessFailed`（附 stderr 最後 20 行，**不含 prompt 內容**）| `Interrupted`。

## 實作 1：`ClaudeCodeRunner`（已確認 Claude Code 2.1.309 有這些參數）

```bash
claude -p \
  --output-format json \
  --json-schema '<JSON Schema 字串>' \
  --no-session-persistence \
  --tools "" \
  --strict-mcp-config \
  --settings '{"disableAllHooks": true}' \
  --system-prompt '<system 指示>' \
  [--model <model>]
# prompt 從 stdin 傳入，不要放在參數裡（避免超過參數長度上限、也避免出現在 ps 中）
```

| 參數 | 理由 |
|---|---|
| `--tools ""` | 關掉所有工具。比 `--disallowedTools <清單>` 穩定：之後 Claude Code 新增工具也不會漏掉 |
| `--strict-mcp-config` | 不啟動使用者設定的 MCP server（每次呼叫都啟動會很慢，也可能有副作用） |
| `--settings '{"disableAllHooks": true}'` | 使用者的 hooks（通知音效、Stop hook…）不要在每次分析時觸發 |
| `--system-prompt` | 取代預設的 coding agent system prompt：省 token、避免「coding 助手」的人格影響分析 |

實作前先確認：
1. `--output-format json` 搭配 `--json-schema` 時，結構化結果在哪個欄位（例如 `structured_output` 或 `result`）；`is_error`、`subtype` 有哪些值；模型名稱與 token / 費用在哪裡（例如 `modelUsage`、`total_cost_usd`）。把真實輸出（內容替換成假資料）存成 `test/fixtures/llm/claude-output.*.json`。
2. `--settings '{"disableAllHooks": true}'` 是否有效（設一個會寫檔的 user hook 測試）；若無效，改用 `--setting-sources` 並確認不會影響登入。
3. 使用者的 `~/.claude/CLAUDE.md` 是否仍會被載入。若會，在 `system` 指示中明確寫「忽略其他關於回覆風格的指示」，並在 NOTES.md 記錄。
4. **不要用 `--bare`**：說明中寫明它會略過 keychain，訂閱登入的使用者會無法認證。

## 實作 2：`CodexRunner`（已確認 codex-cli 0.164.0 有這些參數）

```bash
codex exec \
  --output-schema <schema.json 暫存檔> \
  -o <輸出暫存檔> \
  --ephemeral \
  --ignore-rules \
  -s read-only \
  --skip-git-repo-check \
  [-m <model>] \
  -    # prompt（system 指示 + 資料）從 stdin 傳入
```

- 從 `-o` 的檔案讀出最後一則訊息，解析成 JSON。
- 不使用 `--ignore-user-config`：使用者可能在 `config.toml` 設定了 model provider，略過會讓登入失效。
- Codex 沒有獨立的 system prompt 參數，把 `system` 放在 stdin 內容的開頭。

實作前先確認：
1. Codex 是否接受 plan 02 產出的 JSON Schema（strict 模式的限制），不接受時錯誤訊息長什麼樣子。
2. 模型名稱與 token 用量能不能取得（`--json` 事件串流中可能有）；取不到就填 `null`。
3. 全域的 `~/.codex/AGENTS.md` 是否會被載入（同 Claude 第 3 點的處理方式）。

## 共同要求

1. **防止汙染使用者歷史（最重要）**
   - Claude 用 `--no-session-persistence`，Codex 用 `--ephemeral`。
   - 另外，每個送出的 prompt 第一行都加上標記 `[prompt-profile:analysis]`。plan 03 / 04 的 adapter 看到這個標記就會略過，作為第二道保險。
   - 寫一個整合測試（本機才跑）：記錄 `~/.claude/projects/`、`~/.claude/history.jsonl`、`~/.codex/sessions/`、`~/.codex/history.jsonl` 的狀態，執行一次 `generate`，確認都沒有新增內容。
2. **工作目錄**：每次呼叫都在一個新的空暫存資料夾中執行（`Scope` 結束時刪除），避免載入使用者專案的 `CLAUDE.md` / `AGENTS.md`、hooks、MCP 設定。暫存的 schema / 輸出檔也放在這裡。
3. **偵測**：`src/llm/detect.ts`
   - 安裝：執行 `claude --version` / `codex --version`，記錄版本號（之後錯誤訊息與 NOTES.md 對照用）。
   - 登入：`claude auth status --json`、`codex login status`。**不要送測試 prompt**（花額度、又慢）。結果在本次執行中快取。
   - 兩個都可用：預設用 Claude Code，可用 `--engine` 切換。
4. **執行子程序**：使用 `effect/process` 的 `ChildProcessSpawner`（先查 `.d.ts` 確認 API），不要直接用 `node:child_process`，這樣測試時可以替換。
   - 子程序必須綁在 Effect 的 `Scope` 上：逾時或使用者按 Ctrl-C 時，**確實結束子程序**，不留下背景中的 `claude` / `codex`。
5. **錯誤分類**：exit code + stderr / JSON 輸出的關鍵字對應到 `LlmError`。對應表寫成資料陣列，每一筆都有測試；分類不了的一律是 `ProcessFailed`。
6. **驗證**：CLI 已經依 JSON Schema 產生結果，但仍然**一定要**用 Effect Schema decode 一次，失敗就是 `InvalidOutput`。
7. **逾時**：每次呼叫預設 5 分鐘。
8. **重試**：`RateLimited`、`Timeout`、`InvalidOutput` 自動重試，最多 2 次，指數退避（`RateLimited` 至少等 30 秒）。`InvalidOutput` 重試時在 prompt 後面附上錯誤說明。重試邏輯寫成一個包裝任何 `LlmRunner` 的函式，不要在兩個實作中各寫一次。
9. **並行**：由呼叫端控制（plan 07），runner 本身不限制。

## 實作 3：`FakeLlmRunner`（測試用）

- 依照 `hash(system + prompt)` 回傳 `test/fixtures/llm/` 中事先存好的回應。
- 找不到對應的回應時直接失敗，並印出 hash，方便新增 fixture。
- 可以設定「第 N 次呼叫回傳某種錯誤」，用來測試 plan 07 的部分失敗與 plan 09 的錯誤訊息。
- 記錄呼叫次數（plan 07 的快取測試會用到）。

## 測試

- 單元測試：用假的 `ChildProcessSpawner`，驗證送出的參數正確（snapshot）、stdin 有收到 prompt、prompt 不在參數中、各種錯誤情況轉成正確的 `LlmError`、逾時會結束子程序、暫存資料夾在結束後被刪除。
- `test/smoke/llm-runner.test.ts`：本機有 `claude` / `codex` 時才跑：
  1. 極小的 Schema（例如 `{ ok: boolean }`），確認能拿到結果。
  2. **plan 02 的 `LlmChunkObservations` 與 `LlmProfileDraft`**，兩個 CLI 都要能接受並回傳通過驗證的結果。
  3. 上面的「不汙染歷史」測試。

## 驗收標準

- [ ] 單元測試通過
- [ ] 本機 smoke test：`claude` 與 `codex` 都能用 plan 02 的 LLM Schema 回傳通過驗證的 JSON
- [ ] 確認執行後使用者的 session 與 history 檔案沒有新增分析用的內容
- [ ] `src/llm/NOTES.md` 記錄了每一個「實作前先確認」的結論
