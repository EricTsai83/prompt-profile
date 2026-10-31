import { type SafePrompt, truncateQuote } from "../domain/index.ts"

/** Additional source context is bounded independently of the merged observations. */
export const SOURCE_CONTEXT_LIMIT = 20_000

/**
 * A citation may quote ownership but omit exploration in the same prompt. Provide prefixes
 * from the same already-redacted prompts, one per session per round. They are source evidence,
 * not assistant replies. Coverage and truncation remain explicit; absent text is unknown.
 */
export const sourceContext = (
  prompts: ReadonlyArray<SafePrompt>,
  cited: ReadonlySet<string>,
  limit: number = SOURCE_CONTEXT_LIMIT,
) => {
  const groups = new Map<string, Array<SafePrompt>>()
  const seen = new Set<string>()
  for (const p of prompts) {
    if (!cited.has(p.id) || seen.has(p.id)) continue
    seen.add(p.id)
    const key = `${p.source}:${p.sessionId}`
    const group = groups.get(key) ?? []
    group.push(p)
    groups.set(key, group)
  }
  const excerpts: Array<{ promptId: string; text: string; truncated: boolean }> = []
  let size = 2
  for (let round = 0; ; round++) {
    let found = false
    for (const group of groups.values()) {
      const p = group[round]
      if (!p) continue
      found = true
      const text = truncateQuote(p.text)
      const excerpt = { promptId: p.id, text, truncated: text !== p.text.trim() }
      const added = JSON.stringify(excerpt).length + (excerpts.length > 0 ? 1 : 0)
      if (size + added > limit) continue
      excerpts.push(excerpt)
      size += added
    }
    if (!found) break
  }
  return { excerpts, coverage: { eligible: seen.size, included: excerpts.length } }
}
