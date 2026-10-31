import type { Language, Profile } from "../domain/index.ts"
import { AVATAR_PALETTE } from "./avatar.ts"
import { svgDataUrl } from "./graphic.ts"
import { CARD_MESSAGES } from "./messages.ts"

/** A card radar always has at least this many spokes; shorter trait lists get blank ones. */
export const CARD_RADAR_MIN_AXES = 3

/** satori element (the card's tree format). */
interface Node {
  readonly type: string
  readonly props: Record<string, unknown>
}

const div = (style: Record<string, unknown>, children?: unknown): Node => ({
  type: "div",
  props: { style, children },
})

interface Axis {
  /** null: a blank spoke that only completes the shape. */
  readonly name: string | null
  /** 0–100, or null when the trait was not measured. */
  readonly share: number | null
}

/**
 * The card's spokes: one per supported trait (translated), padded to CARD_RADAR_MIN_AXES. A
 * card features only supported observations: low-confidence or uncited traits stay off it.
 * Hidden traits (`--card-hide traits`, limited evidence) leave blank spokes only.
 */
export const cardRadarAxes = (
  p: Profile,
  lang: Language,
  showTraits = true,
): ReadonlyArray<Axis> => {
  const traits = showTraits
    ? p.traits.flatMap((t, i) =>
        t.confidence === "low" || t.evidence.length === 0
          ? []
          : [
              {
                name: p.translations[lang]?.traits[i]?.name ?? t.name,
                share:
                  t.frequency && t.frequency.analysedSessions > 0
                    ? Math.round((t.frequency.sessions / t.frequency.analysedSessions) * 100)
                    : null,
              },
            ],
      )
    : []
  const blanks = Math.max(0, CARD_RADAR_MIN_AXES - traits.length)
  return [...traits, ...Array.from({ length: blanks }, () => ({ name: null, share: null }))]
}

export interface RadarColors {
  /** Grid and spokes. */
  readonly line: string
  readonly fg: string
  readonly muted: string
  /** The share under each trait name. */
  readonly value: string
  /** The card background, for the ring around each point. */
  readonly card: string
}

const POINT_COLORS = [AVATAR_PALETTE.warm, AVATAR_PALETTE.rose, AVATAR_PALETTE.jade]
const LABEL_WIDTH = 170

/**
 * The card's radar: the drawing (grid, spokes, shape and points) as one image, then each
 * trait's name and share as text nodes around it (SVG images get no fonts). The shape is drawn
 * when every trait is measured; otherwise the measured points stand alone and the others say
 * "Not measured". 0% is the center and 100% the outer ring.
 */
export const cardRadar = (
  p: Profile,
  lang: Language,
  at: { readonly cx: number; readonly cy: number; readonly r: number },
  colors: RadarColors,
  showTraits = true,
): ReadonlyArray<Node> => {
  const axes = cardRadarAxes(p, lang, showTraits)
  const n = axes.length
  const pad = 12
  const size = 2 * (at.r + pad)
  const c = size / 2
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const point = (i: number, share: number, r = at.r) =>
    [
      c + Math.cos(angle(i)) * r * (share / 100),
      c + Math.sin(angle(i)) * r * (share / 100),
    ] as const
  const ring = (share: number) =>
    axes
      .map((_, i) =>
        point(i, share)
          .map((v) => v.toFixed(1))
          .join(","),
      )
      .join(" ")
  const measured =
    axes.some((a) => a.name !== null) && axes.every((a) => a.name === null || a.share !== null)
  const shape = measured
    ? `<polygon data-radar="shape" points="${axes
        .map((a, i) =>
          point(i, a.share ?? 0)
            .map((v) => v.toFixed(1))
            .join(","),
        )
        .join(
          " ",
        )}" fill="${AVATAR_PALETTE.jade}" fill-opacity="0.45" stroke="${colors.fg}" stroke-width="3" stroke-linejoin="round"/>`
    : ""
  const dots = axes
    .map((a, i) => {
      if (a.share === null) return ""
      const [x, y] = point(i, a.share)
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${POINT_COLORS[i % POINT_COLORS.length]}" stroke="${colors.card}" stroke-width="3"/>`
    })
    .join("")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><g data-radar="grid" fill="none" stroke="${colors.line}">${[
    25, 50, 75,
  ]
    .map((s) => `<polygon points="${ring(s)}" stroke-dasharray="3 6"/>`)
    .join("")}<polygon points="${ring(100)}" stroke-width="2"/>${axes
    .map((_, i) => {
      const [x, y] = point(i, 100)
      return `<line data-radar="spoke" x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`
    })
    .join("")}</g>${shape}${dots}</svg>`
  const m = CARD_MESSAGES[lang]
  const labels = axes.flatMap((a, i) => {
    if (a.name === null) return []
    const [x, y] = point(i, 100, at.r + 22)
    const dx = x - c
    const side = Math.abs(dx) < 8 ? "center" : dx > 0 ? "left" : "right"
    const left =
      at.cx - c + x - (side === "center" ? LABEL_WIDTH / 2 : side === "right" ? LABEL_WIDTH : 0)
    const top = at.cy - c + y - (y < c - at.r * 0.5 ? 46 : y > c + at.r * 0.5 ? 0 : 22)
    return [
      div(
        {
          position: "absolute",
          left,
          top,
          width: LABEL_WIDTH,
          display: "flex",
          flexDirection: "column",
          alignItems: side === "center" ? "center" : side === "left" ? "flex-start" : "flex-end",
        },
        [
          div({ fontSize: 17, fontWeight: 700, color: colors.fg, lineHeight: 1.2 }, a.name),
          a.share === null
            ? div({ fontSize: 15, color: colors.muted }, m.notMeasured)
            : div({ fontSize: 19, fontWeight: 800, color: colors.value }, `${a.share}%`),
        ],
      ),
    ]
  })
  return [
    {
      type: "img",
      props: {
        src: svgDataUrl(svg),
        width: size,
        height: size,
        style: { position: "absolute", left: at.cx - c, top: at.cy - c },
      },
    },
    ...labels,
  ]
}
