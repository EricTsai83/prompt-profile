# 01 · 專案初始化

## 目標

建立一個可以 build、test、lint 的空專案，並寫好給 AI agent 看的 `AGENTS.md`。

## 步驟

1. **package.json**
   - `"name": "prompt-profile"`、`"type": "module"`、`"bin": { "prompt-profile": "./dist/bin.js" }`
   - `"engines": { "node": ">=22" }`、`"packageManager": "pnpm@10.x"`（用本機版本）
   - `"files": ["dist"]`
   - scripts：`build`（tsdown）、`dev`（`tsx src/bin.ts`；統一用 tsx，避免 Node 22 / 24 的 strip-types 行為差異）、`typecheck`（`tsc --noEmit`）、`lint`（oxlint）、`format`（oxfmt）、`test`（vitest run）、`test:smoke`
2. **pnpm-workspace.yaml**（即使是單一 package，也用它放設定，參考 ccusage）
   ```yaml
   catalogMode: strict
   minimumReleaseAge: 2880   # 套件發佈滿 2 天才安裝
   strictDepBuilds: true
   blockExoticSubdeps: true
   trustPolicy: no-downgrade
   allowBuilds: {}   # 目前沒有需要執行 install script 的依賴；新增時要在 PR 中說明理由
   ```
   > 若本機 pnpm 版本不支援某個欄位，移除該欄位並在 commit 訊息中註明。
3. **安裝依賴**（`effect` 與 `@effect/platform-node` 鎖定精確版本，不加 `^`）
   - dependencies：`effect@4.0.6`、`@effect/platform-node@4.0.6`
   - devDependencies：`typescript`、`tsdown`、`vitest`、`@effect/vitest`、`oxlint`、`oxfmt`、`@types/node`
   - 圖卡相關套件（satori、resvg）留到 plan 08 再裝。
4. **tsconfig.json**：`strict: true`、`module: "NodeNext"`、`moduleResolution: "NodeNext"`、`target: "ES2023"`、`exactOptionalPropertyTypes: true`、`noUncheckedIndexedAccess: true`、`verbatimModuleSyntax: true`
5. **tsdown.config.ts**：entry `src/bin.ts`，輸出 ESM 到 `dist/`，加上 shebang `#!/usr/bin/env node`。
6. **最小的 CLI**：`src/bin.ts` 只呼叫 `src/cli/main.ts`；`main.ts` 用 `effect/cli` 的 `Command.make("prompt-profile")` + `Command.run`，搭配 `@effect/platform-node` 的 runtime 與 layer，只印出版本號。
   - 寫之前先讀 `node_modules/effect/dist/cli/Command.d.ts` 裡 `make` 與 `run` 的 JSDoc 範例。
   - 版本號從 `package.json` 讀取（tsdown 在 build 時注入常數），不要手寫在程式碼裡。
7. **測試骨架**：`test/cli.test.ts`，用 `Command.runWith` 傳入參數，驗證 `--version` 會輸出版本號。
8. **AGENTS.md**（根目錄，給 AI agent 看），內容包含：
   - 專案目的（連到 `plans/README.md`）
   - 目錄結構與各目錄的責任
   - 指令：`pnpm build / test / lint / typecheck`
   - 規範：TDD、fixture 不放真實個資、Effect 4 API 要查 `.d.ts`、Conventional Commits
   - 並建立 `CLAUDE.md`，內容只有一行 `@AGENTS.md`
9. **.gitignore**：`node_modules`、`dist`、`.prompt-profile/`、`coverage`
10. **GitHub Actions**：`.github/workflows/ci.yml`，在 `ubuntu-latest` × Node 22 / 24，以及 `macos-latest` × Node 24 上跑 `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build`。

## 驗收標準

- [ ] `pnpm build` 成功，`node dist/bin.js --version` 印出版本號
- [ ] `pnpm typecheck && pnpm lint && pnpm test` 全過
- [ ] `AGENTS.md`、`CLAUDE.md`、CI workflow 都存在
- [ ] push 後 GitHub Actions 通過
