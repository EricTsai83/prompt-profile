/**
 * Offline card geometry and PNG QA; CJK_FONT_DIR must contain the verified cached fonts.
 * Also writes every look's card in both languages and all hide combinations to
 * `<CARD_QA_OUT>/all`, so two runs can be compared byte for byte. `CARD_QA_LOOKS=a,b` limits
 * both passes to some looks (satori's wasm memory does not survive every look in one process).
 */
import { createHash } from "node:crypto"
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Effect } from "effect"
import satori from "satori"
import { decodeProfile } from "../src/domain/Profile.ts"
import { cardTree, renderCard } from "../src/report/card.ts"
import { CJK_FONTS, embeddedFonts } from "../src/report/fonts.ts"
import { LOOK_IDS, PRODUCT_LOOK_IDS, CARD_PARTS } from "../src/report/looks.ts"

const dir = process.env.CJK_FONT_DIR
if (!dir) throw new Error("Set CJK_FONT_DIR to the cached Noto Sans TC font folder")
const fonts = [
  ...embeddedFonts(),
  ...CJK_FONTS.map((f) => {
    const data = readFileSync(join(dir, f.file))
    if (createHash("sha256").update(data).digest("hex") !== f.sha256)
      throw new Error(`Font checksum mismatch: ${f.file}`)
    return { name: "Noto Sans TC", weight: f.weight, data }
  }),
]
const p = await Effect.runPromise(
  decodeProfile(JSON.parse(readFileSync("test/fixtures/profile.sample.json", "utf8"))),
)
const seed = p.translations["zh-TW"]!.archetype.name.repeat(30)
const out = process.env.CARD_QA_OUT || "tmp/card-qa"
mkdirSync(out, { recursive: true })
const only = process.env.CARD_QA_LOOKS?.split(",")
const selected = <A extends string>(looks: ReadonlyArray<A>) =>
  looks.filter((l) => only === undefined || only.includes(l))
const results = []
for (const look of selected(PRODUCT_LOOK_IDS)) {
  for (const kind of ["cjk", "mixed"] as const) {
    const text = kind === "cjk" ? seed : `AI Collaboration ${seed}`
    const profile = {
      ...p,
      translations: {
        ...p.translations,
        "zh-TW": {
          ...p.translations["zh-TW"]!,
          archetype: { name: text.slice(0, 52), description: text },
          headline: text.slice(0, 105),
          traits: p.traits.map(() => ({ name: text.slice(0, 48), description: text })),
        },
      },
    }
    for (let mask = 0; mask < 8; mask++) {
      const cardHide = CARD_PARTS.filter((_, i) => mask & (1 << i))
      const options = { look, cardHide }
      let boxes = 0
      await satori(cardTree(profile, options, "zh-TW") as never, {
        width: 1200,
        height: 630,
        fonts: fonts.map((f) => ({ ...f, data: Buffer.from(f.data) })),
        onNodeDetected: (node) => {
          if (
            node.textContent &&
            node.textContent !== "npx prompt-profile" &&
            node.top >= 120 &&
            node.left < 748
          ) {
            boxes++
            if (node.top + node.height > 518 || node.left + node.width > 748)
              throw new Error(`Identity exceeds content region: ${look}/${kind}/${mask}`)
          }
        },
      })
      if (boxes < 2) throw new Error("No identity geometry captured")
      const png = await Effect.runPromise(renderCard(profile, fonts, options, "zh-TW"))
      const view = new DataView(png.buffer, png.byteOffset)
      if (view.getUint32(16) !== 1200 || view.getUint32(20) !== 630)
        throw new Error("Wrong PNG size")
      if (mask === 0) writeFileSync(join(out, `${look}-${kind}.png`), png)
      results.push({ look, kind, cardHide, boxes, passed: true })
    }
  }
}
mkdirSync(join(out, "all"), { recursive: true })
const long = {
  ...p,
  archetype: { ...p.archetype, name: "A very long fictional collaborator name ".repeat(3) },
  headline: "Fictional headline that keeps going ".repeat(6),
}
for (const [kind, profile] of [
  ["sample", p],
  ["long", long],
] as const)
  for (const look of selected(LOOK_IDS))
    for (const lang of p.languages)
      for (let mask = 0; mask < 8; mask++) {
        const cardHide = CARD_PARTS.filter((_, i) => mask & (1 << i))
        const png = await Effect.runPromise(renderCard(profile, fonts, { look, cardHide }, lang))
        writeFileSync(join(out, "all", `${kind}-${look}-${lang}-${mask}.png`), png)
      }
writeFileSync(join(out, "checks.json"), JSON.stringify(results, null, 2) + "\n")
console.log(`${results.length} card geometry and PNG cases passed`)
