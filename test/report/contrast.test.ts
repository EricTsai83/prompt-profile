import { describe, expect, it } from "@effect/vitest"
import type { ColorTokens, Theme } from "../../src/report/theme.ts"
import { THEMES } from "../../src/report/theme.ts"

/** WCAG 2.x relative luminance of a `#rgb` / `#rrggbb` color. */
const luminance = (color: string): number => {
  const hex = color.slice(1)
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = Number.parseInt(full.slice(i, i + 2), 16) / 255
    return v <= 0.039_28 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** Small text needs 4.5:1 (WCAG 1.4.3 AA); the focus ring and graphics need 3:1 (1.4.11). */
const TEXT = 4.5
const NON_TEXT = 3

type Pair = readonly [name: string, fg: string, bg: string, min: number]

/** Text and focus pairs the report stylesheet and the card draw with a scheme's colors. */
const schemePairs = (c: ColorTokens): ReadonlyArray<Pair> => [
  ["fg on bg", c.fg, c.bg, TEXT],
  ["fg on card", c.fg, c.card, TEXT],
  ["muted on bg", c.muted, c.bg, TEXT],
  ["muted on card", c.muted, c.card, TEXT],
  ["accent on bg", c.accent, c.bg, TEXT],
  ["accent on card", c.accent, c.card, TEXT],
  ["accent on accent-soft (badges)", c.accent, c.accentSoft, TEXT],
  ["on-accent on accent (language switch)", c.onAccent, c.accent, TEXT],
  ["warn on card", c.warn, c.card, TEXT],
  ["positive on card", c.positive, c.card, TEXT],
  ["focus ring on bg", c.accent, c.bg, NON_TEXT],
]

/** Identity colors may name a scheme token (`var(--card)`); the hero then follows the scheme. */
const resolve = (value: string, c: ColorTokens): string => {
  const token = /^var\(--([a-z-]+)\)$/.exec(value)?.[1]
  if (token === undefined) return value
  const key = token.replace(/-([a-z])/g, (_, l: string) => l.toUpperCase()) as keyof ColorTokens
  return c[key] as string
}

const failures = (theme: Theme) => {
  const { light, dark, print } = theme.color
  const id = theme.identity
  const pairs: Array<readonly [string, ...Pair]> = [
    ...schemePairs(light).map((p) => ["light", ...p] as const),
    ...schemePairs(dark).map((p) => ["dark", ...p] as const),
    ...(
      [
        ["fg on bg", print.fg, print.bg, TEXT],
        ["muted on bg", print.muted, print.bg, TEXT],
        ["accent on bg", print.accent, print.bg, TEXT],
      ] as const
    ).map((p) => ["print", ...p] as const),
    ...[light, dark].flatMap((c, i) =>
      (
        [
          ["identity text", resolve(id.text, c), resolve(id.background, c), TEXT],
          ["identity muted", resolve(id.muted, c), resolve(id.background, c), TEXT],
        ] as const
      ).map((p) => [i === 0 ? "light" : "dark", ...p] as const),
    ),
  ]
  return pairs
    .map(([scheme, name, fg, bg, min]) => ({ scheme, name, ratio: contrast(fg, bg), min }))
    .filter((p) => p.ratio < p.min)
    .map((p) => `${theme.id} ${p.scheme}: ${p.name} ${p.ratio.toFixed(2)} < ${p.min}`)
}

describe("theme colors", () => {
  it("measures contrast like WCAG", () => {
    expect(contrast("#000", "#fff")).toBeCloseTo(21)
    expect(contrast("#777", "#fff")).toBeCloseTo(4.48, 2)
  })

  it("meet WCAG AA contrast in light, dark and print, report and card", () => {
    expect(THEMES.flatMap(failures)).toEqual([])
  })
})
