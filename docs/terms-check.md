# 服務條款檢查（發佈前）

> 檢查日期：2026-10-24。**這不是法律意見**，是開發時的初步整理，正式發佈前請本人再讀一次原文。

## 問題

prompt-profile 在使用者本機，以子程序執行使用者**自己安裝、自己登入**的 `claude -p` / `codex exec`，
把遮蔽後的 prompt 送去分析。工具本身不讀取、不儲存、不轉送任何憑證或 token，也不提供登入流程。
這樣的使用方式是否被允許？

## Anthropic（Claude Code）

來源：[Claude Code — Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)（2026-10-24 讀取）

- 支持允許的段落（Authentication and credential use）：
  > "Nor does it prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription …"
- 本工具符合的條件：
  - 執行的是**未經修改的** Claude Code binary，不移除或限制任何登入方式（我們也刻意不用 `--bare`）。
  - 不「offer Claude.ai login」、不 collect / store / intermediate 憑證或 session token。
  - 用量計在使用者自己的方案上，工具不付費、不轉售、不代理。
- 需要注意 / 不確定的地方：
  - "OAuth authentication … is designed to support **ordinary use** of Claude Code"；
    "Advertised usage limits for Pro and Max plans assume **ordinary, individual usage**"。
    一次分析約 10–30 次呼叫，屬於個人使用，但「自動化地大量呼叫」是否算 ordinary use 沒有明確定義。
  - 新聞報導（非官方原文）指出 2026 年起 Anthropic 開始封鎖第三方 harness 使用訂閱 OAuth，
    並在 2026-04 起讓訂閱額度不再涵蓋部分第三方自動化工具（例如 OpenClaw）。那些工具多半是**自己拿
    OAuth token 呼叫 API**，與本工具「呼叫原版 CLI」不同，但執行面上的界線可能會再變動。
    - https://winbuzzer.com/2026/02/19/anthropic-bans-claude-subscription-oauth-in-third-party-apps-xcxwbn/
    - https://roboin.io/article/en/2026/04/04/claude-bans-third-party-tools-requires-api-keys/
  - 名稱與商標：README 只能以純文字說明「會呼叫你本機的 Claude Code」，不可暗示 Anthropic 背書。

**初步結論**：目前的設計落在條款明文允許的範圍內（使用者以自己的訂閱使用未修改的 CLI），但
「ordinary use」的解釋有風險。README 要誠實說明會使用訂閱額度、預設會先請使用者確認。

## OpenAI（Codex）

來源：[Codex 與 ChatGPT 帳號](https://help.openai.com/articles/11369540)

- 以 ChatGPT 帳號登入 Codex 時，適用 ChatGPT Terms of Use（企業版適用對應的服務合約）。
- 沒有找到明文禁止「本機工具呼叫使用者自己的 `codex exec`」的條款，也沒有找到明文允許的說明。
- `codex exec` 是官方提供的非互動模式；本工具以 `--ephemeral` 執行、不讀取 `~/.codex/auth.json`。

**初步結論**：未發現禁止條款，但沒有官方明確背書；同樣需要在 README 說明會使用 ChatGPT 方案額度。

## 發佈前待辦

- [ ] 本人閱讀 Anthropic Consumer Terms / Commercial Terms、Usage Policy 與 OpenAI Terms of Use 的最新版本原文。
- [ ] 若條款有疑義，考慮聯絡 Anthropic sales（條款頁提供的管道）確認。
- [ ] 若未來條款禁止，備案是提供「使用者自己的 API key」模式（目前產品決策是不做）。
