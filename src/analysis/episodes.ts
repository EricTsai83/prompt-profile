import type { ChunkEpisode } from "../domain/ChunkObservations.ts"
import {
  TASK_TYPES,
  type Episode,
  type EpisodeCoverage,
  type EpisodeTurn,
  type Pattern,
} from "../domain/Episode.ts"
import type { Chunk } from "./chunk.ts"
import { matchQuote } from "./verify.ts"

/** Episodes sent to the reduce step and kept in the profile. */
export const MAX_EPISODES = 8

/** Verified, not yet selected: `chunk` is the analysed period it came from. */
export interface CandidateEpisode extends Omit<Episode, "id"> {
  readonly chunk: string
}

export interface SelectedEpisode extends Episode {
  readonly chunk: string
}

type Reason = keyof EpisodeCoverage["rejected"]

export interface EpisodeCounts {
  found: number
  kept: number
  rejected: Record<Reason, number>
  endingsWithdrawn: number
  patternsDropped: number
}

export const emptyEpisodeCounts = (): EpisodeCounts => ({
  found: 0,
  kept: 0,
  rejected: { unknownTurn: 0, quoteMismatch: 0, mixedSessions: 0, reordered: 0 },
  endingsWithdrawn: 0,
  patternsDropped: 0,
})

export const episodeCoverage = (counts: EpisodeCounts, selected: number): EpisodeCoverage => ({
  ...counts,
  rejected: { ...counts.rejected },
  selected,
})

/**
 * Why an episode cannot be kept, or its turns. Every turn must cite a prompt of the chunk with
 * a verbatim quote, belong to the named session and come later in it than the turn before:
 * an invented, reordered or stitched-together conversation is rejected as a whole.
 */
const checkEpisode = (episode: ChunkEpisode, chunk: Chunk): Reason | Array<EpisodeTurn> => {
  if (episode.turns.length === 0) return "unknownTurn"
  const prompts = new Map(chunk.prompts.map((p) => [p.id, p]))
  const turns: Array<EpisodeTurn> = []
  for (const t of episode.turns) {
    const prompt = prompts.get(t.promptId)
    const position = chunk.positions.get(t.promptId)
    if (!prompt || !position) return "unknownTurn"
    if (position.session !== episode.session) return "mixedSessions"
    const quote = matchQuote(t.quote, prompt.text)
    if (quote === null) return "quoteMismatch"
    turns.push({
      promptId: t.promptId,
      quote,
      role: t.role,
      turn: position.turn,
      time: prompt.timestamp,
    })
  }
  return turns.every((t, i) => i === 0 || t.turn > turns[i - 1]!.turn) ? turns : "reordered"
}

/** Keep the episodes that verify against their chunk; count each rejection by reason. */
export const verifyEpisodes = (
  proposed: ReadonlyArray<ChunkEpisode>,
  chunk: Chunk,
  counts: EpisodeCounts,
): ReadonlyArray<CandidateEpisode> =>
  proposed.flatMap((episode) => {
    counts.found++
    const turns = checkEpisode(episode, chunk)
    if (typeof turns === "string") {
      counts.rejected[turns]++
      return []
    }
    counts.kept++
    // A request is not an outcome: an ending must be shown by one of the user's own turns.
    const shown =
      episode.ending.kind !== "unknown" && turns.some((t) => t.promptId === episode.ending.promptId)
    if (episode.ending.kind !== "unknown" && !shown) counts.endingsWithdrawn++
    const position = chunk.positions.get(turns[0]!.promptId)!
    return [
      {
        session: episode.session,
        sessionTurns: position.of,
        split: position.split,
        taskType: episode.taskType,
        task: episode.task,
        turns,
        ending: shown ? episode.ending : { kind: "unknown", promptId: null },
        chunk: chunk.id,
      },
    ]
  })

/** 0, n-1, then midpoints breadth-first: any prefix is spread over the whole range. */
const spreadOrder = (n: number): ReadonlyArray<number> => {
  const out = new Set<number>()
  if (n === 0) return []
  out.add(0)
  out.add(n - 1)
  let ranges: Array<readonly [number, number]> = [[0, n - 1]]
  while (ranges.length > 0) {
    const next: Array<readonly [number, number]> = []
    for (const [a, b] of ranges) {
      if (b - a < 2) continue
      const mid = Math.floor((a + b) / 2)
      out.add(mid)
      next.push([a, mid], [mid, b])
    }
    ranges = next
  }
  return [...out]
}

