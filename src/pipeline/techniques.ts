import { DateTime } from "effect"
import type { PromptRecord } from "../domain/PromptRecord.ts"
import {
  PROMPT_TECHNIQUES,
  TOOL_TECHNIQUES,
  type PromptTechnique,
  type TechniqueEvent,
  type Techniques,
  type ToolTechnique,
} from "../domain/Techniques.ts"

/**
 * Prompt-writing techniques as text heuristics (an extensible data list). They are approximate:
 * the report shows each with its definition, and they are never used for a score.
 */
export const PROMPT_TECHNIQUE_RULES: ReadonlyArray<{
  readonly technique: PromptTechnique
  readonly pattern: RegExp
}> = [
  {
    technique: "planFirst",
    pattern:
      /\b(?:plan|step[- ]by[- ]step|steps|outline|break (?:it|this|the \w+) (?:down|into))\b|計畫|規劃|拆成|步驟|先(?:不要|別)寫/i,
  },
  {
    technique: "context",
    pattern:
      /\b(?:\w*Error|exception|traceback|stack trace|undefined|null pointer|fail(?:ed|s|ing)?|crash(?:es|ed)?|warning)\b|\[pasted code: \d+ lines\]|報錯|錯誤訊息|錯誤|失敗/i,
  },
  {
    technique: "filePaths",
    pattern:
      /(?:^|[\s(`'"])(?:[\w.-]+\/)+[\w.-]+|\b[\w-]+\.(?:tsx?|jsx?|py|go|rs|rb|java|kt|swift|md|json|ya?ml|toml|css|html|sql|sh)\b/i,
  },
  {
    technique: "constraints",
    pattern:
      /\b(?:don'?t|do not|must not|must|never|without|only (?:change|touch|edit)|keep the)\b|不要|必須|保留|只(?:要|改|動)|別動/i,
  },
  {
    technique: "acceptance",
    pattern:
      /\b(?:should (?:return|show|be|fail|pass)|expected (?:result|output|behaviou?r)?|so that|done when|acceptance)\b|預期|應該要|要能|才算/i,
  },
  {
    technique: "examples",
    pattern: /\b(?:for example|e\.g\.|such as|like this|for instance)\b|例如|比如|像是|類似/i,
  },
  {
    technique: "verification",
    pattern: /\b(?:tests?|verify|assert|make sure|check that|run the)\b|測試|驗證|確認/i,
  },
  { technique: "structured", pattern: /^\s*(?:\d+[.)]|[-*•])\s+\S/m },
  {
    technique: "whyExplain",
    pattern: /\b(?:why|explain|how does|what is the difference)\b|為什麼|為何|解釋|差在哪/i,
  },
  {
    technique: "outputFormat",
    pattern: /\b(?:table|json|markdown|bullet(?: points)?|format(?:ted)?|mermaid|csv)\b|表格|格式/i,
  },
]

export const promptTechniquesOf = (text: string): Array<PromptTechnique> =>
  PROMPT_TECHNIQUE_RULES.filter((r) => r.pattern.test(text)).map((r) => r.technique)

const zeros = <K extends string>(keys: ReadonlyArray<K>) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>

/** Techniques for the stats window: workflow uses, prompt shares, months and overlap. */
export const techniquesOf = (input: {
  readonly filtered: ReadonlyArray<PromptRecord>
  readonly cleanedTexts: ReadonlyArray<{ readonly record: PromptRecord; readonly text: string }>
  readonly events: ReadonlyArray<TechniqueEvent>
  readonly sinceMs: number | null
  readonly untilMs: number
  /** Local YYYY-MM and logical YYYY-MM-DD of an instant. */
  readonly monthOf: (ms: number) => string
  readonly dayOf: (ms: number) => string
}): Techniques => {
  const inWindow = (ms: number) =>
    (input.sinceMs === null || ms >= input.sinceMs) && ms <= input.untilMs
  const key = (source: string, sessionId: string) => `${source}:${sessionId}`
  // Only sessions that still have prompts after filtering (no automated or delegated ones).
  const kept = new Set(input.filtered.map((r) => key(r.source, r.sessionId)))
  const events = input.events.filter(
    (e) => inWindow(e.timestampMs) && kept.has(key(e.source, e.sessionId)),
  )

  const tools = Object.fromEntries(
    TOOL_TECHNIQUES.map((t) => {
      const used = events.filter((e) => e.kind === t)
      return [
        t,
        { count: used.length, sessions: new Set(used.map((e) => key(e.source, e.sessionId))).size },
      ]
    }),
  ) as Techniques["tools"]

  const counts = zeros(PROMPT_TECHNIQUES)
  const months = new Map<
    string,
    {
      sessions: Set<string>
      covered: Set<string>
      prompts: number
      tools: Record<ToolTechnique, Set<string>>
      techniques: Record<PromptTechnique, number>
    }
  >()
  const month = (m: string) => {
    let entry = months.get(m)
    if (!entry) {
      entry = {
        sessions: new Set(),
        covered: new Set(),
        prompts: 0,
        tools: Object.fromEntries(TOOL_TECHNIQUES.map((t) => [t, new Set<string>()])) as Record<
          ToolTechnique,
          Set<string>
        >,
        techniques: zeros(PROMPT_TECHNIQUES),
      }
      months.set(m, entry)
    }
    return entry
  }
  for (const r of input.filtered) {
    const m = month(input.monthOf(DateTime.toEpochMillis(r.timestamp)))
    m.sessions.add(key(r.source, r.sessionId))
  }
  for (const c of input.cleanedTexts) {
    const m = month(input.monthOf(DateTime.toEpochMillis(c.record.timestamp)))
    m.prompts++
    for (const t of promptTechniquesOf(c.text)) {
      counts[t]++
      m.techniques[t]++
    }
  }
  for (const e of events) {
    const m = month(input.monthOf(e.timestampMs))
    if (e.kind === "transcript") m.covered.add(key(e.source, e.sessionId))
    else m.tools[e.kind].add(key(e.source, e.sessionId))
  }
  // Every month from the first to the last, so a quiet month shows as a gap, not a jump.
  const known = [...months.keys()].toSorted()
  if (known.length > 0) {
    let [y, mo] = known[0]!.split("-").map(Number) as [number, number]
    const last = known.at(-1)!
    for (let ym = known[0]!; ym <= last;) {
      month(ym)
      mo++
      if (mo > 12) {
        mo = 1
        y++
      }
      ym = `${y}-${String(mo).padStart(2, "0")}`
    }
  }

  const n = input.cleanedTexts.length
  const prompts = Object.fromEntries(
    PROMPT_TECHNIQUES.map((t) => [t, n === 0 ? 0 : Math.round((counts[t] / n) * 10_000) / 10_000]),
  ) as Techniques["prompts"]

  // Overlap: each session spans its first to last prompt or event.
  const spans = new Map<string, { start: number; end: number }>()
  const extend = (k: string, ms: number) => {
    const s = spans.get(k)
    spans.set(
      k,
      s ? { start: Math.min(s.start, ms), end: Math.max(s.end, ms) } : { start: ms, end: ms },
    )
  }
  for (const r of input.filtered)
    extend(key(r.source, r.sessionId), DateTime.toEpochMillis(r.timestamp))
  for (const e of events)
    if (spans.has(key(e.source, e.sessionId))) extend(key(e.source, e.sessionId), e.timestampMs)
  // starts sort before ends at the same instant, so touching sessions count as overlapping
  const points = [...spans.values()]
    .flatMap((s) => [
      { t: s.start, d: 1 },
      { t: s.end, d: -1 },
    ])
    .toSorted((a, b) => a.t - b.t || b.d - a.d)
  let active = 0
  let maxParallel = 0
  const parallel = new Set<string>()
  for (const p of points) {
    active += p.d
    maxParallel = Math.max(maxParallel, active)
    if (p.d === 1 && active >= 2) parallel.add(input.dayOf(p.t))
  }

  return {
    coveredSessions: new Set(
      events.filter((e) => e.kind === "transcript").map((e) => key(e.source, e.sessionId)),
    ).size,
    tools,
    prompts,
    monthly: [...months.entries()]
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([m, e]) => ({
        month: m,
        sessions: e.sessions.size,
        covered: e.covered.size,
        prompts: e.prompts,
        tools: Object.fromEntries(TOOL_TECHNIQUES.map((t) => [t, e.tools[t].size])) as Record<
          ToolTechnique,
          number
        >,
        techniques: e.techniques,
      })),
    maxParallel,
    parallelDays: parallel.size,
  }
}
