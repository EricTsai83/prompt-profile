import type { Stats } from "../domain/Stats.ts"
import {
  TOOL_TECHNIQUES,
  type PromptTechnique,
  type SkillUse,
  type Techniques,
  type ToolTechnique,
} from "../domain/Techniques.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import type { Messages } from "./messages.ts"
import type { Visibility } from "./visibility.ts"

/** Free text as shown: project names replaced when they are hidden. */
export type Say = (text: string) => Raw | string

/**
 * "How I work with AI" as a capability map (plan 17, the owner's choice): an adoption
 * timeline, then five stages — plan, delegate, extend, verify, ship — each with its measures
 * and a named breakdown (skills with their description, subagent types, MCP servers, models).
 * Counts and names only. With `--exclude custom-names`, custom names are counted, not shown.
 */

/**
 * Names shown even with `--exclude custom-names` (an extensible data list): built-in or widely
 * used ones.
 */
export const PUBLIC_SUBAGENT_TYPES: ReadonlySet<string> = new Set([
  "general-purpose",
  "Explore",
  "Plan",
  "statusline-setup",
])
export const PUBLIC_MCP_SERVERS: ReadonlySet<string> = new Set([
  "github",
  "gitlab",
  "linear",
  "slack",
  "notion",
  "figma",
  "sentry",
  "vercel",
  "cloudflare",
  "playwright",
  "puppeteer",
  "context7",
  "supabase",
  "stripe",
  "atlassian",
  "jira",
  "postgres",
  "filesystem",
  "google-drive",
])
/** Public: listed above, or a claude.ai connector / plugin-provided server. */
const isPublicServer = (name: string) =>
  PUBLIC_MCP_SERVERS.has(name.toLowerCase()) ||
  name.startsWith("claude_ai_") ||
  name.startsWith("plugin_")
const isPublicSkill = (s: SkillUse) => s.origin === "builtin" || s.origin === "plugin"

type Stage = "plan" | "delegate" | "extend" | "verify" | "ship"

/** Which measures belong to which stage (data, in reading order). */
const STAGES: ReadonlyArray<{
  readonly id: Stage
  readonly tools: ReadonlyArray<ToolTechnique>
  readonly prompts: ReadonlyArray<PromptTechnique>
}> = [
  { id: "plan", tools: ["planMode"], prompts: ["planFirst", "structured", "acceptance"] },
  { id: "delegate", tools: ["subagents", "background", "worktrees", "askUser"], prompts: [] },
  { id: "extend", tools: ["skills", "mcp", "web"], prompts: [] },
  {
    id: "verify",
    tools: [],
    prompts: [
      "verification",
      "context",
      "filePaths",
      "constraints",
      "examples",
      "whyExplain",
      "outputFormat",
    ],
  },
  { id: "ship", tools: ["pullRequests"], prompts: [] },
]

const pct = (x: number) => Math.round(x * 100)

