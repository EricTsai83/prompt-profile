/**
 * The offline comparison page and manual review template of an experiment (plan 22 §4–5).
 * Everything is local and relative: no server, external script, font or network request.
 * Generated text is escaped; the page script reads data from an inert JSON block.
 */
import { createHash } from "node:crypto"
import { LANGUAGES, type Language, type Profile } from "../../src/domain/Profile.ts"
import { diffProfiles, summarizeVariant, type Range } from "./compare.ts"
import type { CaseResult, Manifest, RenderRecord } from "./execute.ts"
import type { Loaded } from "./render.ts"

export const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

/** JSON safe inside a <script> data block: no "</script>", "<!--" or line separators. */
export const jsonForScript = (data: unknown): string =>
  JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replaceAll(String.fromCharCode(0x2028), "\\u2028")
    .replaceAll(String.fromCharCode(0x2029), "\\u2029")

const hash = (s: string) => `'sha256-${createHash("sha256").update(s).digest("base64")}'`

const STYLE = `
:root{color-scheme:light dark;--bg:#f6f7f9;--fg:#18202c;--muted:#5a6473;--line:#d5dae1;--panel:#fff;--bad:#a4262c;--ok:#1f7a3a}
@media (prefers-color-scheme:dark){:root{--bg:#14171c;--fg:#e8ebef;--muted:#a3abb7;--line:#343b46;--panel:#1c2027;--bad:#ff8a8f;--ok:#7bd88f}}
*{box-sizing:border-box}
body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header,main{padding:16px 24px;max-width:1800px;margin:auto}
h1{font-size:1.4rem;margin:0 0 4px}h2{font-size:1.15rem;margin:28px 0 8px}h3{font-size:1rem;margin:12px 0 4px}
.muted{color:var(--muted)}.bad{color:var(--bad)}.ok{color:var(--ok)}
.controls{display:flex;flex-wrap:wrap;gap:12px;align-items:end;padding:12px 0;position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);z-index:1}
label{display:flex;flex-direction:column;font-size:.85rem;color:var(--muted)}
select{font:inherit;padding:4px 6px;min-width:10rem}
select:focus-visible,a:focus-visible{outline:3px solid #4b7bec;outline-offset:2px}
.panes{display:grid;grid-template-columns:1fr;gap:16px;margin-top:12px}
@media (min-width:1000px){.panes{grid-template-columns:1fr 1fr}}
.pane{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px;min-width:0}
.pane img{width:100%;height:auto;border:1px solid var(--line);margin:8px 0}
.pane iframe{width:100%;height:80vh;border:1px solid var(--line);background:#fff}
.meta{margin:0;display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;font-size:.88rem}
.meta dt{color:var(--muted)}.meta dd{margin:0;overflow-wrap:anywhere}
table{border-collapse:collapse;width:100%;font-size:.88rem;margin:8px 0}
th,td{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
th{background:var(--panel)}
.scroll{overflow-x:auto}
`

const SCRIPT = `
const data = JSON.parse(document.getElementById("data").textContent);
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
const link = (href, text) => { const a = el("a", text); a.href = href; return a; };
function pane(target, variant, title) {
  const persona = $("persona").value, repeat = $("repeat").value, lang = $("lang").value, look = $("look").value;
  const c = data.cases[persona + "/" + variant + "/r" + repeat];
  target.replaceChildren();
  target.append(el("h3", title + ": " + variant));
  if (!c) { target.append(el("p", "No such case.", "bad")); return; }
  const dl = el("dl", undefined, "meta");
  for (const [k, v] of c.labels) { dl.append(el("dt", k), el("dd", v)); }
  target.append(dl);
  if (c.status !== "ok") { target.append(el("p", "Not available: " + c.status + (c.error ? " (" + c.error + ")" : ""), "bad")); return; }
  const r = c.renders[look];
  if (!r || !r.html) { target.append(el("p", "Not rendered" + (r && r.error ? ": " + r.error : "") + ".", "bad")); return; }
  const links = el("p");
  links.append(link(r.html, "Open full report"), " · ", link(c.dir + "/profile.json", "profile.json"), " · ", link(c.dir + "/run.json", "run.json"), " · ", link(c.dir + "/quality.json", "quality.json"));
  target.append(links);
  const card = r.cards[lang];
  if (card && card.file) { const img = el("img"); img.src = card.file; img.alt = "Card (" + lang + ") for " + variant + ", repeat " + repeat; img.loading = "lazy"; target.append(img); }
  else target.append(el("p", "No " + lang + " card" + (card && card.error ? ": " + card.error : " (language not generated)") + ".", "bad"));
  const frame = el("iframe"); frame.title = "Report for " + variant + ", repeat " + repeat; frame.src = r.html; frame.loading = "lazy";
  target.append(frame);
}
function update() {
  pane($("base"), data.baseline, "Baseline");
  pane($("cand"), $("variant").value, "Candidate");
  const key = [$("persona").value, $("repeat").value, $("variant").value, $("lang").value].join("|");
  for (const s of document.querySelectorAll("[data-diff]")) s.hidden = s.dataset.diff !== key;
}
for (const id of ["persona", "repeat", "variant", "lang", "look"]) $(id).addEventListener("change", update);
update();
`

