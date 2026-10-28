/** Original collaboration preferences, not a psychological assessment or ability score. */
export const INTERACTION_AXES = [
  { key: "framing", codes: ["F", "E"] },
  { key: "pacing", codes: ["S", "B"] },
  { key: "control", codes: ["D", "L"] },
  { key: "closure", codes: ["C", "R"] },
] as const
export const AXIS_KEYS = ["framing", "pacing", "control", "closure"] as const
export type AxisKey = (typeof AXIS_KEYS)[number]
export type Pole = "first" | "second" | "unclear"

/** No complete role is assigned when even one preference is unobserved or mixed. */
export const roleCode = (
  axes: ReadonlyArray<{ readonly key: AxisKey; readonly pole: Pole }>,
): string | null => {
  let code = ""
  for (const axis of INTERACTION_AXES) {
    const found = axes.find((a) => a.key === axis.key)
    if (!found || found.pole === "unclear") return null
    code += axis.codes[found.pole === "first" ? 0 : 1]
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
