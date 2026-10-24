import type { GraphicKind, Identity } from "./looks.ts"

/** A look's signature graphic as a standalone SVG, drawn from the 24-hour histogram only. */
export const graphicSvg = (
  kind: GraphicKind,
  hours: ReadonlyArray<number>,
  identity: Pick<Identity, "graphicColor" | "graphicDetail">,
): { readonly svg: string; readonly width: number; readonly height: number } => {
  const max = Math.max(1, ...hours)
  const color = identity.graphicColor
  const f = (n: number) => n.toFixed(1)
  if (kind === "bars") {
    const bars = hours
      .map((v, i) => {
        const h = 18 + (154 * v) / max
        return `<rect x="${f(i * 11.7)}" y="${f(185 - h)}" width="7.4" height="${f(h)}" rx="3.7" fill="${color}" fill-opacity="${f(0.4 + (0.6 * v) / max)}"/>`
      })
      .join("")
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 285 210">${bars}<rect x="0" y="199" width="280" height="1.5" fill="${color}" fill-opacity="0.35"/></svg>`,
      width: 285,
      height: 210,
    }
  }
  if (kind === "orbit") {
    const dots = hours
      .map((v, i) => {
        const a = (i / 24) * Math.PI * 2 - Math.PI / 2
        const r = 91 + (15 * v) / max
        return `<circle cx="${f(150 + Math.cos(a) * r)}" cy="${f(150 + Math.sin(a) * r)}" r="${f(3 + (8 * v) / max)}" fill="${color}" fill-opacity="${f(0.2 + (0.8 * v) / max)}"/>`
      })
      .join("")
    const detail = identity.graphicDetail
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><circle cx="150" cy="150" r="126" stroke="#8ca8bc" stroke-opacity="0.16" fill="none"/><circle cx="150" cy="150" r="65" stroke="#8ca8bc" stroke-opacity="0.3" fill="none"/>${dots}<path d="M150 131v21l16 10" fill="none" stroke="${detail}" stroke-width="5" stroke-linecap="round"/></svg>`,
      width: 300,
      height: 300,
    }
  }
  const detail = identity.graphicDetail
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 270"><path d="M30 30h170a24 24 0 0 1 24 24v122a24 24 0 0 1-24 24h-73l-52 43v-43H30a24 24 0 0 1-24-24V54a24 24 0 0 1 24-24Z" fill="${color}"/><rect x="48" y="78" width="122" height="16" rx="8" fill="${detail}"/><rect x="48" y="113" width="80" height="16" rx="8" fill="${detail}"/></svg>`,
    width: 270,
    height: 270,
  }
}

export const svgDataUrl = (svg: string): string =>
  `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
