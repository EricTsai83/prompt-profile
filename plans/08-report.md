# 08 · Report output: HTML report + PNG card

Status: implemented; the report was redesigned in plans 14–18 (languages, looks, one report with `--exclude`). Acceptance checked 2026-10-24.

## Goal

Take a `Profile` and output:
1. `report.html`: **a single file** with all CSS, data and images inlined, openable offline
2. `card.png`: a 1200 × 630 share card (the standard aspect ratio for social media previews)

This plan depends only on plan 02's Schemas and can be developed against a fake `Profile` first.

## 1. HTML report: `src/report/html.ts`

- Generate HTML with TypeScript template strings, **without a frontend framework**. CSS goes directly in `<style>`.
- All inserted text must be HTML-escaped (prompt excerpts may contain things like `<script>`). Write a tagged template (e.g. `html\`…\``) that escapes every interpolation automatically, with only content explicitly marked `raw()` left unescaped, so no spot can forget to escape.
- If data must be embedded as JSON in a `<script>`, escape `<` as `\u003c` (so `</script>` cannot close the tag early). The MVP avoids JavaScript where possible: use `<details>` to expand evidence.
- Supports light / dark (`prefers-color-scheme`).
- Page sections:
  1. **Header**: headline, archetype name and description, analysis period, prompt and session counts (from `coverage`; explain when sampled)
  2. **Numbers**: stats cards (total prompts, most active hours, Chinese / English ratio, longest streak, latest working time…)
  3. **Activity heatmap**: weekday × hour (drawn with inline SVG, no charting library)
  4. **Traits**: one card per trait, with confidence, expandable to show the original evidence
  5. **Five dimensions**: each dimension's summary and evidence
  6. **Fun facts**
  7. **Footer**: analysis engine and model, generation time, "N pieces of evidence verified", number of skipped chunks (if any), privacy note (data is read only locally; redacted prompts are sent to your own Claude Code / Codex account for analysis), project link
- Text switches between Chinese and English according to `profile.language` (UI strings live in `src/report/i18n.ts`). (Plan 14 brought languages back: en and zh-TW, texts in `src/report/messages.ts`.)

## 2. PNG card: `src/report/card.tsx`

- Uses `satori` (JSX → SVG) + **`@resvg/resvg-wasm`** (SVG → PNG).
  - The wasm build is chosen over `@resvg/resvg-js` (a native module): it needs no `allowBuilds`, does not fail to install on platforms without a prebuilt binary, and keeps a later standalone binary via `bun build --compile` simpler. The performance difference is negligible for a single card.
  - Using JSX requires `jsx: "react-jsx"` and `jsxImportSource` in tsconfig; alternatively skip JSX and pass satori's object structure directly, saving a dependency. Pick one during implementation and explain it in the PR.
- Content: archetype name, headline, 3 trait names, 2–3 key numbers, project name / URL.
- **No original prompt text at all** (the card is meant to be shared publicly).

### Fonts (needs special care)

(Plan 14 brought this back: Noto Sans TC is downloaded once and verified by SHA-256 for zh-TW cards.)

- satori **must be given font files**, and they must support Chinese.
- The full Noto Sans TC is several MB, too big to ship directly in the npm package. Choose one of two approaches (decide after evaluating during implementation, and explain in the PR):
  - **A (recommended)**: download the font to `~/.cache/prompt-profile/fonts/` the first time a card is generated, and use the cached copy afterwards. If the download fails, output only the HTML and tell the user.
    - The download URL and SHA-256 are hard-coded; verify the hash after downloading, and treat a mismatch as a failed download.
    - This is the **only network request** apart from the LLM, and it must be disclosed in the README's privacy section.
  - B: embed only a subset of common characters (about 1 MB) and fall back to a backup font for missing glyphs.
- A Latin font (e.g. Inter) can be embedded directly in the package.

## 3. Output location

- Default: `./prompt-profile-report/`, containing `report.html`, `card.png`, `profile.json`.
- Can be changed with `--out <dir>`.
- If the directory already exists, these three files are overwritten (other files in the directory are not deleted).
- A card generation failure does not fail the whole run: HTML and `profile.json` are written as usual, and the reason is shown.

## Tests

- `test/fixtures/profile.sample.json`: a complete fake profile (one Chinese version and one English version). (Plan 14 brought languages back: en and zh-TW, texts in `src/report/messages.ts`.)
- HTML: snapshot; confirm a quote containing `<script>` is escaped; confirm there are no requests to external URLs (no `<link href="http…">`, `<script src=…>`).
- Card: a PNG can be produced (check the PNG header and dimensions). No pixel comparison needed.
- Development command: `pnpm dev:report` generates a report from the sample profile, so the layout can be tweaked directly in a browser.

## Acceptance criteria

- [x] HTML generated from the sample profile displays correctly in Chrome / Safari (both light and dark) — Chrome and WebKit 26.5 (plan 13 item 5); the Safari app itself not opened
- [x] The Chinese card has no missing glyphs (tofu) (Plan 14 brought languages back: en and zh-TW, texts in `src/report/messages.ts`.)
- [x] The HTML displays completely without a network connection (CSP `default-src 'none'`, everything inlined)
