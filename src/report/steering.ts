import type { Language, Profile } from "../domain/Profile.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { STEERING_MESSAGES } from "./messages.ts"
import type { Scrub, Visibility } from "./visibility.ts"
import { defined, definition } from "./definition.ts"

type SteeringMessages = (typeof STEERING_MESSAGES)[Language]

/**
 * The facts page's account of how the person steers the AI: per conversation, with the
 * conversations that have follow-ups as the denominator, redirections and repairs apart.
 * Null for profiles from before steering was measured.
 */
export const steeringSection = (p: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw | null => {
  const s = p.steering
  if (!s) return null
  const text = (pick: (m: SteeringMessages) => string) =>
    loc.text((_m, _c, l) => pick(STEERING_MESSAGES[l]))
  const kind = (key: "steer" | "repair", note: "steerNote" | "repairNote") => {
    const k = s[key]
    return html`<div class="steering-kind">
      ${defined(
        html`<h3>${text((m) => m[key])} <small>${text((m) => m.counts(k.conversations, k.prompts))}</small></h3>`,
        definition(
          loc,
          text((m) => m[note]),
        ),
      )}
      ${v.quotes ? k.examples.map((e) => html`<blockquote>${loc.text((_m, _c, l) => scrub(e.quote, l))}</blockquote>`) : ""}
    </div>`
  }
  return html`<section class="steering">
    ${defined(
      html`<h2>${text((m) => m.title)}</h2>`,
      definition(
        loc,
        text((m) => m.denominator(s.withFollowUps, s.conversations)),
        text((m) =>
          [m.method, ...(s.rejected > 0 ? [m.rejected(s.rejected)] : [])].join(m.sentenceGap),
        ),
      ),
    )}
    ${kind("steer", "steerNote")}
    ${kind("repair", "repairNote")}
  </section>`
}

export const steeringStyle = `
.steering>h2{font-size:var(--text-xl);margin:36px 0 0}
.steering .note{margin:8px 0 0;max-width:var(--reading);color:var(--muted);font-size:var(--text-sm)}
.steering-kind{padding:14px 0;border-top:1px solid var(--border);margin-top:14px;break-inside:avoid}
.steering-kind h3{font-size:var(--text-base)}
.steering-kind h3 small{font-size:var(--text-sm);color:var(--muted);font-weight:600;margin-left:8px}
.steering-kind blockquote{margin:10px 0 0;padding:2px 16px;border-left:2px solid var(--accent);line-height:1.7;overflow-wrap:anywhere}
`
