import {
  AXIS_KEYS,
  type AxisBalance,
  type AxisKey,
  type ChunkObservations,
  type Pole,
} from "../domain/index.ts"
import type { Chunk } from "./chunk.ts"
import { matchQuote } from "./verify.ts"

/**
 * How often each way of working shows, from the map step's axis labels on the analysed chunks.
 * A label must cite a prompt of its chunk with a verbatim quote; each prompt counts once per
 * axis, and each pole is counted by distinct conversation.
 */
export const measureAxisBalance = (
  outcomes: ReadonlyArray<{ readonly chunk: Chunk; readonly observations: ChunkObservations }>,
): AxisBalance => {
  const conversations = new Set<string>()
  const labelled = new Set<string>()
  const sessions = new Map<`${AxisKey}:${Pole}`, Set<string>>()
  let rejected = 0
  for (const { chunk, observations } of outcomes) {
    const prompts = new Map(chunk.prompts.map((p) => [p.id, p]))
    for (const p of chunk.prompts) conversations.add(chunk.positions.get(p.id)!.session)
    for (const signal of observations.axisSignals) {
      const prompt = prompts.get(signal.promptId)
      const position = chunk.positions.get(signal.promptId)
      const key = `${signal.promptId}\0${signal.axis}`
      if (
        !prompt ||
        !position ||
        labelled.has(key) ||
        matchQuote(signal.quote, prompt.text) === null
      ) {
        rejected++
        continue
      }
      labelled.add(key)
      const pole = `${signal.axis}:${signal.pole}` as const
      sessions.set(pole, (sessions.get(pole) ?? new Set()).add(position.session))
    }
  }
  return {
    axes: AXIS_KEYS.map((key) => ({
      key,
      first: sessions.get(`${key}:first`)?.size ?? 0,
      second: sessions.get(`${key}:second`)?.size ?? 0,
    })),
    conversations: conversations.size,
    rejected,
  }
}
