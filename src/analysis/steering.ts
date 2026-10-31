import type { ChunkObservations, InterventionKind, Steering } from "../domain/index.ts"
import type { Chunk } from "./chunk.ts"
import { matchQuote } from "./verify.ts"

/** Example quotes kept per kind. */
export const MAX_STEERING_EXAMPLES = 2

/**
 * Steering and repairs per conversation, from the map step's labels on the analysed chunks.
 * A label must cite a follow-up prompt (not a conversation's first turn) of its chunk with a
 * verbatim quote; each prompt counts once. Conversations without follow-ups are left out of
 * the denominator: a one-shot request has nothing to steer.
 */
export const measureSteering = (
  outcomes: ReadonlyArray<{ readonly chunk: Chunk; readonly observations: ChunkObservations }>,
): Steering => {
  const conversations = new Set<string>()
  const withFollowUps = new Set<string>()
  let followUpPrompts = 0
  let rejected = 0
  const labelled = new Set<string>()
  const found: Record<
    InterventionKind,
    Array<{ readonly promptId: string; readonly quote: string; readonly session: string }>
  > = { steer: [], repair: [] }
  for (const { chunk, observations } of outcomes) {
    const prompts = new Map(chunk.prompts.map((p) => [p.id, p]))
    for (const p of chunk.prompts) {
      const position = chunk.positions.get(p.id)!
      conversations.add(position.session)
      if (position.turn > 1) {
        followUpPrompts++
        withFollowUps.add(position.session)
      }
    }
    for (const label of observations.interventions) {
      const prompt = prompts.get(label.promptId)
      const position = chunk.positions.get(label.promptId)
      const quote = prompt ? matchQuote(label.quote, prompt.text) : null
      if (!position || position.turn < 2 || quote === null || labelled.has(label.promptId)) {
        rejected++
        continue
      }
      labelled.add(label.promptId)
      found[label.kind].push({ promptId: label.promptId, quote, session: position.session })
    }
  }
  const kind = (items: (typeof found)[InterventionKind]) => {
    const firstPerSession = items.filter(
      (x, i) => items.findIndex((y) => y.session === x.session) === i,
    )
    const examples = [...firstPerSession, ...items.filter((x) => !firstPerSession.includes(x))]
    return {
      conversations: new Set(items.map((x) => x.session)).size,
      prompts: items.length,
      examples: examples
        .slice(0, MAX_STEERING_EXAMPLES)
        .map(({ promptId, quote }) => ({ promptId, quote })),
    }
  }
  return {
    conversations: conversations.size,
    withFollowUps: withFollowUps.size,
    followUpPrompts,
    steer: kind(found.steer),
    repair: kind(found.repair),
    rejected,
  }
}
