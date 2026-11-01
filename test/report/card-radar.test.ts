import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { ABILITY_KEYS, decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { avatarSvg } from "../../src/report/avatar.ts"
import { cardTree, renderCard } from "../../src/report/card.ts"
import { cardPeriod } from "../../src/report/card-summary.ts"
import { embeddedFonts } from "../../src/report/fonts.ts"

const sample = () =>
  Effect.runPromise(
    decodeProfile(
      JSON.parse(readFileSync(new URL("../fixtures/profile.sample.json", import.meta.url), "utf8")),
    ),
  )

const measured = async (shares: ReadonlyArray<number>): Promise<Profile> => {
  const base = await sample()
  return {
    ...base,
    abilities: ABILITY_KEYS.map((key, i) => ({
      key,
      score: shares[i % shares.length]!,
      evidence: [],
      support: { sessions: 3, weeks: 2 },
      byProject: [],
    })),
  }
}

/** Every text node of a card tree, in order. */
const texts = (node: unknown): Array<string> => {
  if (typeof node === "string") return [node]
  if (Array.isArray(node)) return node.flatMap(texts)
  if (!node || typeof node !== "object" || !("props" in node)) return []
  return texts((node as { props: { children?: unknown } }).props.children)
}

/** The decoded SVG of every image of a card tree. */
const images = (node: unknown): Array<string> => {
  if (Array.isArray(node)) return node.flatMap(images)
  if (!node || typeof node !== "object" || !("props" in node)) return []
  const n = node as { type: string; props: { src?: string; children?: unknown } }
  if (n.type !== "img") return images(n.props.children)
  const src = n.props.src ?? ""
  const base64 = "data:image/svg+xml;base64,"
  return [src.startsWith(base64) ? Buffer.from(src.slice(base64.length), "base64").toString() : src]
}

describe("classic card radar", () => {
  it("draws the measured traits on a 0–100% radar with each trait's name and share", async () => {
    const p = await measured([27, 31, 12])
    const tree = cardTree(p)
    const radar = images(tree).find((svg) => svg.includes('data-radar="shape"'))
    expect(radar).toBeDefined()
    const words = texts(tree)
    expect(words).toContain("Providing context")
    for (const share of ["27%", "31%", "12%"]) expect(words).toContain(share)
    // the traits are on the radar now, not repeated as chips
    expect(words.filter((w) => w === "Providing context")).toHaveLength(1)
  })

  it("keeps the role symbol, now as a badge beside the name, with what it means", async () => {
    const p = await measured([27, 31, 12])
    const tree = cardTree(p)
    expect(images(tree)).toContain(avatarSvg("neutral").svg)
    expect(texts(tree)).toContain("Both ways, by context")
    expect(texts(cardTree(p, { look: "classic", cardHide: [] }, "zh-TW"))).toContain(
      "兩種都有 · 依情境切換",
    )
    // --avatar none leaves the badge out, never the radar
    const plain = cardTree(p, { look: "classic", cardHide: [], avatar: "none" })
    expect(images(plain).some((svg) => svg.includes('data-radar="shape"'))).toBe(true)
    expect(images(plain)).not.toContain(avatarSvg("neutral").svg)
  })

  it("always draws the radar: unmeasured traits are marked, and short lists get blank axes", async () => {
    const unmeasured = await sample()
    const tree = cardTree(unmeasured)
    expect(images(tree).some((svg) => svg.includes('data-radar="grid"'))).toBe(true)
    expect(images(tree).some((svg) => svg.includes('data-radar="shape"'))).toBe(false)
    // the card features supported traits only: the low-confidence one stays off
    expect(texts(tree).filter((w) => w === "Not assessed")).toHaveLength(6)
    const two = await measured([40, 20])
    const grid = images(cardTree(two)).find((svg) => svg.includes('data-radar="grid"'))!
    expect(grid.match(/data-radar="spoke"/g)).toHaveLength(6)
  })

  it("leaves the model to the report's engine line and renders a 1200×630 PNG", async () => {
    const p = await measured([27, 31, 12, 17, 14])
    expect(texts(cardTree(p)).join(" ")).not.toContain(p.engine.model!)
    const png = await Effect.runPromise(renderCard(p, embeddedFonts()))
    expect(Array.from(png.slice(1, 4))).toEqual([0x50, 0x4e, 0x47])
  })
})

it("has no decorative dots behind the copy", async () => {
  const p = await measured([27, 31, 12])
  const round = (node: unknown): number => {
    if (Array.isArray(node)) return node.reduce((n: number, c) => n + round(c), 0)
    if (!node || typeof node !== "object" || !("props" in node)) return 0
    const n = node as {
      type: string
      props: { style?: Record<string, unknown>; children?: unknown }
    }
    const self =
      n.type === "div" &&
      n.props.style?.position === "absolute" &&
      n.props.style?.borderRadius === 999 &&
      n.props.children === undefined
        ? 1
        : 0
    return self + round(n.props.children)
  }
  expect(round(cardTree(p))).toBe(0)
})

it("omits the standalone product name from card headers while retaining footer credit", async () => {
  const p = await sample()
  for (const look of [
    "classic",
    "signal",
    "afterhours",
    "studio",
    "prism",
    "slate",
    "folio",
  ] as const) {
    const words = texts(cardTree(p, { look, cardHide: [] }))
    expect(words).not.toContain("prompt-profile")
    expect(words).toContain("Made with prompt-profile")
  }
})

it.each(["en", "zh-TW"] as const)(
  "places prompt activity below the headline in %s",
  async (lang) => {
    const p = await sample()
    const words = texts(cardTree(p, { look: "classic", cardHide: [] }, lang))
    const headline = lang === "en" ? p.headline : p.translations[lang]!.headline
    const period = cardPeriod(p, lang, true)
    expect(words.indexOf(period)).toBeGreaterThan(words.indexOf(headline))
    expect(words.filter((word) => word === period)).toHaveLength(1)
    const hidden = texts(cardTree(p, { look: "classic", cardHide: ["stats"] }, lang))
    expect(hidden).not.toContain(period)
    const privateDates = texts(
      cardTree(p, { look: "classic", cardHide: [], exclude: ["dates"] }, lang),
    )
    expect(privateDates).toContain(cardPeriod(p, lang, false))
    expect(privateDates).not.toContain(period)
  },
)
