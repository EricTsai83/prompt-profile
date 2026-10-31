import { Schema } from "effect"

/** Original collaboration preferences, not a psychological assessment or ability score. */
export const INTERACTION_AXES = [
  { key: "framing", codes: ["F", "E"] },
  { key: "pacing", codes: ["S", "B"] },
  { key: "control", codes: ["D", "L"] },
  { key: "closure", codes: ["C", "R"] },
] as const
export const AXIS_KEYS = ["framing", "pacing", "control", "closure"] as const
export type AxisKey = (typeof AXIS_KEYS)[number]
export const POLES = ["first", "second"] as const
export type Pole = (typeof POLES)[number]

/**
 * A way of working counts as characteristic once it shows in this many conversations. Both
 * poles of an axis can be characteristic: a person may work differently in different projects
 * or tasks, and neither way is a counterexample of the other.
 */
export const MIN_SIDE_SESSIONS = 2

interface SideLike {
  readonly pole: Pole
  /** Distinct conversations behind the side. */
  readonly sessions: number
}

/** The characteristic ways of working on one axis, in pole order. */
export const establishedPoles = (axis: {
  readonly sides: ReadonlyArray<SideLike>
}): ReadonlyArray<Pole> =>
  (["first", "second"] as const).filter((pole) =>
    axis.sides.some((s) => s.pole === pole && s.sessions >= MIN_SIDE_SESSIONS),
  )

/** `both`: two characteristic ways in different contexts; `none`: not enough evidence yet. */
export type AxisState = Pole | "both" | "none"

export const axisState = (axis: { readonly sides: ReadonlyArray<SideLike> }): AxisState => {
  const poles = establishedPoles(axis)
  return poles.length === 2 ? "both" : (poles[0] ?? "none")
}

/**
 * A complete role only when every axis has exactly one characteristic way of working. A
 * person with both ways on an axis gets no role rather than one chosen arbitrarily.
 */
export const roleCode = (
  axes: ReadonlyArray<{ readonly key: AxisKey; readonly sides: ReadonlyArray<SideLike> }>,
): string | null => {
  let code = ""
  for (const axis of INTERACTION_AXES) {
    const found = axes.find((a) => a.key === axis.key)
    const state = found ? axisState(found) : "none"
    if (state === "both" || state === "none") return null
    code += axis.codes[state === "first" ? 0 : 1]
  }
  return code
}

/** Stable names for every combination; role descriptions remain grounded in personal evidence. */
export const ROLE_NAMES: Readonly<Record<string, string>> = {
  FSDC: "Methodical Director",
  FSDR: "Detail Director",
  FSLC: "Guiding Architect",
  FSLR: "Workshop Mentor",
  FBDC: "Delivery Director",
  FBDR: "Creative Director",
  FBLC: "Delegating Architect",
  FBLR: "Outcome Curator",
  ESDC: "Investigative Navigator",
  ESDR: "Exploration Partner",
  ESLC: "Guided Researcher",
  ESLR: "Discovery Partner",
  EBDC: "Experiment Director",
  EBDR: "Iterative Producer",
  EBLC: "Research Orchestrator",
  EBLR: "Open Explorer",
}

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

/**
 * How often each way of working shows, measured on the analysed chunks: per axis, the distinct
 * conversations with a verified prompt for each pole. A conversation may count for both poles.
 * A share of conversations, not a personality score.
 */
export const AxisBalance = Schema.Struct({
  axes: Schema.Array(
    Schema.Struct({ key: Schema.Literals(AXIS_KEYS), first: Count, second: Count }),
  ),
  /** Conversations with a prompt in the analysed chunks (a sample of the history). */
  conversations: Count,
  /** Labels on an unknown prompt, misquotes and repeated labels of one prompt and axis. */
  rejected: Count,
})
export type AxisBalance = typeof AxisBalance.Type

/** Fewest conversations behind an axis before the report shows its percentages. */
export const MIN_BALANCE_CONVERSATIONS = 3

/** Share of an axis's conversations one pole needs before the axis leans that way. */
export const LEANING_SHARE = 0.6

/**
 * A role code from the measured balance: each axis leans to the pole with at least
 * LEANING_SHARE of its conversations, given MIN_BALANCE_CONVERSATIONS behind it. Null when
 * any axis is even or thin.
 */
export const balanceCode = (balance: AxisBalance | null | undefined): string | null => {
  if (!balance) return null
  let code = ""
  for (const axis of INTERACTION_AXES) {
    const found = balance.axes.find((a) => a.key === axis.key)
    const total = found ? found.first + found.second : 0
    if (!found || total < MIN_BALANCE_CONVERSATIONS) return null
    const share = found.first / total
    if (share >= LEANING_SHARE) code += axis.codes[0]
    else if (share <= 1 - LEANING_SHARE) code += axis.codes[1]
    else return null
  }
  return code
}