const interventions = (e: CandidateEpisode) => e.turns.filter((t) => t.role !== "ask").length

/**
 * Deterministic selection of representative episodes. `groups` holds each analysed chunk's
 * episodes, oldest chunk first. Chunks are visited spread over time (first, last, middle…),
 * taking one episode per visit: a session not shown yet, then a task type not shown yet, then
 * the one with more user interventions. A session repeats only when no other is left, so one
 * long conversation cannot fill the selection. The result is chronological, numbered E1…
 */
export const selectEpisodes = (
  groups: ReadonlyArray<ReadonlyArray<CandidateEpisode>>,
  max: number = MAX_EPISODES,
): ReadonlyArray<SelectedEpisode> => {
  const left = groups.map((g) => g.map((episode, index) => ({ episode, index })))
  const order = spreadOrder(groups.length)
  const sessions = new Set<string>()
  const types = new Set<string>()
  const picked: Array<{ episode: CandidateEpisode; group: number; index: number }> = []
  for (const repeatSessions of [false, true]) {
    let progressed = true
    while (progressed && picked.length < max) {
      progressed = false
      for (const g of order) {
        if (picked.length >= max) break
        const eligible = left[g]!.filter((x) => repeatSessions || !sessions.has(x.episode.session))
        const best = eligible.toSorted(
          (a, b) =>
            Number(sessions.has(a.episode.session)) - Number(sessions.has(b.episode.session)) ||
            Number(types.has(a.episode.taskType)) - Number(types.has(b.episode.taskType)) ||
            interventions(b.episode) - interventions(a.episode) ||
            a.index - b.index,
        )[0]
        if (!best) continue
        left[g] = left[g]!.filter((x) => x !== best)
        sessions.add(best.episode.session)
        types.add(best.episode.taskType)
        picked.push({ ...best, group: g })
        progressed = true
      }
    }
  }
  return picked
    .toSorted((a, b) => a.group - b.group || a.index - b.index)
    .map(({ episode }, i) => ({ ...episode, id: `E${i + 1}` }))
}

/** A recurring habit as the reduce step proposed it. */
export interface ProposedPattern {
  readonly claim: string
  readonly episodeIds: ReadonlyArray<string>
  readonly counterEpisodeIds: ReadonlyArray<string>
}

/**
 * Keep patterns that cite only selected episodes and recur in at least two sessions. Spread
 * and task types are computed here, never taken from the model; an episode cited as support
 * is not also a counterexample.
 */
export const verifyPatterns = (
  proposed: ReadonlyArray<ProposedPattern>,
  episodes: ReadonlyArray<SelectedEpisode>,
  counts: EpisodeCounts,
): ReadonlyArray<Pattern> => {
  const byId = new Map(episodes.map((e) => [e.id, e]))
  return proposed.flatMap((p) => {
    const cited = [...p.episodeIds, ...p.counterEpisodeIds]
    const supporting = episodes.filter((e) => p.episodeIds.includes(e.id))
    const sessions = new Set(supporting.map((e) => e.session))
    if (!cited.every((id) => byId.has(id)) || sessions.size < 2) {
      counts.patternsDropped++
      return []
    }
    return [
      {
        claim: p.claim,
        episodeIds: supporting.map((e) => e.id),
        counterEpisodeIds: episodes
          .filter((e) => p.counterEpisodeIds.includes(e.id) && !p.episodeIds.includes(e.id))
          .map((e) => e.id),
        support: { sessions: sessions.size, weeks: new Set(supporting.map((e) => e.chunk)).size },
        taskTypes: TASK_TYPES.filter((t) => supporting.some((e) => e.taskType === t)),
      },
    ]
  })
}

/** As sent to the reduce step: times come from `promptContext`, which already lists them. */
export const episodesForReduce = (episodes: ReadonlyArray<SelectedEpisode>) =>
  episodes.map((e) => ({
    id: e.id,
    session: e.session,
    sessionTurns: e.sessionTurns,
    taskType: e.taskType,
    task: e.task,
    turns: e.turns.map(({ turn, role, promptId, quote }) => ({ turn, role, promptId, quote })),
    ending: e.ending,
  }))

/** The profile's form: the analysis-only chunk reference is dropped. */
export const toProfileEpisode = ({ chunk: _chunk, ...episode }: SelectedEpisode): Episode => episode
