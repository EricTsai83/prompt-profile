import { Schema } from "effect"
import { MAX_QUOTE_LENGTH } from "./quote.ts"

/**
 * Interaction episodes (plan 20 B): how one conversation unfolded, from the user's side only.
 * Records hold the user's prompts, so an episode never contains assistant replies, and its
 * ending is unknown unless a later prompt by the user states it.
 */

/** What a user turn does in its episode. */
export const TURN_ROLES = ["ask", "context", "correct", "redirect", "verify", "close"] as const
export const TurnRole = Schema.Literals(TURN_ROLES)
export type TurnRole = typeof TurnRole.Type

/** Kinds of task, used to spread the selected episodes; a label, not a skill grade. */
export const TASK_TYPES = [
  "build",
  "fix",
  "change",
  "explore",
  "review",
  "write",
  "operate",
  "other",
] as const
export const TaskType = Schema.Literals(TASK_TYPES)
export type TaskType = typeof TaskType.Type

/**
 * What the record shows at the end: nothing (`unknown`), the user stating a result in a later
 * prompt (`user_reported`), or the user dropping the direction (`abandoned`).
 */
export const ENDINGS = ["unknown", "user_reported", "abandoned"] as const
export const EndingKind = Schema.Literals(ENDINGS)
export type EndingKind = typeof EndingKind.Type

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

export const EpisodeTurn = Schema.Struct({
  promptId: Schema.String,
  /** Redacted excerpt of the prompt, verified against it. */
  quote: Schema.String.check(Schema.isMaxLength(MAX_QUOTE_LENGTH)),
  role: TurnRole,
  /** 1-based position among the session's prompts; a gap between turns is prompts not shown. */
  turn: Count,
  time: Schema.DateTimeUtcFromString,
})
export type EpisodeTurn = typeof EpisodeTurn.Type

export const Episode = Schema.Struct({
  /** "E1", "E2"… in chronological order; patterns refer to these. */
  id: Schema.String,
  /** `${source}:${sessionId}` of the conversation. */
  session: Schema.String,
  /** Prompts in the session, so turns not shown are apparent. */
  sessionTurns: Count,
  /** The session was split across analysis chunks: other parts may hold further episodes. */
  split: Schema.Boolean,
  taskType: TaskType,
  /** Short description of the task context (generated, translated). */
  task: Schema.String,
  /** In chronological order, all from `session`. */
  turns: Schema.Array(EpisodeTurn),
  /** `promptId` is the turn that shows the ending; null when unknown. */
  ending: Schema.Struct({ kind: EndingKind, promptId: Schema.NullOr(Schema.String) }),
})
export type Episode = typeof Episode.Type

/** A habit recurring across episodes, with the episodes that go the other way. */
export const Pattern = Schema.Struct({
  claim: Schema.String,
  episodeIds: Schema.Array(Schema.String),
  counterEpisodeIds: Schema.Array(Schema.String),
  /** Distinct sessions and analysed periods of the supporting episodes. */
  support: Schema.Struct({ sessions: Count, weeks: Count }),
  /** Task types of the supporting episodes, in `TASK_TYPES` order. */
  taskTypes: Schema.Array(TaskType),
})
export type Pattern = typeof Pattern.Type

/** Filled by the program: what was found, rejected and selected. */
export const EpisodeCoverage = Schema.Struct({
  /** Proposed by the map step. */
  found: Count,
  /** Passed verification. */
  kept: Count,
  /** Shown in the profile (a deterministic sample of `kept`). */
  selected: Count,
  rejected: Schema.Struct({
    /** A turn cites no prompt of its chunk, or the episode has no turns. */
    unknownTurn: Count,
    quoteMismatch: Count,
    /** Turns from several sessions presented as one conversation. */
    mixedSessions: Count,
    /** Turns out of chronological order, or one prompt used twice. */
    reordered: Count,
  }),
  /** Endings that cited no turn of their episode, reset to unknown. */
  endingsWithdrawn: Count,
  /** Patterns with unknown episodes or support from fewer than two sessions. */
  patternsDropped: Count,
})
export type EpisodeCoverage = typeof EpisodeCoverage.Type
