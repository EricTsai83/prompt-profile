import { DateTime } from "effect"
import type { SafePrompt } from "../domain/SafePrompt.ts"
import { sha256 } from "./hash.ts"

export const MAX_CHUNK_CHARS = 40_000
export const MIN_CHUNK_CHARS = 8_000
export const DEFAULT_MAX_CHUNKS = 30

/** Where a prompt sits in its session; turns count every prompt of the session. */
export interface TurnPosition {
  /** `${source}:${sessionId}` */
  readonly session: string
  /** 1-based */
  readonly turn: number
  /** Prompts in the session. */
  readonly of: number
  /** The session's prompts are spread over more than one chunk. */
  readonly split: boolean
}

export interface Chunk {
  /** sha256 of the ids and texts of its prompts (stable across runs). */
  readonly id: string
  /** e.g. "2026-W36" or "2026-W36+W37" — informational only. */
  readonly label: string
  readonly prompts: ReadonlyArray<SafePrompt>
  readonly sessions: number
  readonly start: DateTime.Utc
  readonly end: DateTime.Utc
  /** Position of each of `prompts` in its session (plan 20 B). */
  readonly positions: ReadonlyMap<string, TurnPosition>
  /** Formatted text sent to the LLM. */
  readonly text: string
}

// ---------------------------------------------------------------------------------------
// Formatting

/** `<` / `>` in prompt text are escaped in the chunk sent to the LLM (see `formatPrompt`). */
export const escapeText = (s: string): string => s.replace(/</g, "&lt;").replace(/>/g, "&gt;")
/** Inverse of `escapeText`, for quotes the LLM copied from a chunk. */
export const unescapeText = (s: string): string => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
const escapeAttr = (s: string): string => escapeText(s).replace(/"/g, "&quot;")

const localFormatter = (timeZone: string) => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  })
  return (t: DateTime.Utc) => {
    const p: Record<string, string> = {}
    for (const part of fmt.formatToParts(DateTime.toEpochMillis(t))) p[part.type] = part.value
    return {
      date: `${p["year"]}-${p["month"]}-${p["day"]}`,
      time: `${p["hour"]}:${p["minute"]}`,
      weekday: p["weekday"] ?? "",
      year: Number(p["year"]),
      month: Number(p["month"]),
      day: Number(p["day"]),
    }
  }
}

/**
 * `<prompt id=… session=… turn=… time=… project=…>` block. `<` and `>` in the text are escaped
 * so the user's text can never close the tag (prompt-injection guard). `turn="3/12"` is the
 * prompt's place in its session, so prompts outside the chunk are apparent.
 */
const formatPrompt = (
  p: SafePrompt,
  position: TurnPosition,
  local: ReturnType<typeof localFormatter>,
): string => {
  const t = local(p.timestamp)
  const project = p.project === null ? "" : ` project="${escapeAttr(p.project)}"`
  return `<prompt id="${escapeAttr(p.id)}" session="${escapeAttr(position.session)}" turn="${position.turn}/${position.of}" time="${t.date} ${t.time}"${project}>\n${escapeText(p.text)}\n</prompt>`
}

// ---------------------------------------------------------------------------------------
// ISO weeks in the user's time zone

interface WeekKey {
  readonly key: string
  /** Month of the week's Thursday (ISO convention), e.g. "2026-09" — weeks only merge within a month. */
  readonly month: string
}

const isoWeek = (year: number, month: number, day: number): WeekKey => {
  const date = new Date(Date.UTC(year, month - 1, day))
  const dow = (date.getUTCDay() + 6) % 7 // 0 = Monday
  const monday = new Date(date.getTime() - dow * 86_400_000)
  const thursday = new Date(monday.getTime() + 3 * 86_400_000)
  const weekYear = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(weekYear, 0, 4))
  const week1Monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000)
  const week = Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1
  return {
    key: `${weekYear}-W${String(week).padStart(2, "0")}`,
    month: `${thursday.getUTCFullYear()}-${String(thursday.getUTCMonth() + 1).padStart(2, "0")}`,
  }
}

// ---------------------------------------------------------------------------------------
// Chunking

interface Piece {
  readonly label: string
  readonly month: string
  readonly blocks: ReadonlyArray<{ readonly prompt: SafePrompt; readonly text: string }>
  readonly size: number
}

const makeChunk = (piece: Piece, positions: ReadonlyMap<string, TurnPosition>): Chunk => {
  const prompts = piece.blocks.map((b) => b.prompt)
  return {
    id: sha256(...piece.blocks.flatMap((b) => [b.prompt.id, b.prompt.text])),
    label: piece.label,
    prompts,
    sessions: new Set(prompts.map((p) => `${p.source}:${p.sessionId}`)).size,
    start: prompts[0]!.timestamp,
    end: prompts.at(-1)!.timestamp,
    positions: new Map(prompts.map((p) => [p.id, positions.get(p.id)!])),
    text: piece.blocks.map((b) => b.text).join("\n\n"),
  }
}

/**
 * Split prompts into chunks with stable boundaries:
 *  1. sessions are assigned to the ISO week (user time zone) of their first prompt;
 *  2. a week over MAX_CHUNK_CHARS is split by session (a single huge session is split by prompt);
 *  3. weeks under MIN_CHUNK_CHARS merge with the following week(s) of the same month,
 *     oldest first, without exceeding MAX_CHUNK_CHARS.
 * Adding prompts only changes the latest chunks; moving the window only changes the oldest month.
 */
