import { Effect } from "effect"
import { Resvg, initWasm } from "@resvg/resvg-wasm"
import satori from "satori"
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import type { Profile } from "../domain/Profile.ts"
import type { FontData } from "./fonts.ts"
import { peakHour } from "./html.ts"
import { messages } from "./i18n.ts"

export const CARD_WIDTH = 1200
export const CARD_HEIGHT = 630

/** satori element tree without JSX (one less dependency). */
interface Node {
  readonly type: string
  readonly props: { readonly style?: Record<string, unknown>; readonly children?: unknown }
}
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
})

const clip = (s: string, max: number) =>
  Array.from(s).length > max
    ? `${Array.from(s)
        .slice(0, max - 1)
        .join("")}…`
    : s

/**
 * Card content: archetype, headline, up to 3 trait names and a few numbers.
 * **Never any prompt text** — the card is meant to be shared publicly.
 */
export const cardTree = (profile: Profile): Node => {
  const t = messages[profile.language]
  const s = profile.stats
  const peak = peakHour(s)
  const numbers: Array<[string, string]> = [
    [t.totalPrompts, s.totalPrompts.toLocaleString(profile.language)],
    [t.longestStreak, t.days(s.longestStreakDays)],
    s.latestTime
      ? [t.latestTime, s.latestTime]
      : [t.peakHour, peak === null ? t.none : `${String(peak).padStart(2, "0")}:00`],
  ]
  return h(
    "div",
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "56px 64px",
      backgroundImage: "linear-gradient(135deg, #17172b 0%, #2b2b6b 60%, #5b5bd6 100%)",
      color: "#f4f4ff",
      fontFamily: "Inter, Noto Sans TC",
    },
    [
      h("div", { display: "flex", flexDirection: "column" }, [
        h("div", { fontSize: 22, color: "#b9b9ff", letterSpacing: 2 }, t.title),
        h(
          "div",
          { fontSize: 56, fontWeight: 700, marginTop: 14, lineHeight: 1.15 },
          clip(profile.archetype.name, 56),
        ),
        h(
          "div",
          { fontSize: 26, marginTop: 16, lineHeight: 1.4, color: "#dcdcf5" },
          clip(profile.headline, 150),
        ),
      ]),
      h(
        "div",
        { display: "flex", gap: 12, flexWrap: "wrap" },
        profile.traits.slice(0, 3).map((tr) =>
          h(
            "div",
            {
              display: "flex",
              fontSize: 24,
              padding: "8px 18px",
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.14)",
            },
            clip(tr.name, 32),
          ),
        ),
      ),
      h("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end" }, [
        h(
          "div",
          { display: "flex", gap: 48 },
          numbers.map(([label, value]) =>
            h("div", { display: "flex", flexDirection: "column" }, [
              h("div", { fontSize: 40, fontWeight: 700 }, value),
              h("div", { fontSize: 18, color: "#b9b9ff" }, label),
            ]),
          ),
        ),
        h("div", { fontSize: 20, color: "#b9b9ff" }, "npx prompt-profile"),
      ]),
    ],
  )
}

let wasmReady: Promise<void> | null = null
const ensureWasm = (): Promise<void> => {
  if (wasmReady === null) {
    const require = createRequire(import.meta.url)
    wasmReady = initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")))
  }
  return wasmReady
}

const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/

/** Text on the card that needs the CJK font. */
export const cardNeedsCjk = (profile: Profile): boolean =>
  profile.language === "zh-TW" ||
  CJK.test(
    [
      profile.archetype.name,
      profile.headline,
      ...profile.traits.slice(0, 3).map((t) => t.name),
    ].join(""),
  )

/** Render the card to PNG bytes. */
export const renderCard = (
  profile: Profile,
  fonts: ReadonlyArray<FontData>,
): Effect.Effect<Uint8Array, Error> =>
  Effect.tryPromise({
    try: async () => {
      const svg = await satori(cardTree(profile) as never, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fonts: fonts.map((f) => ({
          name: f.name,
          data: Buffer.from(f.data),
          weight: f.weight,
          style: "normal" as const,
        })),
      })
      await ensureWasm()
      const resvg = new Resvg(svg, { fitTo: { mode: "width", value: CARD_WIDTH } })
      try {
        return resvg.render().asPng()
      } finally {
        resvg.free()
      }
    },
    catch: (e) => (e instanceof Error ? e : new Error(String(e))),
  })
