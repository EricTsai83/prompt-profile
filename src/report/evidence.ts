import type { Language, Profile } from "../domain/Profile.ts"
import { LIMITED_MESSAGES } from "./messages.ts"

/**
 * Limited evidence (plan 24): nothing in the profile has verified support from two or more
 * sessions. This reuses what the analysis verified instead of a prompt or session count: a
 * trait's verified quotes spread over 2+ sessions (`verifyTraits` records `support`), or a
 * resolved preference axis (2+ sessions without counter-evidence, `verifyPortrait`).
 */
export const isLimitedEvidence = (p: Profile): boolean =>
  !p.traits.some(
    (t) =>
      t.evidence.length > 0 &&
      // The verified spread when recorded: the model may state "low" despite it. Profiles
      // before `support` was stored only have the capped confidence.
      (t.support ? t.support.sessions >= 2 : t.confidence !== "low"),
  ) && !(p.portrait?.axes.some((a) => a.pole !== "unclear") ?? false)

/**
 * What the report and card show for a limited profile: fixed text in place of the generated
 * role (archetype and headline) and no coaching suggestions. Observations, dimensions, fun facts
 * and measurements stay. Render-only: `profile.json` keeps everything.
 */
export const limitedView = (p: Profile): Profile => {
  if (!isLimitedEvidence(p)) return p
  const identity = (lang: Language) => {
    const m = LIMITED_MESSAGES[lang]
    return {
      headline: m.headline,
      archetype: {
        name: m.title,
        description: m.body(p.coverage.promptsAnalyzed, p.coverage.sessionsAnalyzed),
      },
    }
  }
  const translations = Object.fromEntries(
    Object.entries(p.translations).map(([lang, t]) => [
      lang,
      { ...t, ...identity(lang as Language), improvements: [] },
    ]),
  )
  return { ...p, ...identity("en"), improvements: [], translations }
}