const td = (s: string | number) => `<td>${escapeHtml(String(s))}</td>`
const fmtRange = (r: Range | null, unit = "") =>
  r === null
    ? "unknown"
    : r.min === r.max
      ? `${r.min}${unit} (n=${r.n})`
      : `${r.min}–${r.max}${unit} (n=${r.n})`
const seconds = (ms: number | null) => (ms === null ? "–" : `${Math.round(ms / 1000)}s`)

const caseLabels = (m: Manifest, c: CaseResult): Array<[string, string]> => {
  const o = c.effectiveOptions
  return [
    ["engine", o.engine],
    ["requested model", c.model.requested ?? "CLI default (not a stable named model)"],
    ["reported model", c.model.reported.join(", ") || "not reported"],
    ...(c.model.echoed.length > 0
      ? [["echoed model (unverified)", c.model.echoed.join(", ")] as [string, string]]
      : []),
    ["options", `full ${o.full}; languages ${o.languages.join(", ")}; time zone ${o.timezone}`],
    [
      "differs from baseline",
      c.changedFactors.join(", ") || (c.variant === m.config.baseline ? "baseline" : "nothing"),
    ],
    ["status", c.status + (c.error ? ` (${c.error})` : "")],
    [
      "duration / attempts",
      `${seconds(c.durationMs)} / ${c.calls.attempts} (${c.calls.failedAttempts} failed)`,
    ],
    [
      "rubric (heuristic)",
      c.quality === null
        ? "–"
        : c.quality.passed
          ? "passed"
          : `failed: ${c.quality.failures.join("; ")}`,
    ],
  ]
}

const diffTable = (
  title: string,
  rows: ReadonlyArray<{ field: string; baseline: string; candidate: string }>,
) =>
  rows.length === 0
    ? `<h3>${escapeHtml(title)}</h3><p class="muted">No difference.</p>`
    : `<h3>${escapeHtml(title)}</h3><div class="scroll"><table><tr><th>Field</th><th>Baseline</th><th>Candidate</th></tr>${rows
        .map((r) => `<tr>${td(r.field)}${td(r.baseline)}${td(r.candidate)}</tr>`)
        .join("")}</table></div>`

