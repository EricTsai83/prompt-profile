# 10 · 發佈

## 目標

發佈到 npm，讓使用者可以 `npm i -g prompt-profile` 或 `npx prompt-profile`。並準備好之後加入獨立執行檔與 Homebrew 的基礎。

## 發佈前檢查

- [ ] **重新確認服務條款**：閱讀 Anthropic（Claude Code / Claude 消費者條款）與 OpenAI（Codex / ChatGPT 條款）的最新版本，確認「第三方 CLI 在使用者本機呼叫使用者自己已登入的 `claude` / `codex`」是被允許的，並把結論記錄在 `docs/terms-check.md`。
- [ ] 確認 npm 上 `prompt-profile` 這個名稱可以使用（`npm view prompt-profile`）；不行的話改用 scope（例如 `@erictsai83/prompt-profile`），`bin` 名稱維持 `prompt-profile`。
- [ ] README：一句話說明、截圖（報告與圖卡）、安裝方式、**隱私說明**（讀哪些檔案、送了什麼給 LLM、哪些東西不會離開本機）、需求（Node ≥ 22、已登入 Claude Code 或 Codex）、FAQ。
- [ ] LICENSE（MIT）。
- [ ] `npm pack --dry-run` 確認只包含 `dist/` 與必要檔案（含 `map.md` / `reduce.md`、內嵌的英文字型、resvg wasm），不含 fixture、plans、測試。
- [ ] 套件大小與 `npx prompt-profile --version` 的冷啟動時間記錄在 PR 中（`npx` 使用者每次都要下載）。
- [ ] 已確認 npm 上 `prompt-profile` 目前未被使用（2026-10 查詢為 404），發佈前再確認一次。

## 版本與 changelog

- 使用 Changesets 或 release-please（擇一，建議 release-please，搭配 Conventional Commits 可以自動產生 changelog）。
- 第一個版本：`0.1.0`。

## GitHub Actions：`.github/workflows/release.yml`

- 在 release PR 合併時：build → test → `npm publish --provenance --access public`。
- 使用 npm 的 Trusted Publishing（OIDC），不要在 repo 中存放 npm token。

## 之後（不在這次範圍內，只記錄方向）

- **獨立執行檔**：`bun build --compile`，為 darwin-arm64 / darwin-x64 / linux-x64 / linux-arm64 / win-x64 各產生一個，放到 GitHub Releases。要先確認 satori / resvg 的原生模組能被打包。
- **Homebrew**：建立 `EricTsai83/homebrew-tap`，formula 指向 GitHub Releases 的執行檔。
- **install.sh**：`curl -fsSL …/install.sh | sh`。
- 新的 adapter：Gemini CLI、Cursor、opencode…（參考 ccusage 的 `rust/adapters/` 列表）。只需要實作 `SourceAdapter` 並登記到 registry。
- 監控上游格式變動：每次 Claude Code / Codex 大改版時，在本機跑一次 `pnpm test:smoke`，看各過濾規則的排除數量是否突然改變。

## 驗收標準

- [ ] 在一台乾淨的環境（例如新的 Docker container + 登入的 claude）執行 `npx prompt-profile`，能從頭跑到尾
- [ ] npm 套件頁面顯示 provenance
