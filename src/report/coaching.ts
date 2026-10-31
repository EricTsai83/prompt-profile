import { nightShare, PROMPT_TECHNIQUES, TOOL_TECHNIQUES, type Profile } from "../domain/index.ts"
import { defined, definition } from "./definition.ts"
import { formatDate, formatMonth } from "./format.ts"
import { html, type Raw } from "./html-template.ts"
import type { Loc } from "./loc.ts"
import { EXPERIMENT_MESSAGES, type Messages } from "./messages.ts"
import { triggeredSignals } from "./signals.ts"
import { makeVerbatim, quotes } from "./traits.ts"
import type { Scrub, Visibility } from "./visibility.ts"

const improvementCard = (p: Profile, i: number, loc: Loc, v: Visibility, scrub: Scrub): Raw => {
  const imp = p.improvements[i]!
  const before =
    v.quotes && imp.rewrite
      ? imp.evidence.find((e) => e.promptId === imp.rewrite!.promptId)
      : undefined
  const others = v.quotes ? imp.evidence.filter((e) => e !== before) : []
  return html`<article class="improve">
    <header><span class="improve-n">${i + 1}</span><h3>${loc.text((_m, c, l) => scrub(c.improvement(i).title, l))}</h3></header>
    <p class="improve-pattern">${loc.text((_m, c, l) => scrub(c.improvement(i).pattern, l))}</p>
    <p class="improve-impact">${loc.text((_m, c, l) => scrub(c.improvement(i).impact, l))}</p>
    ${
      imp.experiment
        ? html`<p class="note">${loc.text((_m, _c, l) => EXPERIMENT_MESSAGES[l].note)}</p>
    <h4>${loc.text((_m, _c, l) => EXPERIMENT_MESSAGES[l].when)}</h4>
    <p>${loc.text((_m, c, l) => scrub((c.improvement(i).experiment ?? imp.experiment)!.when, l))}</p>
    <h4>${loc.text((_m, _c, l) => EXPERIMENT_MESSAGES[l].action)}</h4>`
        : ""
    }
    <p class="improve-tip">${loc.text((_m, c, l) => scrub(c.improvement(i).suggestion, l))}</p>
    ${imp.experiment ? html`<h4>${loc.text((_m, _c, l) => EXPERIMENT_MESSAGES[l].observe)}</h4><p>${loc.text((_m, c, l) => scrub((c.improvement(i).experiment ?? imp.experiment)!.observe, l))}</p>` : ""}
    ${
      before && imp.rewrite
        ? html`<div class="rewrite">
            <div>
              <span class="rw-label">${loc.text((m) => m.before)}</span>
              <blockquote>${makeVerbatim(loc, v, scrub)(before.quote)}</blockquote>
            </div>
            <div>
              <span class="rw-label">${loc.text((m) => m.after)}</span>
              <p class="experiment-print-copy">${makeVerbatim(loc, v, scrub)(imp.rewrite.after)}</p>
              <label class="experiment-copy-help" for="experiment-copy-${i}">${loc.text((_m, _c, l) => EXPERIMENT_MESSAGES[l].copy)}</label>
              <textarea id="experiment-copy-${i}" class="rw-after" title="${loc.attr((m) => m.suggested)}" readonly rows="4" style="width:100%;font:inherit">${loc.attr((_m, _c, l) => scrub(imp.rewrite!.after, l))}</textarea>
            </div>
          </div>`
        : ""
    }
    ${
      others.length > 0
        ? html`<details open>
            <summary>${loc.text((m) => m.showEvidence(others.length))}</summary>
            ${quotes(others, makeVerbatim(loc, v, scrub))}
          </details>`
        : ""
    }
  </article>`
}

const signalRow = (p: Profile, loc: Loc): Raw | null => {
  const list = triggeredSignals(p.stats, p.steering !== null)
  if (list.length === 0) return null
  const r = p.stats.promptHabits.reusedOpenings
  const texts = (m: Messages, id: (typeof list)[number]["id"], amount: number) =>
    id === "reusedOpenings" ? m.signal.reusedOpenings(r.openings, r.sessions) : m.signal[id](amount)
  return html`<ul class="signals">
    ${list.map(
      (x) =>
        html`<li>
          <b>${loc.text((m) => texts(m, x.id, x.amount)[0])}</b>
          <span>${loc.text((m) => texts(m, x.id, x.amount)[1])}</span>
        </li>`,
    )}
  </ul>`
}