export const buildIndex = (manifest: Manifest, profiles: ReadonlyMap<string, Loaded>): string => {
  const { config } = manifest
  const profile = (id: string): Profile | null => {
    const l = profiles.get(id)
    return l?.ok ? l.profile : null
  }
  const rendersOf = (id: string) =>
    Object.fromEntries(
      manifest.renders
        .filter((r: RenderRecord) => r.case === id)
        .map((r) => [
          r.look,
          {
            html: r.html,
            error: r.error,
            cards: Object.fromEntries(
              r.cards.map((c) => [c.language, { file: c.file, error: c.error }]),
            ),
          },
        ]),
    )
  const data = {
    baseline: config.baseline,
    cases: Object.fromEntries(
      manifest.cases.map((c) => [
        c.id,
        {
          status: c.status,
          error:
            c.error ??
            (profiles.get(c.id)?.ok === false
              ? (profiles.get(c.id) as { error: string }).error
              : null),
          dir: c.dir,
          labels: caseLabels(manifest, c),
          renders: rendersOf(c.id),
        },
      ]),
    ),
  }

  const options = (values: ReadonlyArray<string>, selected?: string) =>
    values
      .map(
        (v) =>
          `<option value="${escapeHtml(v)}"${v === selected ? " selected" : ""}>${escapeHtml(v)}</option>`,
      )
      .join("")
  const repeats = Array.from({ length: config.repeats }, (_, i) => String(i + 1))
  const candidates = config.variants.map((v) => v.id)
  const firstCandidate = candidates.find((v) => v !== config.baseline) ?? config.baseline
  const renderedLooks = [...new Set(manifest.renders.map((r) => r.look))]
  const looks = renderedLooks.length > 0 ? renderedLooks : config.looks
  const languages = LANGUAGES.filter((l) =>
    config.variants.some((v) => v.options.languages.includes(l)),
  )

  // Content comparison, precomputed for every persona/repeat/candidate/language.
  const diffs: Array<string> = []
  for (const persona of config.personas)
    for (const repeat of repeats)
      for (const variant of candidates)
        for (const lang of languages) {
          const key = [persona, repeat, variant, lang].join("|")
          const a = profile(`${persona}/${config.baseline}/r${repeat}`)
          const b = profile(`${persona}/${variant}/r${repeat}`)
          const body =
            a === null || b === null
              ? `<p class="bad">Cannot compare: ${a === null ? "baseline" : "candidate"} has no usable profile.</p>`
              : (() => {
                  const d = diffProfiles(a, b, lang as Language)
                  return (
                    diffTable("Structured decisions", d.decisions) +
                    diffTable("Wording", d.wording) +
                    diffTable("Missing content", d.missing)
                  )
                })()
          diffs.push(`<section data-diff="${escapeHtml(key)}" hidden>${body}</section>`)
        }

  const caseRows = manifest.cases
    .map(
      (c) =>
        `<tr>${td(c.order)}${td(c.persona)}${td(c.variant)}${td(c.repeat)}<td class="${c.status === "ok" ? "ok" : "bad"}">${escapeHtml(c.status + (c.error ? ` (${c.error})` : ""))}</td>${td(seconds(c.durationMs))}${td(c.calls.attempts)}${td(c.calls.failedAttempts)}${td(c.usage.inputTokens ?? "unknown")}${td(c.usage.outputTokens ?? "unknown")}${td(c.quality === null ? "–" : c.quality.passed ? "passed" : c.quality.failures.join("; "))}${td(c.startedAt ?? "–")}</tr>`,
    )
    .join("")

  const summaries = config.personas.flatMap((persona) =>
    config.variants.map((v) => {
      const cases = manifest.cases.filter((c) => c.persona === persona && c.variant === v.id)
      return summarizeVariant(
        cases,
        cases.flatMap((c) => {
          const p = profile(c.id)
          return p === null ? [] : [p]
        }),
      )
    }),
  )
  const summaryRows = summaries
    .map(
      (s) =>
        `<tr>${td(s.persona)}${td(s.variant)}${td(`${s.ok}/${s.cases}`)}${td(fmtRange(s.durationMs === null ? null : { ...s.durationMs, min: Math.round(s.durationMs.min / 1000), max: Math.round(s.durationMs.max / 1000) }, "s"))}${td(fmtRange(s.attempts))}${td(fmtRange(s.failedAttempts))}${td(fmtRange(s.inputTokens))}${td(fmtRange(s.outputTokens))}${td(`${s.rubricPassed}/${s.ok}`)}${td(
          Object.entries(s.agreement)
            .map(
              ([field, counts]) =>
                `${field}: ${Object.entries(counts)
                  .map(([v, n]) => `${v}×${n}`)
                  .join(", ")}`,
            )
            .join(" | ") || "–",
        )}</tr>`,
    )
    .join("")

  const p = manifest.provenance
  // Built from constants and base64 hashes only: nothing here needs escaping.
  const csp = [
    "default-src 'none'",
    `script-src ${hash(SCRIPT)}`,
    `style-src ${hash(STYLE)}`,
    "img-src 'self' file: data:",
    "frame-src 'self' file:",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ")

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Profile experiment ${escapeHtml(manifest.experimentId)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
<h1>Profile experiment ${escapeHtml(manifest.experimentId)}</h1>
<p>Outcome: <strong class="${manifest.outcome === "passed" ? "ok" : "bad"}">${escapeHtml(manifest.outcome)}</strong> · CLI attempts ${escapeHtml(String(manifest.budget.used))} of ${escapeHtml(String(manifest.budget.cap))} · created ${escapeHtml(manifest.createdAt)} · revision ${escapeHtml(p.git.revision ?? "unknown")}${p.git.dirty ? " (uncommitted changes)" : ""} · prompt-profile ${escapeHtml(p.packageVersion)} · analysis v${escapeHtml(String(p.versions.analysis))}, pipeline v${escapeHtml(String(p.versions.pipeline))}, profile v${escapeHtml(String(p.versions.profileSchema))}</p>
<p class="muted">Baseline: ${escapeHtml(config.baseline)}. Same prepared input for every case of a persona. A null model means the CLI's own default, not a stable named model. Codex does not report its model; an echoed name is only what was requested. Rubric checks are heuristics: passing them does not establish portrait quality. A few repetitions show variation, not statistical significance. <a href="review.md">Manual review template</a> · <a href="manifest.json">manifest.json</a></p>
</header>
<main>
<div class="controls" role="group" aria-label="Choose what to compare">
<label>Persona<select id="persona">${options(config.personas)}</select></label>
<label>Repeat<select id="repeat">${options(repeats)}</select></label>
<label>Candidate variant<select id="variant">${options(candidates, firstCandidate)}</select></label>
<label>Card and comparison language<select id="lang">${options(languages)}</select></label>
<label>Look<select id="look">${options(looks)}</select></label>
</div>
<p class="muted">Each embedded report keeps its own language and view switch; use “Open full report” if a browser blocks local frames.</p>
<div class="panes"><section class="pane" id="base" aria-live="polite"></section><section class="pane" id="cand" aria-live="polite"></section></div>
<h2>Content comparison (baseline → candidate)</h2>
${diffs.join("\n")}
<h2>Variants: repeat ranges and agreement</h2>
<p class="muted">Ranges cover successful repeats only. Agreement counts each structured decision across repeats of one variant, separately from differences between variants.</p>
<div class="scroll"><table><tr><th>Persona</th><th>Variant</th><th>OK</th><th>Duration</th><th>Attempts</th><th>Failed attempts</th><th>Input tokens</th><th>Output tokens</th><th>Rubric passed</th><th>Within-variant agreement</th></tr>${summaryRows}</table></div>
<h2>All cases (execution order)</h2>
<div class="scroll"><table><tr><th>#</th><th>Persona</th><th>Variant</th><th>Repeat</th><th>Status</th><th>Duration</th><th>Attempts</th><th>Failed</th><th>Input tokens</th><th>Output tokens</th><th>Rubric (heuristic)</th><th>Started</th></tr>${caseRows}</table></div>
</main>
<script type="application/json" id="data">${jsonForScript(data)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`
}

/** A manual review sheet linked to exact cases; filled in by a person, never by a model. */
export const buildReview = (manifest: Manifest): string => {
  const { config } = manifest
  const lines = [
    `# Manual review — experiment ${manifest.experimentId}`,
    "",
    "Read the full reports and cards in `index.html`. Fill in each section; cite case ids.",
    "Rubric results are heuristics; this review is the judgement that matters.",
    "",
    "Criteria (note 1–5 and a reason): fidelity to evidence, specificity, contradictions,",
    "usefulness, language quality, report readability, card fit.",
    "",
  ]
  for (const persona of config.personas)
    for (let r = 1; r <= config.repeats; r++) {
      lines.push(`## ${persona}, repeat ${r}`, "")
      for (const v of config.variants) {
        const c = manifest.cases.find((x) => x.id === `${persona}/${v.id}/r${r}`)
        const status = c?.status ?? "missing"
        lines.push(
          `### ${v.id}${v.id === config.baseline ? " (baseline)" : ""} — ${status}`,
          "",
          c && status === "ok" ? `Case: \`${c.dir}\`` : `No profile (${c?.error ?? status}).`,
          "",
          "- Fidelity to evidence:",
          "- Specificity:",
          "- Contradictions:",
          "- Usefulness:",
          "- Language quality:",
          "- Report readability:",
          "- Card fit:",
          "",
        )
      }
      lines.push("Preferred output and reasons:", "", "")
    }
  return lines.join("\n")
}