const monthName = (ym: string, m: Messages, year = false) =>
  new Intl.DateTimeFormat(m.locale, {
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${ym}-01T00:00:00Z`))

const dayName = (date: string, m: Messages) =>
  new Intl.DateTimeFormat(m.locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  )

const tipClass = (i: number, n: number) => (i < 2 ? "tip tip-l" : i >= n - 2 ? "tip tip-r" : "tip")

const toolShare = (t: Techniques, k: ToolTechnique) =>
  t.coveredSessions === 0 ? 0 : Math.min(1, t.tools[k].sessions / t.coveredSessions)

// ---- adoption timeline ---------------------------------------------------------------------

/** Workflow techniques × months; months without transcripts are "no data", not "unused". */
const timeline = (t: Techniques, loc: Loc): Raw | null => {
  const rows = TOOL_TECHNIQUES.filter((k) => t.tools[k].sessions > 0).toSorted(
    (a, b) => toolShare(t, b) - toolShare(t, a),
  )
  if (rows.length === 0 || t.monthly.length < 2) return null
  return html`<div class="tech-time" style="--months:${t.monthly.length}">
    <span></span>
    ${t.monthly.map((x) => html`<span class="tt-m">${loc.text((m) => monthName(x.month, m))}</span>`)}
    ${rows.map((k) => {
      const shares = t.monthly.map((x) => (x.covered === 0 ? 0 : x.tools[k] / x.covered))
      const max = Math.max(0.0001, ...shares)
      return html`<span class="tt-name tip tip-l" ${loc.tip((m) => m.toolNames[k][1])} tabindex="-1"
          >${loc.text((m) => m.toolNames[k][0])}</span
        >${t.monthly.map(
          (x, i) =>
            html`<span
              class="tt-c l${x.tools[k] === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((4 * shares[i]!) / max)))}${x.covered === 0 ? " nodata" : ""} ${tipClass(i, t.monthly.length)}"
              ${loc.tip(
                (m) =>
                  `${monthName(x.month, m, true)} · ${x.covered === 0 ? m.noData : `${x.tools[k]} / ${x.covered}`}`,
              )}
              tabindex="-1"
            ></span>`,
        )}`
    })}
  </div>`
}

// ---- stage cards --------------------------------------------------------------------------

const measure = (name: Raw, value: string, share: number, tip: Raw): Raw =>
  html`<li class="cap-m tip tip-l" ${tip} tabindex="-1">
    <span class="cap-name">${name}</span>
    <span class="share-track"><span class="share-fill" style="width:${pct(share)}%"></span></span>
    <b>${value}</b>
  </li>`

const named = (title: Raw, items: ReadonlyArray<Raw>, hidden: Raw | null): Raw | null =>
  items.length === 0 && hidden === null
    ? null
    : html`<div class="cap-named">
        <h4>${title}</h4>
        ${items.length > 0 ? html`<ul>${items}</ul>` : ""}
        ${hidden ? html`<p class="cap-hidden">${hidden}</p>` : ""}
      </div>`

const skillItem = (s: SkillUse, loc: Loc, v: Visibility, say: Say): Raw =>
  html`<li class="cap-item">
    <div class="ci-head">
      <b>${say(s.name)}</b><span class="ci-tag">${loc.text((m) => m.origin[s.origin])}</span>
    </div>
    <p>
      ${
        s.description !== null && (v.customNames || isPublicSkill(s))
          ? say(s.description)
          : loc.text((m) => m.noDescription)
      }
    </p>
    <span class="ci-when"
      >${loc.text((m) =>
        v.dates
          ? m.usedRange(s.sessions, dayName(s.first, m), dayName(s.last, m))
          : m.sessionsUsed(s.sessions),
      )}</span
    >
  </li>`

const chip = (name: string, sessions: number, loc: Loc, say: Say): Raw =>
  html`<li class="cap-chip tip" ${loc.tip((m) => m.sessionsUsed(sessions))} tabindex="-1">
    ${say(name)} <b>${sessions}</b>
  </li>`

const stageDetails = (
  stage: Stage,
  t: Techniques,
  loc: Loc,
  v: Visibility,
  say: Say,
): Array<Raw> => {
  const d = t.details
  const share = !v.customNames
  const blocks: Array<Raw | null> = []
  if (stage === "delegate") {
    const shown = d.subagentTypes.filter((x) => !share || PUBLIC_SUBAGENT_TYPES.has(x.name))
    const hidden = d.subagentTypes.length - shown.length
    blocks.push(
      named(
        loc.text((m) => m.subagentTypes),
        shown.map((x) => chip(x.name, x.sessions, loc, say)),
        hidden > 0 ? loc.text((m) => m.customAgents(hidden)) : null,
      ),
    )
  }
  if (stage === "extend") {
    const skills = d.skills.filter((x) => !share || isPublicSkill(x))
    const hiddenSkills = d.skills.length - skills.length
    const servers = d.mcpServers.filter((x) => !share || isPublicServer(x.name))
    const hiddenServers = d.mcpServers.length - servers.length
    blocks.push(
      named(
        loc.text((m) => m.skillsUsed),
        skills.map((x) => skillItem(x, loc, v, say)),
        hiddenSkills > 0 ? loc.text((m) => m.customSkills(hiddenSkills)) : null,
      ),
      named(
        loc.text((m) => m.mcpServers),
        servers.map((x) => chip(x.name, x.sessions, loc, say)),
        hiddenServers > 0 ? loc.text((m) => m.customServers(hiddenServers)) : null,
      ),
    )
  }
  if (stage === "ship")
    blocks.push(
      named(
        loc.text((m) => m.modelsUsed),
        d.models.map((x) => chip(x.name, x.sessions, loc, say)),
        null,
      ),
    )
  return blocks.filter((x): x is Raw => x !== null)
}

const stageCard = (
  stage: (typeof STAGES)[number],
  t: Techniques,
  loc: Loc,
  v: Visibility,
  say: Say,
): Raw | null => {
  const tools = stage.tools
    .filter((k) => t.tools[k].count > 0)
    .map((k) =>
      measure(
        loc.text((m) => m.toolNames[k][0]),
        k === "pullRequests" ? `${t.tools[k].count} PR` : `${pct(toolShare(t, k))}%`,
        toolShare(t, k),
        loc.tip((m) => `${m.toolNames[k][1]} · ${m.sessionsUsed(t.tools[k].sessions)}`),
      ),
    )
  const prompts = stage.prompts
    .filter((k) => t.prompts[k] > 0)
    .map((k) =>
      measure(
        loc.text((m) => m.promptNames[k][0]),
        `${pct(t.prompts[k])}%`,
        t.prompts[k],
        loc.tip((m) => `${m.promptNames[k][1]} · ${m.ofPrompts(pct(t.prompts[k]))}`),
      ),
    )
  const extra = stageDetails(stage.id, t, loc, v, say)
  const parallel =
    stage.id === "delegate" && t.maxParallel >= 2
      ? html`<p class="tech-callout">${loc.text((m) => m.parallel(t.maxParallel, t.parallelDays))}</p>`
      : null
  if (tools.length + prompts.length + extra.length === 0 && parallel === null) return null
  return html`<article class="cap cap-${stage.id}">
    <div class="cap-lead"><header>
      <h3>${loc.text((m) => m.stages[stage.id][0])}</h3>
      <p>${loc.text((m) => m.stages[stage.id][1])}</p>
    </header>
    ${parallel ?? ""}
    ${tools.length + prompts.length > 0 ? html`<ul class="cap-ms">${tools}${prompts}</ul>` : ""}
    </div>
    ${extra}
  </article>`
}

/** The section body; null without technique data. */
export const techniquesSection = (s: Stats, loc: Loc, v: Visibility, say: Say): Raw | null => {
  const t = s.techniques
  if (t === null) return null
  const cards = STAGES.map((stage) => stageCard(stage, t, loc, v, say)).filter(
    (x): x is Raw => x !== null,
  )
  if (cards.length === 0) return null
  const time = timeline(t, loc)
  return html`${
    time
      ? html`<article class="panel wide">
            <h3>${loc.text((m) => m.adoption)}</h3>
            ${time}
          </article>`
      : ""
  }
    <div class="caps">${cards}</div>`
}

export const techniqueStyle = `
.cap-lead{display:flex;flex-direction:column;gap:12px}
.cap-note{margin:-6px 0 12px}
.tech-callout{display:inline-block;margin:0;padding:5px 12px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:var(--text-xs);font-weight:600;align-self:flex-start}
.tech-time{display:grid;grid-template-columns:minmax(9em,13em) repeat(var(--months),minmax(0,1fr));gap:3px;align-items:center}
.tt-m{font-size:var(--text-2xs);color:var(--muted);text-align:center}
.tt-name{position:relative;font-size:var(--text-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;outline:none}
.tt-c{position:relative;height:20px;border-radius:4px;background:var(--empty);outline:none;transition:box-shadow var(--motion-fast) var(--ease-out)}
.tt-c:hover,.tt-c:focus{box-shadow:0 0 0 2px var(--fg)}
.tt-c.nodata{background:repeating-linear-gradient(135deg,var(--empty) 0 4px,transparent 4px 8px)}
:is(.tt-c).l1{background:color-mix(in srgb,var(--accent) 28%,var(--empty))}
:is(.tt-c).l2{background:color-mix(in srgb,var(--accent) 52%,var(--empty))}
:is(.tt-c).l3{background:color-mix(in srgb,var(--accent) 76%,var(--empty))}
:is(.tt-c).l4{background:var(--accent)}
.caps{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.cap{background:var(--card);border:1px solid var(--border);border-radius:var(--radius-xl);padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.cap-extend{grid-row:span 2}
.cap header h3{font-size:var(--text-lg)}.cap header p{font-size:var(--text-xs);color:var(--muted);margin-top:2px}
.cap-ms{list-style:none;margin:0;padding:0}
.cap-m{position:relative;display:grid;grid-template-columns:minmax(0,13em) 1fr 4.2em;align-items:center;gap:10px;font-size:var(--text-sm);padding:4px 0;outline:none}
.cap-m b{text-align:right;font-size:var(--text-xs);font-variant-numeric:tabular-nums}
.cap-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cap-named h4{margin:0 0 6px;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.cap-named ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.cap-item{padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-md)}
.ci-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ci-head b{font-size:var(--text-sm);overflow-wrap:anywhere}
.ci-tag{font-size:var(--text-2xs);padding:1px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent)}
.cap-item p{font-size:var(--text-xs);color:var(--muted);margin-top:4px}
.ci-when{display:block;font-size:var(--text-xs);color:var(--muted);margin-top:4px}
.cap-named ul:has(.cap-chip){flex-direction:row;flex-wrap:wrap}
.cap-chip{position:relative;padding:4px 10px;border-radius:999px;border:1px solid var(--border);font-size:var(--text-xs);outline:none}
.cap-chip b{color:var(--accent);margin-left:4px}
.cap-hidden{font-size:var(--text-xs);color:var(--muted);margin-top:6px}
@media (max-width:760px){.caps{grid-template-columns:1fr}.cap-extend{grid-row:auto}.tech-time{grid-template-columns:minmax(7em,9em) repeat(var(--months),minmax(0,1fr))}.tt-name{font-size:var(--text-xs)}}
`
