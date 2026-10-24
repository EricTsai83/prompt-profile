# 14 · Report redesign and multiple languages

Status: in progress (2026-10-24). Owner request: the HTML report has too much text; it needs
more charts, collapsible sections and a shorter title, no "My AI collaboration profile"
eyebrow, and a language switch. This reverses the English-only decision of commit `476e6aa`
for the **product output**; the repository itself stays English.

## Owner decisions (2026-10-24)

| Question | Decision |
| --- | --- |
| Languages | English (`en`) and Traditional Chinese (`zh-TW`) first; languages are a data array |
| Generated content | Written once in English, then one translation call per extra language; quotes and evidence are reused by code, never translated or re-verified |
| Share card | One card per language: `card.png` (default language) and `card.<lang>.png` |
| Default | From the system locale: a `zh*` locale gives `zh-TW,en`, anything else `en`; `--lang` overrides (first = default) |

## Behaviour

- `prompt-profile --lang zh-TW,en`: analyse (English), translate to each non-English language
  (+1 call each, counted in the estimate and `--max-calls`), render one report with a language
  switch and one card per language. A failed translation drops that language with a warning;
  the English profile is never lost.
- `render` re-renders the languages stored in the profile; no LLM call.
- The switch works without JavaScript (radio inputs + CSS), so the report keeps its strict
  Content-Security-Policy and stays offline. The default language is shown first.
- The CLI's own terminal messages stay English.

## Profile format (schemaVersion 3)

- New `languages`: the offered languages, default first.
- New `translations`: per non-English language, the generated text only (headline, archetype,
  dimension titles/summaries, trait names/descriptions, fun facts), aligned with the English
  fields by key/index. Evidence, confidence, coverage and stats exist once.
- Version 2 files are read as English-only (`languages: ["en"]`, no translations).
- `ANALYSIS_VERSION` bump: new translation prompt; reduce gets length limits (headline ≤ 12
  words, archetype description ≤ 2 short sentences) because the owner found titles too long.

## Report layout

1. Language switch and look identity; archetype as the title with a one-line headline. No eyebrow.
2. Four metric tiles: prompts, active days, longest streak, peak hour.
3. Charts drawn as inline SVG from `stats` only: prompts by hour (peak highlighted), by
   weekday, language mix, sources, and the weekday × hour heatmap (collapsible).
4. Traits as compact cards with a confidence meter; evidence collapsed.
5. Five dimensions as an accordion: title and summary first line visible, details and
   evidence collapsed. Missing-evidence warnings stay visible on the collapsed row.
6. Fun facts as short tiles; "About this report" (engine, coverage, privacy) collapsed.

Invariants from plans 11–12 still hold: every quote, warning, confidence label and statistic is
present in every language and look; the card has no quotes or project names; no network
requests from the report. The card's CJK font (Noto Sans TC, pinned URL + SHA-256) is downloaded
on the first non-Latin card and cached; that is the renderer's only network request.

## Tests

Schema v2 → v3 decoding; translation shape validation and failure fallback; call estimate
includes translations; every language present in the HTML with the same quotes; the switch
markup; per-language cards (font download mocked, checksum enforced); `--lang` parsing and
locale default; snapshot of the new layout; package check renders a bilingual report.
