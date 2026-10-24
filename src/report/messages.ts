import type { Confidence, DimensionKey } from "../domain/Profile.ts"

export interface Messages {
  readonly title: string
  readonly period: (from: string, to: string) => string
  readonly coverage: (prompts: number, sessions: number) => string
  readonly sampled: (analyzed: number, total: number) => string
  readonly numbers: string
  readonly totalPrompts: string
  readonly peakHour: string
  readonly languageMix: string
  readonly longestStreak: string
  readonly latestTime: string
  readonly activeDays: string
  readonly days: (n: number) => string
  readonly correctionRate: string
  readonly heatmap: string
  readonly weekdays: ReadonlyArray<string>
  readonly traits: string
  readonly confidence: Record<Confidence, string>
  readonly showEvidence: (n: number) => string
  readonly dimensions: string
  readonly dimensionNames: Record<DimensionKey, string>
  readonly insufficientEvidence: string
  readonly funFacts: string
  readonly engine: (runner: string, model: string | null) => string
  readonly generatedAt: (at: string) => string
  readonly evidenceVerified: (kept: number, dropped: number) => string
  readonly chunksSkipped: (n: number) => string
  readonly privacy: string
  readonly project: string
  readonly none: string
  readonly madeFrom: string
  readonly cardPrompts: string
  readonly cardStreak: string
  readonly graphicAlt: string
}

/** Every text of the report and the card. */
export const messages: Messages = {
  title: "My AI collaboration profile",
  period: (from, to) => `Period: ${from} – ${to}`,
  coverage: (p, s) => `${p.toLocaleString("en")} prompts · ${s.toLocaleString("en")} sessions`,
  sampled: (a, t) => `Large history: ${a} of ${t} chunks were sampled`,
  numbers: "Numbers",
  totalPrompts: "Prompts",
  peakHour: "Peak hour",
  languageMix: "Chinese / English / mixed",
  longestStreak: "Longest streak",
  latestTime: "Latest session",
  activeDays: "Active days",
  days: (n) => `${n} day${n === 1 ? "" : "s"}`,
  correctionRate: "Corrections",
  heatmap: "When you prompt",
  weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  traits: "Traits",
  confidence: { high: "High confidence", medium: "Medium confidence", low: "Low confidence" },
  showEvidence: (n) => `Show ${n} piece${n === 1 ? "" : "s"} of evidence`,
  dimensions: "Five dimensions",
  dimensionNames: {
    work_style: "Work style",
    communication: "Communication",
    tech_profile: "Tech profile",
    interests: "Interests",
    growth: "Growth",
  },
  insufficientEvidence: "Insufficient evidence: no quote in this summary passed verification.",
  funFacts: "Fun facts",
  engine: (r, m) => `Engine: ${r}${m ? ` (${m})` : ""}`,
  generatedAt: (at) => `Generated: ${at}`,
  evidenceVerified: (k, d) =>
    `${k} pieces of evidence verified${d > 0 ? ` (${d} invalid or duplicate quotes removed)` : ""}`,
  chunksSkipped: (n) =>
    `${n} chunk${n === 1 ? "" : "s"} failed and ${n === 1 ? "was" : "were"} skipped`,
  privacy:
    "Privacy: prompts are read only on your machine; after redaction they are analysed with your own Claude Code / Codex account. This report is never uploaded.",
  project: "prompt-profile",
  none: "—",
  madeFrom: "Made from my prompts.",
  cardPrompts: "prompts",
  cardStreak: "longest streak",
  graphicAlt: "Prompts by hour of day",
}
