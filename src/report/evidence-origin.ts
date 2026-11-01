import { DateTime } from "effect"
import type { Profile, EvidenceOrigin } from "../domain/index.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { HISTORY_MESSAGES } from "./messages.ts"
import type { Visibility } from "./visibility.ts"

/** Prefer recorded origins; episode turns supply real dates and positions in older profiles. */
export const evidenceSources = (p: Profile): ReadonlyArray<EvidenceOrigin> => [
  ...new Map(
    [
      ...p.episodes.flatMap((e) =>
        e.turns.map((t) => ({
          promptId: t.promptId,
          session: e.session,
          time: t.time,
          turn: t.turn,
          of: e.sessionTurns,
        })),
      ),
      ...(p.evidenceOrigins ?? []),
    ].map((origin) => [origin.promptId, origin]),
  ).values(),
]

export const sourceLabel = (
  p: Profile,
  promptId: string,
  loc: Loc,
  v: Visibility,
  sources: ReadonlyArray<EvidenceOrigin> = evidenceSources(p),
): Raw | null => {
  const origin = sources.find((s) => s.promptId === promptId)
  if (!origin || !v.quotes) return null
  const sessions = [...new Set(sources.map((s) => s.session))]
  return html`<small class="quote-source">${loc.text((m, _c, l) => HISTORY_MESSAGES[l].source(sessions.indexOf(origin.session) + 1, origin.turn, origin.of, new Intl.DateTimeFormat(m.locale, { timeZone: p.stats.timezone, year: "numeric", month: "short", ...(v.dates ? { day: "numeric" as const } : {}) }).format(DateTime.toEpochMillis(origin.time))))}</small>`
}