export const buildChunks = (
  prompts: ReadonlyArray<SafePrompt>,
  timeZone: string,
  limits: { readonly max?: number; readonly min?: number } = {},
): ReadonlyArray<Chunk> => {
  const max = limits.max ?? MAX_CHUNK_CHARS
  const min = limits.min ?? MIN_CHUNK_CHARS
  const local = localFormatter(timeZone)
  const sorted = prompts.toSorted(
    (a, b) =>
      DateTime.toEpochMillis(a.timestamp) - DateTime.toEpochMillis(b.timestamp) ||
      a.id.localeCompare(b.id),
  )

  // sessions in order of their first prompt
  const sessions = new Map<string, Array<SafePrompt>>()
  for (const p of sorted) {
    const key = `${p.source}:${p.sessionId}`
    const list = sessions.get(key) ?? []
    list.push(p)
    sessions.set(key, list)
  }

  // turn numbers; `split` is filled in once the chunks are known
  const turns = new Map<string, { session: string; turn: number; of: number }>()
  for (const [session, list] of sessions)
    for (const [i, p] of list.entries()) turns.set(p.id, { session, turn: i + 1, of: list.length })

  // week → sessions
  const weeks = new Map<string, { week: WeekKey; sessions: Array<Array<SafePrompt>> }>()
  for (const list of sessions.values()) {
    const t = local(list[0]!.timestamp)
    const week = isoWeek(t.year, t.month, t.day)
    const entry = weeks.get(week.key) ?? { week, sessions: [] }
    entry.sessions.push(list)
    weeks.set(week.key, entry)
  }

  // each week → one or more pieces
  const weekPieces: Array<Array<Piece>> = []
  for (const { week, sessions: list } of [...weeks.values()].toSorted((a, b) =>
    a.week.key.localeCompare(b.week.key),
  )) {
    const pieces: Array<Piece> = []
    let blocks: Array<{ prompt: SafePrompt; text: string }> = []
    let size = 0
    const flush = () => {
      if (blocks.length > 0) pieces.push({ label: week.key, month: week.month, blocks, size })
      blocks = []
      size = 0
    }
    for (const session of list) {
      const sessionBlocks = session.map((prompt) => ({
        prompt,
        text: formatPrompt(prompt, { ...turns.get(prompt.id)!, split: false }, local),
      }))
      const sessionSize = sessionBlocks.reduce((s, b) => s + b.text.length + 2, 0)
      if (size + sessionSize > max) flush()
      if (sessionSize <= max) {
        blocks.push(...sessionBlocks)
        size += sessionSize
        continue
      }
      // a single session larger than a chunk: split by prompt
      for (const b of sessionBlocks) {
        if (size + b.text.length + 2 > max) flush()
        blocks.push(b)
        size += b.text.length + 2
      }
    }
    flush()
    weekPieces.push(pieces)
  }

  // merge small single-piece weeks forward within the same month
  const merged: Array<Piece> = []
  let acc: Piece | null = null
  for (const pieces of weekPieces) {
    if (pieces.length !== 1) {
      if (acc) merged.push(acc)
      acc = null
      merged.push(...pieces)
      continue
    }
    const piece = pieces[0]!
    if (acc && acc.size < min && acc.month === piece.month && acc.size + piece.size <= max) {
      acc = {
        label: `${acc.label}+${piece.label.slice(5)}`,
        month: acc.month,
        blocks: [...acc.blocks, ...piece.blocks],
        size: acc.size + piece.size,
      }
    } else {
      if (acc) merged.push(acc)
      acc = piece
    }
  }
  if (acc) merged.push(acc)

  const pieces = new Map<string, number>()
  for (const piece of merged)
    for (const session of new Set(piece.blocks.map((b) => turns.get(b.prompt.id)!.session)))
      pieces.set(session, (pieces.get(session) ?? 0) + 1)
  const positions = new Map(
    [...turns].map(([id, t]) => [id, { ...t, split: (pieces.get(t.session) ?? 0) > 1 }] as const),
  )
  return merged.map((piece) => makeChunk(piece, positions))
}

/**
 * Deterministic sampling down to `maxChunks`: split the time range into `maxChunks`
 * equal-width bins and keep, per bin, the chunk with the smallest hash(chunkId). The first
 * and last chunks are always kept (so "growth" has both ends). No randomness → cache hits.
 */
export const sampleChunks = (
  chunks: ReadonlyArray<Chunk>,
  maxChunks: number,
): { readonly chunks: ReadonlyArray<Chunk>; readonly sampled: boolean } => {
  if (chunks.length <= maxChunks) return { chunks, sampled: false }
  const first = chunks[0]!
  const last = chunks.at(-1)!
  const t0 = DateTime.toEpochMillis(first.start)
  const t1 = DateTime.toEpochMillis(last.start)
  const width = Math.max(1, (t1 - t0) / maxChunks)
  const bins = new Map<number, Chunk>()
  for (const c of chunks) {
    const bin = Math.min(maxChunks - 1, Math.floor((DateTime.toEpochMillis(c.start) - t0) / width))
    const current = bins.get(bin)
    if (!current || sha256(c.id) < sha256(current.id)) bins.set(bin, c)
  }
  bins.set(0, first)
  bins.set(Math.min(maxChunks - 1, Math.floor((t1 - t0) / width)), last)
  const selected = new Set(bins.values())
  return { chunks: chunks.filter((c) => selected.has(c)), sampled: true }
}
