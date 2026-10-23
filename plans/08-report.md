# 08 · 報告輸出：HTML 報告 + PNG 圖卡

## 目標

輸入 `Profile`，輸出：
1. `report.html`：**單一檔案**，所有 CSS、資料、圖片都內嵌，可以離線開啟
2. `card.png`：1200 × 630 的分享圖卡（社群平台預覽圖的標準比例）

這個 plan 只依賴 plan 02 的 Schema，可以用假的 `Profile` 先開發。

## 1. HTML 報告：`src/report/html.ts`

- 用 TypeScript template string 產生 HTML，**不引入前端框架**。CSS 直接寫在 `<style>` 中。
- 所有插入的文字都必須做 HTML escape（prompt 節錄可能含有 `<script>` 之類的內容）。寫一個 tagged template（例如 `html\`…\``）自動 escape 所有插值，只有明確標記為 `raw()` 的內容不 escape，避免某個地方忘記 escape。
- 若需要把資料以 JSON 嵌入 `<script>`，要把 `<` 跳脫成 `\u003c`（防止 `</script>` 提前結束標籤）。MVP 盡量不用 JavaScript：展開證據用 `<details>`。
- 支援淺色 / 深色（`prefers-color-scheme`）。
- 頁面區塊：
  1. **開頭**：headline、archetype 名稱與說明、分析期間、prompt 數與 session 數（來自 `coverage`，抽樣時要說明）
  2. **數字**：stats 卡片（總 prompt 數、最活躍時段、中英比例、最長連續天數、最晚工作時間…）
  3. **活動熱力圖**：星期 × 小時（用 inline SVG 畫，不用圖表套件）
  4. **特質**：每個 trait 一張卡片，含 confidence，可以展開看證據原文
  5. **五個面向**：每個面向的摘要與證據
  6. **有趣的事實**
  7. **頁尾**：分析引擎與模型、產生時間、「已驗證 N 筆證據」、略過的段落數（若有）、隱私說明（資料只在本機讀取，遮蔽後的 prompt 送到你自己的 Claude Code / Codex 帳號分析）、專案連結
- 文字依 `profile.language` 切換中英文（介面文字放在 `src/report/i18n.ts`）。

## 2. PNG 圖卡：`src/report/card.tsx`

- 使用 `satori`（JSX → SVG）+ **`@resvg/resvg-wasm`**（SVG → PNG）。
  - 選 wasm 版而不是 `@resvg/resvg-js`（原生模組）：不需要 `allowBuilds`、不會因平台缺少 prebuilt binary 而安裝失敗，之後用 `bun build --compile` 做獨立執行檔也比較單純。效能差異對一張圖卡來說可以忽略。
  - 用 JSX 時 tsconfig 要設定 `jsx: "react-jsx"` 與 `jsxImportSource`；或不用 JSX，直接傳 satori 接受的物件結構，少一個依賴。實作時擇一並在 PR 中說明。
- 內容：archetype 名稱、headline、3 個 trait 名稱、2–3 個關鍵數字、專案名稱 / 網址。
- **不放任何 prompt 原文**（圖卡是要公開分享的）。

### 字型（要特別注意）

- satori **必須提供字型檔**，而且要支援中文。
- 完整的 Noto Sans TC 有好幾 MB，不適合直接放進 npm 套件。做法二選一（實作時評估後決定，並在 PR 中說明）：
  - **A（建議）**：第一次產生圖卡時下載字型到 `~/.cache/prompt-profile/fonts/`，之後使用快取。下載失敗時只輸出 HTML，並提示使用者。
    - 下載網址與 SHA-256 寫死在程式碼中，下載後驗證 hash；不符時視為下載失敗。
    - 這是除了 LLM 之外**唯一的網路請求**，要在 README 的隱私說明中寫出來。
  - B：只內嵌常用字的 subset（約 1 MB），遇到缺字時用備用字型。
- 英文字型（例如 Inter）可以直接內嵌在套件中。

## 3. 輸出位置

- 預設：`./prompt-profile-report/`，裡面有 `report.html`、`card.png`、`profile.json`。
- `--out <dir>` 可以修改。
- 資料夾已存在時直接覆寫這三個檔案（不刪除資料夾中的其他檔案）。
- 圖卡產生失敗不讓整體失敗：HTML 與 `profile.json` 照常輸出，並提示原因。

## 測試

- `test/fixtures/profile.sample.json`：一份完整的假 profile（中文版、英文版各一份）。
- HTML：snapshot；確認含有 `<script>` 的 quote 被 escape；確認沒有對外部網址的請求（沒有 `<link href="http…">`、`<script src=…>`）。
- 圖卡：能產生 PNG（檢查 PNG 檔頭與尺寸）。不需要做像素比對。
- 開發用指令：`pnpm dev:report` 用 sample profile 產生報告，方便直接用瀏覽器調整版面。

## 驗收標準

- [ ] 用 sample profile 產出的 HTML 在 Chrome / Safari 中正常顯示（淺色 / 深色都要）
- [ ] 中文圖卡沒有缺字（豆腐字）
- [ ] HTML 在沒有網路的狀況下也能完整顯示