/** Observed frequency differences, without judging either direction as improvement. */
const change = (label: Raw, before: number, now: number): Raw => {
  const delta = Math.round(now * 100) - Math.round(before * 100)
  return html`<li class="chg flat"><span>${label}</span><b>${Math.round(before * 100)}% → ${Math.round(now * 100)}%</b><i>${delta === 0 ? "=" : delta > 0 ? `▲ ${delta}` : `▼ ${-delta}`}</i></li>`
}

/** "Since your last report": habits and the techniques that moved most. */
const progressBlock = (p: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw | null => {
  const prev = p.previous
  if (prev === null || !p.historyComparison?.toolComparable) return null
  const s = p.stats
  const t = s.techniques
  const movers =
    t === null
      ? []
      : [
          ...TOOL_TECHNIQUES.map((k) => ({
            label: loc.text((m) => m.toolNames[k][0]),
            before: prev.toolShares[k],
            now: t.coveredSessions === 0 ? 0 : Math.min(1, t.tools[k].sessions / t.coveredSessions),
          })),
          ...PROMPT_TECHNIQUES.map((k) => ({
            label: loc.text((m) => m.promptNames[k][0]),
            before: prev.promptShares[k],
            now: t.prompts[k],
          })),
        ]
          .filter((x) => Math.abs(x.now - x.before) >= 0.03)
          .toSorted((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
          .slice(0, 4)
  return html`<div class="progress">
    <h3 class="sub-h">
      ${loc.text((m) =>
        m.sinceLast((v.dates ? formatDate : formatMonth)(prev.generatedAt, s.timezone, m.locale)),
      )}
    </h3>
    <ul class="changes">
      ${change(
        loc.text((m) => m.correctionsShare),
        prev.correctionRate,
        s.correctionRate,
      )}
      ${change(
        loc.text((m) => m.terseLabel),
        prev.terseShare,
        s.promptHabits.terseShare,
      )}
      ${change(
        loc.text((m) => m.nightLabel),
        prev.nightShare,
        nightShare(s),
      )}
      ${movers.map((x) => change(x.label, x.before, x.now))}
    </ul>
    ${
      prev.improvements.length > 0
        ? html`<p class="last-tips">
            ${loc.text(
              (m, _c, l) =>
                `${m.lastSuggestions}: ${prev.improvements.map((x) => scrub(x, l)).join(" · ")}`,
            )}
          </p>`
        : ""
    }
  </div>`
}

/** Suggestions to try, the signals behind them and what changed since the last report. */
export const coachingSection = (profile: Profile, loc: Loc, v: Visibility, scrub: Scrub): Raw => {
  const signals = signalRow(profile, loc)
  const progress = progressBlock(profile, loc, v, scrub)
  return html`<section class="coaching">
                  <div class="section-head">
                    ${defined(
                      html`<h2>${loc.text((m) => m.coaching)}</h2>`,
                      definition(
                        loc,
                        loc.text((m) => m.coachingNote),
                      ),
                    )}
                  </div>
                  <div class="improves">
                    ${profile.improvements.length ? improvementCard(profile, 0, loc, v, scrub) : html`<p>${loc.text((_m, _c, l) => EXPERIMENT_MESSAGES[l].absent)}</p>`}
                    ${profile.improvements.length > 1 ? html`<details class="experiment-alternatives"><summary>${loc.text((_m, _c, l) => EXPERIMENT_MESSAGES[l].alternatives)}</summary>${profile.improvements.slice(1).map((_x, i) => improvementCard(profile, i + 1, loc, v, scrub))}</details>` : ""}
                  </div>
                  ${
                    signals
                      ? html`<h3 class="sub-h">${loc.text((m) => m.signalsTitle)}</h3>
                          ${signals}`
                      : ""
                  }
                  ${progress ?? ""}
                </section>`
}
