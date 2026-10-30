import { DateTime } from "effect"
import { expect, it } from "vitest"
import { verifyCollaboration } from "../../src/analysis/collaboration.ts"

const texts = new Map([
  ["a", "Compare the options"],
  ["b", "Check the boundary"],
  ["c", "Explain the trade-offs"],
  ["d", "Check the rollback"],
  ["e", "That check found the missing row"],
])
const origins = new Map(
  [...texts.keys()].map((id, i) => [
    id,
    { session: i < 2 ? "one" : "two", week: i < 2 ? "w1" : "w2" },
  ]),
)
const quote = (promptId: string) => ({ promptId, quote: texts.get(promptId)! })
const episodes = ["one", "two"].map((session, i) => ({
  id: `E${i + 1}`,
  session,
  taskType: "review" as const,
  task: "Review a patch",
  sessionTurns: 2,
  split: false,
  turns: [i === 0 ? "a" : "c", i === 0 ? "b" : "d"].map((id, turn) => ({
    ...quote(id),
    turn: turn + 1,
    role: turn === 0 ? ("ask" as const) : ("verify" as const),
    time: DateTime.makeUnsafe(turn),
  })),
  ending: { kind: "unknown" as const, promptId: null },
}))
const move = {
  name: "Compare, then check",
  description: "Requests options before checks.",
  episodeIds: ["E1", "E2"],
  benefit: null,
  cost: null,
}
const signal = {
  kind: "verification" as const,
  basis: "user_request" as const,
  observation: "Requests boundary checks.",
  context: "patch review",
  evidence: [quote("b"), quote("d")],
}
const counts = () => ({ kept: 0, dropped: 0 })

it("retains ordered recurring moves and separately scoped requested practices", () => {
  const out = verifyCollaboration(
    { moves: [move], signals: [signal] },
    episodes,
    texts,
    origins,
    counts(),
  )!
  expect(out.moves[0]?.support).toEqual({ sessions: 2, weeks: 2 })
  expect(out.signals[0]?.basis).toBe("user_request")
  expect(out.signals[0]?.support.sessions).toBe(2)
})

it("rejects a move repeated within one conversation or citing an unknown episode", () => {
  const out = verifyCollaboration(
    { moves: [move, { ...move, episodeIds: ["E1", "missing"] }], signals: [] },
    episodes.map((e) => ({ ...e, session: "one" })),
    texts,
    origins,
    counts(),
  )!
  expect(out.moves).toEqual([])
  expect(out.rejected.moves).toBe(2)
})

it("does not turn requests into benefits, costs, tool mastery or autonomous agent knowledge", () => {
  const effect = { claim: "The check saved time", evidence: [quote("b")] }
  const out = verifyCollaboration(
    {
      moves: [{ ...move, benefit: effect, cost: effect }],
      signals: [
        { ...signal, basis: "agent_action" },
        { ...signal, basis: "tool_question" },
      ],
    },
    episodes,
    texts,
    origins,
    counts(),
  )!
  expect(out.moves[0]?.benefit).toBeNull()
  expect(out.moves[0]?.cost).toBeNull()
  expect(out.signals).toEqual([])
  expect(out.rejected).toEqual({ moves: 0, signals: 2, effects: 2 })
})

it("keeps attributed effects only with verified user-reported ending evidence", () => {
  const end = { ...quote("e"), turn: 3, role: "close" as const, time: DateTime.makeUnsafe(3) }
  const eps = [
    episodes[0]!,
    {
      ...episodes[1]!,
      turns: [...episodes[1]!.turns, end],
      ending: { kind: "user_reported" as const, promptId: "e" },
    },
  ]
  const out = verifyCollaboration(
    {
      moves: [
        {
          ...move,
          benefit: { claim: "The user reports finding a missing row", evidence: [quote("e")] },
        },
      ],
      signals: [signal],
    },
    eps,
    texts,
    origins,
    counts(),
  )!
  expect(out.moves[0]?.benefit?.evidence).toEqual([quote("e")])
})
