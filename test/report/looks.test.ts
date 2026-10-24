import { NodeServices } from "@effect/platform-node"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { decodeProfile, type Profile } from "../../src/domain/Profile.ts"
import { cardTree, renderCard } from "../../src/report/card.ts"
import { embeddedFonts } from "../../src/report/fonts.ts"
import { renderHtml, writeReport } from "../../src/report/index.ts"
import {
  CARD_PARTS,
  DEFAULT_RENDER_OPTIONS,
  LOOK_IDS,
  variantName,
  type CardPart,
  type RenderOptions,
} from "../../src/report/looks.ts"

const SAMPLE = new URL("../fixtures/profile.sample.json", import.meta.url)
const sample = () => decodeProfile(JSON.parse(readFileSync(SAMPLE, "utf8")))

const pngSize = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

/** Every text node of a satori tree. */
const texts = (node: unknown): Array<string> => {
  if (typeof node === "string") return [node]
  if (Array.isArray(node)) return node.flatMap(texts)
  if (node && typeof node === "object" && "props" in node)
    return texts((node as { props: { children?: unknown } }).props.children)
  return []
}

/** Every node type of a satori tree. */
const types = (node: unknown): Array<string> => {
  if (Array.isArray(node)) return node.flatMap(types)
  if (node && typeof node === "object" && "type" in node) {
    const n = node as { type: string; props: { children?: unknown } }
    return [n.type, ...types(n.props.children)]
  }
  return []
}

const quotes = (p: Profile) =>
  [...p.traits, ...p.dimensions].flatMap((x) => x.evidence.map((e) => e.quote))

const subsets = <A>(xs: ReadonlyArray<A>): Array<Array<A>> =>
  xs.reduce<Array<Array<A>>>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]])

const ALL_OPTIONS: Array<RenderOptions> = LOOK_IDS.flatMap((look) =>
  subsets<CardPart>(CARD_PARTS).map((cardHide) => ({ look, cardHide })),
)

describe("render options", () => {
  it("names a variant by look and hidden parts, in a fixed order", () => {
    expect(variantName({ look: "signal", cardHide: [] })).toBe("signal")
    expect(variantName({ look: "studio", cardHide: ["graphic", "stats"] })).toBe(
      "studio-no-stats-graphic",
    )
    expect(
      variantName({ look: "signal", cardHide: ["traits"], exclude: ["dates", "quotes"] }),
    ).toBe("signal-no-traits-without-quotes-dates")
  })
})

describe("looks: report", () => {
  it.effect("the default look is today's report", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      expect(renderHtml(p, DEFAULT_RENDER_OPTIONS)).toBe(renderHtml(p))
      expect(renderHtml(p)).not.toContain("@font-face")
    }),
  )

  it.effect("every look keeps all evidence, warnings and coverage, and stays offline", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      const base = renderHtml(p)
      for (const look of LOOK_IDS) {
        const out = renderHtml(p, { look, cardHide: [] })
        if (look !== "classic") expect(out).toContain(`data-look="${look}"`)
        expect(out).toContain("Insufficient evidence")
        expect(out).toContain("1 chunk failed and was skipped")
        expect(out.match(/<blockquote[ >]/g)?.length).toBe(base.match(/<blockquote[ >]/g)?.length)
        for (const t of p.traits) expect(out).toContain(t.name)
        expect(out).toContain("High confidence")
        expect(out).not.toMatch(/https?:\/\/(?!www\.w3\.org)/)
        if (look !== "classic") {
          expect(out).toContain("src:url(data:font/woff;base64,")
          expect(out).toContain("font-src data:")
        }
      }
    }),
  )

  it.effect("hiding card parts never changes the private report", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      for (const look of LOOK_IDS) {
        expect(renderHtml(p, { look, cardHide: [...CARD_PARTS] })).toBe(
          renderHtml(p, { look, cardHide: [] }),
        )
      }
    }),
  )
})

describe("looks: card", () => {
  it.effect("the default card is today's card", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      expect(cardTree(p, DEFAULT_RENDER_OPTIONS)).toEqual(cardTree(p))
    }),
  )

  it.effect("no look or combination shows a quote or a project name", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      // The fixture's "prompt-profile" project shares the product name printed on every card.
      const projects = p.stats.topProjects.map((x) => x.name).filter((n) => n !== "prompt-profile")
      const forbidden = [...quotes(p), ...projects]
      for (const options of ALL_OPTIONS) {
        const text = texts(cardTree(p, options)).join("\n")
        for (const f of forbidden) expect(text, `${variantName(options)}: ${f}`).not.toContain(f)
      }
    }),
  )

  it.effect("hidden parts are absent; the archetype always stays", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      // the card's first number is the busiest four hours
      const prompts = "–"
      for (const options of ALL_OPTIONS) {
        const tree = cardTree(p, options)
        const text = texts(tree).join("\n")
        const hidden = (part: CardPart) => options.cardHide.includes(part)
        expect(text).toContain(p.archetype.name)
        expect({
          variant: variantName(options),
          traits: text.includes(p.traits[0]!.name),
          stats: text.includes(prompts),
          graphic: types(tree).includes("img"),
        }).toEqual({
          variant: variantName(options),
          traits: !hidden("traits"),
          stats: !hidden("stats"),
          graphic: !hidden("graphic"),
        })
      }
    }),
  )

  it.effect("every look renders a 1200×630 PNG", () =>
    Effect.gen(function* () {
      const p = yield* sample()
      for (const look of LOOK_IDS) {
        const png = yield* renderCard(p, embeddedFonts(), { look, cardHide: [] })
        expect(pngSize(png)).toEqual({ width: 1200, height: 630 })
      }
    }),
  )
})

describe("looks: writeReport", () => {
  it.effect("a default render writes no render.json", () =>
    Effect.gen(function* () {
      const outDir = join(mkdtempSync(join(tmpdir(), "pp-look-")), "out")
      yield* writeReport(yield* sample(), outDir)
      expect(existsSync(join(outDir, "render.json"))).toBe(false)
    }).pipe(Effect.provide(NodeServices.layer)),
  )

  it.effect("a non-default render records its options and the profile it came from", () =>
    Effect.gen(function* () {
      const outDir = join(mkdtempSync(join(tmpdir(), "pp-look-")), "out")
      const files = yield* writeReport(
        yield* sample(),
        outDir,
        { look: "afterhours", cardHide: ["stats"] },
        "../profile.json",
      )
      const manifest = join(outDir, "render.json")
      expect(statSync(manifest).mode & 0o777).toBe(0o600)
      const render = JSON.parse(readFileSync(manifest, "utf8"))
      expect(render).toMatchObject({
        renderVersion: 2,
        look: "afterhours",
        lookVersion: 1,
        cardHidden: ["stats"],
        excluded: [],
        source: "../profile.json",
      })
      expect(render.profileSha256).toBe(
        createHash("sha256").update(readFileSync(files.profileJson)).digest("hex"),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  )
})
