import {
  AXIS_KEYS,
  MAX_AXIS_EXAMPLES,
  MAX_QUOTE_LENGTH,
  type AxisBalance,
  type AxisKey,
  type ChunkObservations,
  type Pole,
} from "../domain/index.ts"
import type { Chunk } from "./chunk.ts"
import { matchQuote } from "./verify.ts"

type Example = { readonly promptId: string; readonly quote: string }

/** A quote within the profile's quote length. */
const clipQuote = (quote: string): string => {
  const chars = Array.from(quote.trim())
  return chars.length <= MAX_QUOTE_LENGTH
    ? chars.join("")
    : `${chars.slice(0, MAX_QUOTE_LENGTH - 1).join("")}…`
}

/**
 * How often each way of working shows, from the map step's axis labels on the analysed chunks.
 * A label must cite a prompt of its chunk with a verbatim quote; each prompt counts once per
 * axis, and each pole is counted by distinct conversation. The first verified quotes of
 * different conversations are kept as examples, at most MAX_AXIS_EXAMPLES per pole.
 */
export const measureAxisBalance = (
  outcomes: ReadonlyArray<{ readonly chunk: Chunk; readonly observations: ChunkObservations }>,
): AxisBalance => {
  const conversations = new Set<string>()
  const labelled = new Set<string>()
  const sessions = new Map<`${AxisKey}:${Pole}`, Set<string>>()
  const examples = new Map<`${AxisKey}:${Pole}`, Array<Example>>()
  let rejected = 0
  for (const { chunk, observations } of outcomes) {
    const prompts = new Map(chunk.prompts.map((p) => [p.id, p]))
    for (const p of chunk.prompts) conversations.add(chunk.positions.get(p.id)!.session)
    for (const signal of observations.axisSignals) {
      const prompt = prompts.get(signal.promptId)
      const position = chunk.positions.get(signal.promptId)
      const key = `${signal.promptId}\0${signal.axis}`
      const quote = prompt ? matchQuote(signal.quote, prompt.text) : null
      if (!prompt || !position || labelled.has(key) || quote === null) {
        rejected++
        continue
      }
      labelled.add(key)
      const pole = `${signal.axis}:${signal.pole}` as const
      const seen = sessions.get(pole) ?? new Set<string>()
      if (!seen.has(position.session)) {
        const list = examples.get(pole) ?? []
        if (list.length < MAX_AXIS_EXAMPLES)
          examples.set(pole, [...list, { promptId: prompt.id, quote: clipQuote(quote) }])
      }
      sessions.set(pole, seen.add(position.session))
    }
  }
  return {
    axes: AXIS_KEYS.map((key) => ({
      key,
      first: sessions.get(`${key}:first`)?.size ?? 0,
      second: sessions.get(`${key}:second`)?.size ?? 0,
      examples: {
        first: examples.get(`${key}:first`) ?? [],
        second: examples.get(`${key}:second`) ?? [],
      },
    })),
    conversations: conversations.size,
    rejected,
  }
}
