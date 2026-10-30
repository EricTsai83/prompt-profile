import { expect, it } from "vitest"
import { avatarSvg, AVATAR_ART_VERSION, ROLE_ART } from "../../src/report/avatar.ts"

it("produces deterministic original vector compositions and a complete neutral fallback", () => {
  const studies = ["planner", "explorer", "coordinator", "verifier", "neutral"] as const
  const assets = studies.map((study) => avatarSvg(study))
  expect(new Set(assets.map((a) => a.svg)).size).toBe(5)
  expect(avatarSvg("planner")).toEqual(avatarSvg("planner"))
  expect(avatarSvg("missing")).toEqual(avatarSvg("neutral"))
  for (const a of assets) {
    expect(a.svg).toContain('viewBox="0 0 320 320"')
    expect(a.svg).not.toMatch(/(?:href="https?:|<script|<image|<foreignObject)/u)
    expect(a.id).toContain(`v${AVATAR_ART_VERSION}`)
  }
})

it("covers the original catalog with sixteen distinct arrangements beyond color changes", async () => {
  const { ROLE_NAMES } = await import("../../src/domain/Interaction.ts")
  expect(ROLE_ART.map(([code]) => code).toSorted()).toEqual(Object.keys(ROLE_NAMES).toSorted())
  expect(new Set(ROLE_ART.map(([, study, pose]) => avatarSvg(study, pose).svg)).size).toBe(16)
  expect(avatarSvg("planner", Number.NaN)).toEqual(avatarSvg("planner"))
})

it("preserves the square symbol proportions on every PNG layout", async () => {
  const { readFileSync } = await import("node:fs")
  const { Effect } = await import("effect")
  const { decodeProfile } = await import("../../src/domain/Profile.ts")
  const { cardTree } = await import("../../src/report/card.ts")
  const { LOOK_IDS } = await import("../../src/report/looks.ts")
  const profile = await Effect.runPromise(
    decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
  )
  const images = (node: unknown): Array<{ width: number; height: number }> => {
    if (Array.isArray(node)) return node.flatMap(images)
    if (!node || typeof node !== "object" || !("props" in node)) return []
    const n = node as { type: string; props: { width: number; height: number; children?: unknown } }
    return n.type === "img" ? [n.props] : images(n.props.children)
  }
  for (const look of LOOK_IDS) {
    const art = images(cardTree(profile, { look, cardHide: [] }))
    expect(art.length).toBe(1)
    expect({ look, width: art[0]!.width }).toEqual({ look, width: art[0]!.height })
    expect(images(cardTree(profile, { look, cardHide: ["graphic"] }))).toEqual([])
  }
})

it("recomposes the same symbol as a taller illustration without stretching its shapes", async () => {
  const { avatarPortrait } = await import("../../src/report/avatar.ts")
  for (const kind of ["planner", "explorer", "coordinator", "verifier", "neutral"]) {
    const square = avatarSvg(kind)
    const tall = avatarPortrait(square)
    expect(tall.width / tall.height).toBeCloseTo(2 / 3)
    expect(tall.svg).toContain('viewBox="0 0 320 480"')
    expect(tall.svg).not.toContain("scale(")
    expect(tall.svg).not.toBe(square.svg)
    expect(avatarPortrait(square)).toEqual(tall)
    expect(avatarSvg(kind)).toEqual(square)
  }
})
